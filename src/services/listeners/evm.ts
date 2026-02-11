import { ethers, Contract, WebSocketProvider, Log } from 'ethers';
import { Chain } from '@prisma/client';
import { BaseListener } from './base';
import { chainConfigs } from '../../config/chains';
import { ERC20_ABI, USDT_DECIMALS } from '../../config/constants';
import { getActiveDepositAddresses, verifySession } from '../session';
import { emitSessionVerified } from '../../lib/websocket';

/**
 * EVM Listener (Ethereum & BSC)
 *
 * Subscribes to USDT Transfer events via WebSocket.
 * When a transfer is detected:
 *   1. Checks the recipient against active deposit addresses
 *   2. Validates the amount meets the minimum required
 *   3. Waits for the configured number of block confirmations
 *   4. Marks the session as verified and emits a WebSocket event
 */
export class EVMListener extends BaseListener {
    private provider: WebSocketProvider | null = null;
    private contract: Contract | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(chain: Chain) {
        super(chain);
        if (chain !== 'ETHEREUM' && chain !== 'BSC') {
            throw new Error(`EVMListener only supports ETHEREUM and BSC, got ${chain}`);
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        await this.connect();
    }

    private async connect(): Promise<void> {
        const config = chainConfigs[this.chain];

        if (!config.wsUrl) {
            this.logError('No WebSocket URL configured');
            return;
        }

        try {
            this.provider = new WebSocketProvider(config.wsUrl);
            this.contract = new Contract(config.usdtContract, ERC20_ABI, this.provider);

            this.log('Connected to WebSocket', { wsUrl: config.wsUrl });

            // Listen for Transfer events
            this.contract.on('Transfer', async (from: string, to: string, value: bigint, event: any) => {
                await this.handleTransfer(from, to, value, event);
            });

            // Handle WebSocket disconnection
            const ws = this.provider.websocket as any;
            if (ws && typeof ws.on === 'function') {
                ws.on('close', () => {
                    this.logWarn('WebSocket disconnected, attempting reconnect...');
                    this.scheduleReconnect();
                });

                ws.on('error', (error: Error) => {
                    this.logError('WebSocket error', { error: error.message });
                });
            }

            // Also listen for provider-level errors
            this.provider.on('error', (error: Error) => {
                this.logError('Provider error', { error: error.message });
                this.scheduleReconnect();
            });
        } catch (error) {
            this.logError('Failed to connect', { error: (error as Error).message });
            this.scheduleReconnect();
        }
    }

    private async handleTransfer(
        from: string,
        to: string,
        value: bigint,
        event: any
    ): Promise<void> {
        try {
            const normalizedTo = to.toLowerCase();
            const activeAddresses = await getActiveDepositAddresses(this.chain);

            const sessionId = activeAddresses.get(normalizedTo);
            if (!sessionId) return; // Not a deposit address we're watching

            const config = chainConfigs[this.chain];
            const decimals = USDT_DECIMALS[this.chain];
            const amount = parseFloat(ethers.formatUnits(value, decimals));

            this.log('Transfer detected to deposit address', {
                from,
                to,
                amount,
                txHash: event.log?.transactionHash,
                sessionId,
            });

            // Verify amount meets minimum
            if (amount < 1) {
                this.logWarn('Transfer amount below required minimum', {
                    amount,
                    required: 1,
                    sessionId,
                });
                return;
            }

            // Wait for confirmations
            const txHash = event.log?.transactionHash;
            if (!txHash) {
                this.logError('No transaction hash in event');
                return;
            }

            this.log('Waiting for confirmations', {
                required: config.confirmations,
                txHash,
            });

            const receipt = await this.provider!.waitForTransaction(
                txHash,
                config.confirmations,
                120_000 // 2 minute timeout
            );

            if (!receipt || receipt.status === 0) {
                this.logError('Transaction failed or reverted', { txHash });
                return;
            }

            // Mark session as verified
            const verified = await verifySession(sessionId, txHash, amount.toString());

            if (verified) {
                emitSessionVerified({
                    session_id: sessionId,
                    status: 'verified',
                    tx_hash: txHash,
                });

                this.log('Session verified successfully', { sessionId, txHash });
            }
        } catch (error) {
            this.logError('Error handling transfer', {
                error: (error as Error).message,
            });
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) return;

        this.reconnectTimeout = setTimeout(async () => {
            this.reconnectTimeout = null;
            if (this.isRunning) {
                this.log('Reconnecting...');
                await this.cleanup();
                await this.connect();
            }
        }, 5000);
    }

    private async cleanup(): Promise<void> {
        if (this.contract) {
            this.contract.removeAllListeners();
            this.contract = null;
        }
        if (this.provider) {
            await this.provider.destroy();
            this.provider = null;
        }
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        await this.cleanup();
        this.log('Stopped');
    }
}
