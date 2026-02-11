import { Chain } from '@prisma/client';
import { BaseListener } from './base';
import { chainConfigs } from '../../config/chains';
import { USDT_CONTRACTS, USDT_DECIMALS } from '../../config/constants';
import { getActiveDepositAddresses, verifySession, updateReceivedAmount, updateSessionAsFlash } from '../session';
import { emitSessionVerified } from '../../lib/websocket';
import { env } from '../../config/env';

// TronWeb types
interface TronTransaction {
    txID: string;
    blockNumber: number;
    raw_data: {
        contract: Array<{
            parameter: {
                value: {
                    contract_address?: string;
                    data?: string;
                    owner_address?: string;
                    to_address?: string;
                };
            };
            type: string;
        }>;
    };
    ret?: Array<{ contractRet: string }>;
}

interface TRC20TransferEvent {
    transaction_id: string;
    token_info: {
        address: string;
        decimals: number;
        symbol: string;
    };
    block_timestamp: number;
    from: string;
    to: string;
    type: string;
    value: string;
}

/**
 * Tron Listener
 *
 * Polls TronGrid API for TRC20 transfer events on the official USDT contract.
 * For each transfer to an active deposit address:
 *   1. Validates the transfer amount
 *   2. Waits for confirmations by checking subsequent blocks
 *   3. Marks the session as verified
 */
export class TronListener extends BaseListener {
    private pollInterval: NodeJS.Timeout | null = null;
    private lastTimestamp: number = Date.now();
    private readonly POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

    constructor() {
        super('TRON');
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        this.lastTimestamp = Date.now();
        this.log('Starting Tron listener (polling mode)');

        this.pollInterval = setInterval(() => {
            this.poll().catch((err) => {
                this.logError('Poll error', { error: err.message });
            });
        }, this.POLL_INTERVAL_MS);
    }

    private async poll(): Promise<void> {
        try {
            const activeAddresses = await getActiveDepositAddresses('TRON');
            if (activeAddresses.size === 0) return;

            // Check each active deposit address for TRC20 transfers
            for (const [address, sessionId] of activeAddresses) {
                await this.checkAddressTransfers(address, sessionId);
            }
        } catch (error) {
            this.logError('Error polling Tron', {
                error: (error as Error).message,
            });
        }
    }

    private async checkAddressTransfers(
        address: string,
        sessionId: string
    ): Promise<void> {
        const config = chainConfigs.TRON;

        try {
            // Query TronGrid for ALL TRC20 transfer events (to detect fakes)
            const url = `${config.rpcUrl}/v1/accounts/${address}/transactions/trc20?only_to=true&limit=20&min_timestamp=${this.lastTimestamp}`;

            const response = await fetch(url, {
                headers: {
                    'TRON-PRO-API-KEY': env.TRON_API_KEY,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                this.logError('TronGrid API error', { status: response.status });
                return;
            }

            const data = (await response.json()) as { data?: TRC20TransferEvent[] };
            const transfers: TRC20TransferEvent[] = data.data || [];

            for (const transfer of transfers) {
                // Check if this is the official USDT contract
                if (
                    transfer.token_info.address.toLowerCase() !==
                    USDT_CONTRACTS.TRON.toLowerCase()
                ) {
                    // Check if it's pretending to be USDT (Flash/Fake)
                    if (transfer.token_info.symbol.toUpperCase().includes('USDT')) {
                        this.logWarn('Fake/Flash USDT detected', {
                            txHash: transfer.transaction_id,
                            contract: transfer.token_info.address,
                            sessionId,
                        });
                        await updateSessionAsFlash(sessionId, transfer.transaction_id);
                    }
                    continue;
                }

                if (transfer.to !== address) continue;

                const decimals = USDT_DECIMALS.TRON;
                const amount =
                    parseFloat(transfer.value) / Math.pow(10, decimals);

                this.log('TRC20 USDT transfer detected', {
                    from: transfer.from,
                    to: transfer.to,
                    amount,
                    txHash: transfer.transaction_id,
                    sessionId,
                });

                if (amount < 1) {
                    this.logWarn('Transfer amount below required minimum', {
                        amount,
                        sessionId,
                    });
                    await updateReceivedAmount(sessionId, amount.toString());
                    continue;
                }

                // Wait for confirmations
                const confirmed = await this.waitForConfirmations(
                    transfer.transaction_id,
                    config.confirmations
                );

                if (!confirmed) {
                    this.logWarn('Transaction did not reach required confirmations', {
                        txHash: transfer.transaction_id,
                    });
                    continue;
                }

                // Mark session as verified
                const verified = await verifySession(
                    sessionId,
                    transfer.transaction_id,
                    amount.toString()
                );

                if (verified) {
                    emitSessionVerified({
                        session_id: sessionId,
                        status: 'verified',
                        tx_hash: transfer.transaction_id,
                    });

                    this.log('Tron session verified', {
                        sessionId,
                        txHash: transfer.transaction_id,
                    });
                }
            }

            // Update last timestamp for next poll
            this.lastTimestamp = Date.now();
        } catch (error) {
            this.logError('Error checking address transfers', {
                address,
                error: (error as Error).message,
            });
        }
    }

    private async waitForConfirmations(
        txHash: string,
        requiredConfirmations: number
    ): Promise<boolean> {
        const config = chainConfigs.TRON;
        const maxAttempts = 60; // ~3 minutes at 3s intervals
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                // Get transaction info
                const response = await fetch(
                    `${config.rpcUrl}/wallet/gettransactioninfobyid`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'TRON-PRO-API-KEY': env.TRON_API_KEY,
                        },
                        body: JSON.stringify({ value: txHash }),
                    }
                );

                const txInfo = (await response.json()) as { blockNumber?: number };

                if (txInfo.blockNumber) {
                    // Get current block
                    const blockResponse = await fetch(
                        `${config.rpcUrl}/wallet/getnowblock`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'TRON-PRO-API-KEY': env.TRON_API_KEY,
                            },
                        }
                    );

                    const currentBlock = (await blockResponse.json()) as {
                        block_header?: { raw_data?: { number?: number } };
                    };
                    const currentBlockNum =
                        currentBlock.block_header?.raw_data?.number || 0;
                    const confirmations = currentBlockNum - txInfo.blockNumber!;

                    if (confirmations >= requiredConfirmations) {
                        this.log('Transaction confirmed', {
                            txHash,
                            confirmations,
                            required: requiredConfirmations,
                        });
                        return true;
                    }
                }
            } catch (error) {
                this.logError('Error checking confirmations', {
                    txHash,
                    error: (error as Error).message,
                });
            }

            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        return false;
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.log('Stopped');
    }
}
