import {
    Connection,
    PublicKey,
    ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { Chain } from '@prisma/client';
import { BaseListener } from './base';
import { chainConfigs } from '../../config/chains';
import { USDT_CONTRACTS, USDT_DECIMALS } from '../../config/constants';
import { env } from '../../config/env';
import { getActiveDepositAddresses, verifySession, updateReceivedAmount } from '../session';
import { emitSessionVerified } from '../../lib/websocket';

/**
 * Solana Listener
 *
 * Uses Solana's WebSocket subscription (onLogs) to listen for SPL Token
 * transfers involving the USDT mint. When a transfer is detected:
 *   1. Parses the transaction to find token transfer instructions
 *   2. Matches recipients against active deposit addresses
 *   3. Validates amount and waits for finality
 *   4. Marks the session as verified
 */
export class SolanaListener extends BaseListener {
    private connection: Connection | null = null;
    private pollInterval: NodeJS.Timeout | null = null;
    private readonly POLL_INTERVAL_MS = 5000; // 5 seconds (Helius supports this)

    constructor() {
        super('SOLANA');
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        const config = chainConfigs.SOLANA;
        this.connection = new Connection(config.rpcUrl, {
            wsEndpoint: config.wsUrl,
            commitment: 'confirmed',
        });

        this.log('Starting Solana listener (polling mode)');

        // Poll only our deposit addresses every 5 seconds
        this.pollInterval = setInterval(() => {
            this.pollTransfers().catch((err) => {
                this.logError('Poll error', { error: err.message });
            });
        }, this.POLL_INTERVAL_MS);
    }


    private isPolling = false;

    private async pollTransfers(): Promise<void> {
        if (!this.connection || this.isPolling) return;
        this.isPolling = true;

        try {
            const activeAddresses = await getActiveDepositAddresses('SOLANA');
            if (activeAddresses.size === 0) return;

            // Convert map to array of [address, sessionId]
            const targets = Array.from(activeAddresses.entries());

            // Process in chunks of 5 to avoid rate limits but allow parallelism
            const CHUNK_SIZE = 5;
            for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
                const chunk = targets.slice(i, i + CHUNK_SIZE);
                await Promise.all(
                    chunk.map(async ([address, sessionId]) => {
                        try {
                            const pubkey = new PublicKey(address);
                            // Get last 5 signatures
                            const signatures = await this.connection!.getSignaturesForAddress(
                                pubkey,
                                { limit: 5 },
                                'confirmed'
                            );

                            for (const sigInfo of signatures) {
                                if (sigInfo.err) continue;
                                // Process in background (fire-and-forget style for speed)
                                // But catch errors to prevent unhandled rejections
                                this.processTransaction(sigInfo.signature).catch((err) => {
                                    this.logError('Process tx error', {
                                        signature: sigInfo.signature,
                                        error: err.message,
                                    });
                                });
                            }
                        } catch (error) {
                            // Suppress 429 noise logs unless critical
                            const msg = (error as Error).message;
                            if (!msg.includes('429')) {
                                this.logError('Error polling address', {
                                    address,
                                    error: msg,
                                });
                            }
                        }
                    })
                );
                // Small delay between chunks to be nice to RPC
                if (i + CHUNK_SIZE < targets.length) {
                    await new Promise((r) => setTimeout(r, 500));
                }
            }
        } catch (error) {
            this.logError('Poll cycle error', { error: (error as Error).message });
        } finally {
            this.isPolling = false;
        }
    }

    private async processTransaction(signature: string): Promise<void> {
        if (!this.connection) return;

        try {
            const tx = await this.connection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
            });

            if (!tx || !tx.meta) return;

            // Look for SPL token transfers
            const instructions = tx.transaction.message.instructions;
            const innerInstructions = tx.meta.innerInstructions || [];

            // Check both main and inner instructions for token transfers
            const allInstructions = [
                ...instructions,
                ...innerInstructions.flatMap((ii) => ii.instructions),
            ];

            const activeAddresses = await getActiveDepositAddresses('SOLANA');
            if (activeAddresses.size === 0) return;

            for (const ix of allInstructions) {
                if ('parsed' in ix && ix.parsed) {
                    const parsed = ix.parsed as any;

                    if (
                        parsed.type === 'transfer' ||
                        parsed.type === 'transferChecked'
                    ) {
                        const info = parsed.info;
                        const destination = info.destination || info.account;
                        const mint = info.mint;

                        // For transferChecked, mint is included
                        // For transfer, we need to check the token account's mint
                        if (mint && mint !== USDT_CONTRACTS.SOLANA) continue;

                        // Get the owner of the destination token account
                        let destinationOwner: string | null = null;

                        try {
                            const accountInfo =
                                await this.connection!.getParsedAccountInfo(
                                    new PublicKey(destination)
                                );

                            if (accountInfo.value && 'parsed' in accountInfo.value.data) {
                                const tokenAccountData = accountInfo.value.data.parsed;
                                if (tokenAccountData.info?.mint === USDT_CONTRACTS.SOLANA) {
                                    destinationOwner = tokenAccountData.info.owner;
                                }
                            }
                        } catch {
                            continue;
                        }

                        if (!destinationOwner) continue;

                        const sessionId = activeAddresses.get(destinationOwner);
                        if (!sessionId) continue;

                        // Calculate amount
                        const decimals = USDT_DECIMALS.SOLANA;
                        const rawAmount = info.amount || info.tokenAmount?.amount;
                        if (!rawAmount) continue;

                        const amount = parseFloat(rawAmount) / Math.pow(10, decimals);

                        this.log('SPL USDT transfer detected', {
                            to: destinationOwner,
                            amount,
                            signature,
                            sessionId,
                        });

                        // Always update received amount so UI shows partial payments
                        await updateReceivedAmount(sessionId, amount.toString());

                        if (amount < env.REQUIRED_AMOUNT_USDT) {
                            this.logWarn('Transfer amount below minimum', {
                                amount,
                                required: env.REQUIRED_AMOUNT_USDT,
                                sessionId,
                            });
                            continue;
                        }

                        // Wait for finality
                        const config = chainConfigs.SOLANA;
                        await this.waitForFinality(signature, config.confirmations);

                        // Verify session
                        const verified = await verifySession(
                            sessionId,
                            signature,
                            amount.toString()
                        );

                        if (verified) {
                            emitSessionVerified({
                                session_id: sessionId,
                                status: 'verified',
                                tx_hash: signature,
                            });

                            this.log('Solana session verified', { sessionId, signature });
                        }
                    }
                }
            }
        } catch (error) {
            this.logError('Error processing transaction', {
                signature,
                error: (error as Error).message,
            });
        }
    }

    private async waitForFinality(
        signature: string,
        requiredConfirmations: number
    ): Promise<void> {
        if (!this.connection) return;

        const maxAttempts = 60;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const status = await this.connection.getSignatureStatus(signature);

                if (status.value?.confirmationStatus === 'finalized') {
                    this.log('Transaction finalized', { signature });
                    return;
                }

                const confirmations = status.value?.confirmations || 0;
                if (confirmations >= requiredConfirmations) {
                    this.log('Transaction confirmed', {
                        signature,
                        confirmations,
                        required: requiredConfirmations,
                    });
                    return;
                }
            } catch (error) {
                this.logError('Error checking finality', {
                    signature,
                    error: (error as Error).message,
                });
            }

            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    async stop(): Promise<void> {
        this.isRunning = false;

        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        this.connection = null;
        this.log('Stopped');
    }
}
