import { EVMListener } from './evm';
import { TronListener } from './tron';
import { SolanaListener } from './solana';
import { BaseListener } from './base';
import { logger } from '../../utils/logger';

const listeners: BaseListener[] = [];

/**
 * Start all blockchain listeners.
 * Each listener runs independently and monitors its respective chain
 * for incoming USDT transfers to active deposit addresses.
 */
export async function startAllListeners(): Promise<void> {
    logger.info('Starting all blockchain listeners...');

    const ethListener = new EVMListener('ETHEREUM');
    const bscListener = new EVMListener('BSC');
    const tronListener = new TronListener();
    const solanaListener = new SolanaListener();

    listeners.push(ethListener, bscListener, tronListener, solanaListener);

    // Start all listeners concurrently
    await Promise.allSettled(
        listeners.map(async (listener) => {
            try {
                await listener.start();
            } catch (error) {
                logger.error(`Failed to start listener`, {
                    error: (error as Error).message,
                });
            }
        })
    );

    logger.info('All blockchain listeners started');
}

/**
 * Stop all blockchain listeners gracefully.
 */
export async function stopAllListeners(): Promise<void> {
    logger.info('Stopping all blockchain listeners...');

    await Promise.allSettled(
        listeners.map(async (listener) => {
            try {
                await listener.stop();
            } catch (error) {
                logger.error('Error stopping listener', {
                    error: (error as Error).message,
                });
            }
        })
    );

    listeners.length = 0;
    logger.info('All blockchain listeners stopped');
}

export { EVMListener, TronListener, SolanaListener, BaseListener };
