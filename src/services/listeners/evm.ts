import { ethers, JsonRpcProvider } from 'ethers';
import { Chain } from '@prisma/client';
import { BaseListener } from './base';
import { chainConfigs } from '../../config/chains';
import { USDT_DECIMALS } from '../../config/constants';
import { getActiveDepositAddresses, verifySession, updateReceivedAmount, updateSessionAsFlash } from '../session';
import { emitSessionVerified } from '../../lib/websocket';

// Transfer(address,address,uint256) event signature
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

/**
 * EVM Listener (Ethereum & BSC) — LAZY POLLING MODE
 *
 * Only creates the RPC provider when there are active sessions.
 * Polls every 15 seconds using eth_getLogs filtered to our deposit addresses.
 * Gracefully handles RPC errors without infinite retry spam.
 */
export class EVMListener extends BaseListener {
    private provider: JsonRpcProvider | null = null;
    private pollInterval: NodeJS.Timeout | null = null;
    private lastBlock: number = 0;
    private providerReady: boolean = false;
    private consecutiveErrors: number = 0;
    private readonly POLL_INTERVAL_MS = 15000; // 15 seconds
    private readonly MAX_CONSECUTIVE_ERRORS = 5;

    constructor(chain: Chain) {
        super(chain);
        if (chain !== 'ETHEREUM' && chain !== 'BSC') {
            throw new Error(`EVMListener only supports ETHEREUM and BSC, got ${chain}`);
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        this.log('Starting EVM listener (lazy polling mode)');

        // Don't create provider yet — wait until there are active sessions
        this.pollInterval = setInterval(() => {
            this.poll().catch((err) => {
                this.logError('Poll cycle error', { error: err.message });
            });
        }, this.POLL_INTERVAL_MS);
    }

    private async ensureProvider(): Promise<boolean> {
        if (this.providerReady && this.provider) return true;

        // Too many consecutive errors — back off
        if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
            // Only retry every 5th call after max errors (effectively 75s backoff)
            if (this.consecutiveErrors % 5 !== 0) {
                this.consecutiveErrors++;
                return false;
            }
        }

        const config = chainConfigs[this.chain];
        const rpcUrl = config.rpcUrl;

        if (!rpcUrl) {
            this.logError('No RPC URL configured');
            return false;
        }

        try {
            // Destroy old provider if exists
            if (this.provider) {
                try { await this.provider.destroy(); } catch { /* ignore */ }
            }

            // Create provider with static network to prevent auto-detect retries
            this.provider = new JsonRpcProvider(rpcUrl, undefined, {
                staticNetwork: true,
            });

            // Test the connection with a simple call
            this.lastBlock = await this.provider.getBlockNumber();
            this.providerReady = true;
            this.consecutiveErrors = 0;
            this.log('RPC connected', {
                rpcUrl: rpcUrl.replace(/\/[a-f0-9]{32,}/i, '/***'),
                startBlock: this.lastBlock,
            });
            return true;
        } catch (error) {
            this.consecutiveErrors++;
            if (this.consecutiveErrors <= 3) {
                this.logWarn('RPC connection failed, will retry', {
                    error: (error as Error).message,
                    attempt: this.consecutiveErrors,
                });
            }
            this.providerReady = false;
            return false;
        }
    }

    private isPolling = false;

    private async poll(): Promise<void> {
        if (this.isPolling) return;
        this.isPolling = true;

        try {
            // First check if there are active sessions for this chain
            const activeAddresses = await getActiveDepositAddresses(this.chain);
            if (activeAddresses.size === 0) {
                return; // No active sessions — don't even connect to RPC
            }

            // Lazy-connect to provider
            if (!(await this.ensureProvider())) return;
            if (!this.provider) return;

            const currentBlock = await this.provider.getBlockNumber();
            if (currentBlock <= this.lastBlock) return;

            const config = chainConfigs[this.chain];

            // Query Transfer logs only TO our deposit addresses
            const paddedAddresses = Array.from(activeAddresses.keys()).map((addr) =>
                ethers.zeroPadValue(addr, 32)
            );

            const logs = await this.provider.getLogs({
                fromBlock: this.lastBlock + 1,
                toBlock: currentBlock,
                // address: config.usdtContract, // Removed to allow detection of Flash/Fake tokens
                topics: [
                    TRANSFER_TOPIC,
                    null,
                    paddedAddresses,
                ],
            });

            // Process logs in parallel (Fire-and-Forget) without blocking the next poll
            for (const log of logs) {
                this.handleLog(log, activeAddresses).catch((err) => {
                    this.logError('Error handling log', {
                        txHash: log.transactionHash,
                        error: err.message,
                    });
                });
            }

            this.lastBlock = currentBlock;
            this.consecutiveErrors = 0;
        } catch (error) {
            this.consecutiveErrors++;
            this.providerReady = false; // Force reconnect next time
            if (this.consecutiveErrors <= 3) {
                this.logError('Error polling', { error: (error as Error).message });
            }
        } finally {
            this.isPolling = false;
        }
    }

    private async handleLog(
        log: ethers.Log,
        activeAddresses: Map<string, string>
    ): Promise<void> {
        try {
            const iface = new ethers.Interface([
                'event Transfer(address indexed from, address indexed to, uint256 value)',
            ]);
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (!parsed) return;

            const to = (parsed.args[1] as string).toLowerCase();
            const value = parsed.args[2] as bigint;
            const txHash = log.transactionHash;

            const sessionId = activeAddresses.get(to);
            if (!sessionId) return;

            const config = chainConfigs[this.chain];

            // Check for Flash/Fake tokens (Contract mismatch)
            if (log.address.toLowerCase() !== config.usdtContract.toLowerCase()) {
                this.logWarn('Flash/Fake USDT detected', {
                    contract: log.address,
                    sessionId,
                    txHash
                });
                await updateSessionAsFlash(sessionId, txHash);
                return;
            }

            const decimals = USDT_DECIMALS[this.chain];
            const amount = parseFloat(ethers.formatUnits(value, decimals));

            this.log('Transfer detected to deposit address', {
                from: parsed.args[0],
                to,
                amount,
                txHash,
                sessionId,
            });

            if (amount < 0.99) {
                this.logWarn('Transfer amount below minimum (0.99)', {
                    amount,
                    required: 0.99,
                    sessionId,
                });
                await updateReceivedAmount(sessionId, amount.toString());
                return;
            }

            // config is already declared above

            this.log('Waiting for confirmations', {
                required: config.confirmations,
                txHash,
            });

            const receipt = await this.provider!.waitForTransaction(
                txHash,
                config.confirmations,
                120_000
            );

            if (!receipt || receipt.status === 0) {
                this.logError('Transaction failed or reverted', { txHash });
                return;
            }

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
            this.logError('Error handling log', {
                error: (error as Error).message,
            });
        }
    }

    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.provider) {
            try { await this.provider.destroy(); } catch { /* ignore */ }
            this.provider = null;
        }
        this.providerReady = false;
        this.log('Stopped');
    }
}
