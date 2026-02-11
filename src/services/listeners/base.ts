import { Chain } from '@prisma/client';
import { logger } from '../../utils/logger';

/**
 * Base class for blockchain listeners.
 * Each chain implements its own listener that polls or subscribes
 * to USDT Transfer events and matches them against active deposit sessions.
 */
export abstract class BaseListener {
    protected chain: Chain;
    protected isRunning = false;

    constructor(chain: Chain) {
        this.chain = chain;
    }

    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;

    protected log(message: string, meta?: Record<string, unknown>): void {
        logger.info(`[${this.chain} Listener] ${message}`, meta);
    }

    protected logError(message: string, meta?: Record<string, unknown>): void {
        logger.error(`[${this.chain} Listener] ${message}`, meta);
    }

    protected logWarn(message: string, meta?: Record<string, unknown>): void {
        logger.warn(`[${this.chain} Listener] ${message}`, meta);
    }
}
