import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { createSessionLimiter } from '../middleware/rateLimiter';
import { asyncHandler, createAppError } from '../middleware/errorHandler';
import { createSession, getSession } from '../services/session';
import { SUPPORTED_CHAINS } from '../config/chains';

const router = Router();

// ─── Validation Schema ──────────────────────────────────────
const createSessionSchema = z.object({
    chain: z.enum(['ETHEREUM', 'BSC', 'TRON', 'SOLANA'], {
        errorMap: () => ({
            message: `Invalid chain. Supported chains: ${SUPPORTED_CHAINS.join(', ')}`,
        }),
    }),
});

// ─── POST /api/create-session ────────────────────────────────
router.post(
    '/create-session',
    createSessionLimiter,
    validate(createSessionSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { chain } = req.body;
        const session = await createSession(chain);

        res.status(201).json({
            success: true,
            data: session,
        });
    })
);

// ─── GET /api/session/:id ────────────────────────────────────
router.get(
    '/session/:id',
    asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;

        if (!id || id.length < 10) {
            throw createAppError('Invalid session ID', 400);
        }

        const session = await getSession(id);

        if (!session) {
            throw createAppError('Session not found', 404);
        }

        res.json({
            success: true,
            data: {
                id: session.id,
                chain: session.chain,
                depositAddress: session.depositAddress,
                requiredAmount: session.requiredAmount.toString(),
                receivedAmount: session.receivedAmount?.toString() || null,
                status: session.status,
                expiresAt: session.expiresAt.toISOString(),
                txHash: session.txHash,
                createdAt: session.createdAt.toISOString(),
            },
        });
    })
);

// ─── GET /api/health ─────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            supportedChains: SUPPORTED_CHAINS,
        },
    });
});

export default router;
