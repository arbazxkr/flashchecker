import { ethers, JsonRpcProvider } from 'ethers';
import { Chain } from '@prisma/client';
import { BaseListener } from './base';
import { chainConfigs } from '../../config/chains';
import { USDT_DECIMALS } from '../../config/constants';
import { getActiveDepositAddresses, verifySession, updateReceivedAmount } from '../session';
import { emitSessionVerified } from '../../lib/websocket';

// Transfer(address,address,uint256) event signature
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

/**
 * EVM Listener (Ethereum & BSC) — POLLING MODE
 *
 * Instead of subscribing to ALL Transfer events via WebSocket (which floods
 * the handler with every USDT transfer on the network), this listener polls
 * every few seconds and queries ONLY for Transfer events sent TO our active
 * deposit addresses. This reduces load by ~99.99%.
 */
export class EVMListener extends BaseListener {
    private provider: JsonRpcProvider | null = null;
    private pollInterval: NodeJS.Timeout | null = null;
    private lastBlock: number = 0;
    private readonly POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

    constructor(chain: Chain) {
        super(chain);
        if (chain !== 'ETHEREUM' && chain !== 'BSC') {
            throw new Error(`EVMListener only supports ETHEREUM and BSC, got ${chain}`);
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        const config = chainConfigs[this.chain];
        // Use HTTP RPC (more reliable for polling than WebSocket)
        const rpcUrl = config.rpcUrl || config.wsUrl?.replace('wss://', 'https://').replace('ws://', 'http://');

        if (!rpcUrl) {
            this.logError('No RPC URL configured');
            return;
        }

        try {
            this.provider = new JsonRpcProvider(rpcUrl);
            this.lastBlock = await this.provider.getBlockNumber();
            this.log('Starting EVM listener (polling mode)', {
                rpcUrl: rpcUrl.replace(/\/[a-f0-9]{32,}/i, '/***'), // hide API keys
                startBlock: this.lastBlock,
            });

            // Start polling
            this.pollInterval = setInterval(() => {
                this.poll().catch((err) => {
                    this.logError('Poll error', { error: err.message });
                });
            }, this.POLL_INTERVAL_MS);
        } catch (error) {
            this.logError('Failed to start', { error: (error as Error).message });
        }
    }

    private async poll(): Promise<void> {
        if (!this.provider) return;

        try {
            const currentBlock = await this.provider.getBlockNumber();
            if (currentBlock <= this.lastBlock) return; // No new blocks

            const activeAddresses = await getActiveDepositAddresses(this.chain);
            if (activeAddresses.size === 0) {
                this.lastBlock = currentBlock;
                return; // No active sessions, skip
            }

            const config = chainConfigs[this.chain];

            // Query Transfer logs only TO our deposit addresses
            // Topic layout: Transfer(from, to, value)
            // topic[0] = Transfer sig, topic[1] = from (any), topic[2] = to (our addresses)
            const paddedAddresses = Array.from(activeAddresses.keys()).map((addr) =>
                ethers.zeroPadValue(addr, 32)
            );

            const logs = await this.provider.getLogs({
                fromBlock: this.lastBlock + 1,
                toBlock: currentBlock,
                address: config.usdtContract, // Only official USDT contract
                topics: [
                    TRANSFER_TOPIC,
                    null, // from: any
                    paddedAddresses, // to: our deposit addresses only
                ],
            });

            for (const log of logs) {
                await this.handleLog(log, activeAddresses);
            }

            this.lastBlock = currentBlock;
        } catch (error) {
            this.logError('Error polling', { error: (error as Error).message });
        }
    }

    private async handleLog(
        log: ethers.Log,
        activeAddresses: Map<string, string>
    ): Promise<void> {
        try {
            // Decode Transfer event
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

            const decimals = USDT_DECIMALS[this.chain];
            const amount = parseFloat(ethers.formatUnits(value, decimals));

            this.log('Transfer detected to deposit address', {
                from: parsed.args[0],
                to,
                amount,
                txHash,
                sessionId,
            });

            // Verify amount meets minimum
            if (amount < 1) {
                this.logWarn('Transfer amount below required minimum', {
                    amount,
                    required: 1,
                    sessionId,
                });
                await updateReceivedAmount(sessionId, amount.toString());
                return;
            }

            // Wait for confirmations
            const config = chainConfigs[this.chain];
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
            await this.provider.destroy();
            this.provider = null;
        }
        this.log('Stopped');
    }
}
