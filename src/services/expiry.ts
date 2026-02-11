import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Expiry Service
 *
 * Periodically checks for sessions that have passed their expiry time
 * and marks them as EXPIRED. Only affects sessions still in PENDING status.
 */

const EXPIRY_CHECK_INTERVAL_MS = 15_000; // Check every 15 seconds

let expiryInterval: NodeJS.Timeout | null = null;

export async function expireSessions(): Promise<number> {
    try {
        const result = await prisma.depositSession.updateMany({
            where: {
                status: 'PENDING',
                expiresAt: { lte: new Date() },
            },
            data: {
                status: 'EXPIRED',
            },
        });

        if (result.count > 0) {
            logger.info(`Expired ${result.count} session(s)`);
        }

        return result.count;
    } catch (error) {
        logger.error('Error expiring sessions', {
            error: (error as Error).message,
        });
        return 0;
    }
}

export function startExpiryService(): void {
    logger.info('Starting session expiry service', {
        intervalMs: EXPIRY_CHECK_INTERVAL_MS,
    });

    // Run immediately on start
    expireSessions();

    expiryInterval = setInterval(expireSessions, EXPIRY_CHECK_INTERVAL_MS);
}

export function stopExpiryService(): void {
    if (expiryInterval) {
        clearInterval(expiryInterval);
        expiryInterval = null;
        logger.info('Stopped session expiry service');
    }
}
