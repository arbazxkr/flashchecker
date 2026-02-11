import { Chain } from '@prisma/client';
import prisma from '../lib/prisma';
import { env } from '../config/env';
import { deriveWallet, getNextDerivationIndex } from './wallet';
import { CreateSessionResponse } from '../types';
import { logger } from '../utils/logger';
import { emitSessionUpdated } from '../lib/websocket';

// Cache for active deposit addresses to reduce DB load
const activeAddressCache = new Map<Chain, { lastFetch: number; data: Map<string, string> }>();
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Creates a new deposit session:
 * 1. Atomically allocates a new derivation index
 * 2. Derives a unique deposit address for the chain
 * 3. Stores session in DB with PENDING status
 * 4. Returns session_id + deposit_address to caller
 */
export async function createSession(
    chain: Chain
): Promise<CreateSessionResponse> {
    const derivationIndex = await getNextDerivationIndex();
    const wallet = deriveWallet(chain, derivationIndex);

    const expiresAt = new Date(
        Date.now() + env.SESSION_EXPIRY_MINUTES * 60 * 1000
    );

    const session = await prisma.depositSession.create({
        data: {
            chain,
            depositAddress: wallet.address,
            derivationIndex,
            requiredAmount: env.REQUIRED_AMOUNT_USDT,
            status: 'PENDING',
            expiresAt,
        },
    });

    logger.info('Session created', {
        sessionId: session.id,
        chain,
        depositAddress: wallet.address,
        derivationIndex,
        expiresAt: expiresAt.toISOString(),
    });

    // Invalidate cache for this chain so listener picks up new address immediately
    activeAddressCache.delete(chain);

    return {
        sessionId: session.id,
        depositAddress: wallet.address,
        chain,
        requiredAmount: env.REQUIRED_AMOUNT_USDT.toString(),
        expiresAt: expiresAt.toISOString(),
    };
}

/**
 * Get session by ID.
 */
export async function getSession(sessionId: string) {
    return prisma.depositSession.findUnique({
        where: { id: sessionId },
    });
}

/**
 * Get all active (pending, non-expired) sessions for a given chain.
 */
export async function getActiveSessionsByChain(chain: Chain) {
    return prisma.depositSession.findMany({
        where: {
            chain,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
        },
    });
}

/**
 * Get all active deposit addresses for a chain.
 * Used by listeners to match incoming transfers.
 */
export async function getActiveDepositAddresses(
    chain: Chain
): Promise<Map<string, string>> {
    const now = Date.now();
    const cached = activeAddressCache.get(chain);

    if (cached && now - cached.lastFetch < CACHE_TTL_MS) {
        return cached.data;
    }

    const sessions = await getActiveSessionsByChain(chain);
    const addressMap = new Map<string, string>();

    for (const session of sessions) {
        // Normalize address for case-insensitive matching (EVM)
        const normalizedAddr =
            chain === 'ETHEREUM' || chain === 'BSC'
                ? session.depositAddress.toLowerCase()
                : session.depositAddress;
        addressMap.set(normalizedAddr, session.id);
    }

    activeAddressCache.set(chain, { lastFetch: now, data: addressMap });
    return addressMap;
}

/**
 * Mark a session as verified after receiving payment.
 * Uses optimistic locking to prevent double-verification.
 */
export async function verifySession(
    sessionId: string,
    txHash: string,
    receivedAmount: string
): Promise<boolean> {
    try {
        const result = await prisma.depositSession.updateMany({
            where: {
                id: sessionId,
                status: 'PENDING', // Only update if still pending (prevents double-spend)
            },
            data: {
                status: 'VERIFIED',
                txHash,
                receivedAmount: parseFloat(receivedAmount),
            },
        });

        if (result.count === 0) {
            logger.warn('Session verification skipped — not in PENDING state', {
                sessionId,
            });
            return false;
        }

        logger.info('Session verified', { sessionId, txHash, receivedAmount });
        return true;
    } catch (error) {
        logger.error('Failed to verify session', {
            sessionId,
            error: (error as Error).message,
        });
        return false;
    }
}

/**
 * Update the received amount for a session (e.g. for partial payments).
 * Does not change status to VERIFIED unless logic elsewhere decides to.
 */
export async function updateReceivedAmount(
    sessionId: string,
    amount: string
): Promise<void> {
    try {
        await prisma.depositSession.update({
            where: { id: sessionId },
            data: {
                receivedAmount: parseFloat(amount),
            },
        });
        logger.info('Session amount updated (partial)', { sessionId, amount });
        emitSessionUpdated(sessionId, { receivedAmount: amount });
    } catch (error) {
        logger.error('Failed to update session amount', {
            sessionId,
            error: (error as Error).message,
        });
    }
}


/**
 * Mark a session as FLASH (scam) detected.
 */
export async function updateSessionAsFlash(
    sessionId: string,
    txHash: string
): Promise<void> {
    try {
        await prisma.depositSession.update({
            where: { id: sessionId },
            data: {
                status: 'FLASH',
                txHash,
            },
        });
        logger.warn('Session marked as FLASH', { sessionId, txHash });
        emitSessionUpdated(sessionId, { status: 'FLASH', txHash });
    } catch (error) {
        logger.error('Failed to mark session as flash', {
            sessionId,
            error: (error as Error).message,
        });
    }
}
