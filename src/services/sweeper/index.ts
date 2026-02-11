import { Chain } from '@prisma/client';
import prisma from '../../lib/prisma';
import { sweepEVM } from './evm';
import { sweepTron } from './tron';
import { sweepSolana } from './solana';
import { SweepResult } from '../../types';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

let sweepInterval: NodeJS.Timeout | null = null;

/**
 * Sweep all verified sessions that haven't been swept yet.
 * Iterates through each verified session, sweeps USDT back to master wallet,
 * and logs the sweep transaction.
 */
async function sweepAll(): Promise<void> {
    try {
        // Get all verified sessions that haven't been swept yet
        const sessions = await prisma.depositSession.findMany({
            where: {
                status: 'VERIFIED',
                sweepTxHash: null,
            },
        });

        if (sessions.length === 0) return;

        logger.info(`[Sweeper] Found ${sessions.length} session(s) to sweep`);

        for (const session of sessions) {
            try {
                let result: SweepResult | null = null;

                switch (session.chain) {
                    case 'ETHEREUM':
                    case 'BSC':
                        result = await sweepEVM(
                            session.chain,
                            session.depositAddress,
                            session.derivationIndex
                        );
                        break;
                    case 'TRON':
                        result = await sweepTron(
                            session.depositAddress,
                            session.derivationIndex
                        );
                        break;
                    case 'SOLANA':
                        result = await sweepSolana(
                            session.depositAddress,
                            session.derivationIndex
                        );
                        break;
                }

                if (result) {
                    result.sessionId = session.id;

                    // Log sweep transaction and update session
                    await prisma.$transaction([
                        prisma.sweepLog.create({
                            data: {
                                sessionId: session.id,
                                chain: session.chain,
                                fromAddress: result.fromAddress,
                                toAddress: result.toAddress,
                                amount: parseFloat(result.amount),
                                gasTxHash: result.gasTxHash || null,
                                sweepTxHash: result.sweepTxHash,
                            },
                        }),
                        prisma.depositSession.update({
                            where: { id: session.id },
                            data: {
                                status: 'SWEPT',
                                sweepTxHash: result.sweepTxHash,
                            },
                        }),
                    ]);

                    logger.info('[Sweeper] Session swept and logged', {
                        sessionId: session.id,
                        chain: session.chain,
                        sweepTxHash: result.sweepTxHash,
                    });
                }
            } catch (error) {
                logger.error('[Sweeper] Error sweeping session', {
                    sessionId: session.id,
                    chain: session.chain,
                    error: (error as Error).message,
                });
            }
        }
    } catch (error) {
        logger.error('[Sweeper] Error in sweep cycle', {
            error: (error as Error).message,
        });
    }
}

/**
 * Start the sweeper service.
 * Periodically checks for verified sessions with USDT balances
 * and sweeps them to the master wallet.
 */
export function startSweeper(): void {
    if (!env.SWEEPER_ENABLED) {
        logger.info('[Sweeper] Disabled by configuration');
        return;
    }

    logger.info('[Sweeper] Starting sweeper service', {
        intervalMs: env.SWEEPER_INTERVAL_MS,
    });

    // Run immediately
    sweepAll();

    sweepInterval = setInterval(sweepAll, env.SWEEPER_INTERVAL_MS);
}

/**
 * Stop the sweeper service.
 */
export function stopSweeper(): void {
    if (sweepInterval) {
        clearInterval(sweepInterval);
        sweepInterval = null;
        logger.info('[Sweeper] Stopped');
    }
}

export { sweepEVM, sweepTron, sweepSolana };
