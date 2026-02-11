import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createServer } from 'http';
import { env } from './config/env';
import { logger } from './utils/logger';
import prisma from './lib/prisma';
import { initWebSocket } from './lib/websocket';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import sessionRoutes from './routes/session';
import { startAllListeners, stopAllListeners } from './services/listeners';
import { startExpiryService, stopExpiryService } from './services/expiry';
import { startSweeper, stopSweeper } from './services/sweeper';

// ─── Express App ─────────────────────────────────────────────
const app = express();

// Security middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'", 'ws:', 'wss:'],
            },
        },
    })
);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate limiting
app.use('/api', apiRateLimiter);

// Routes
app.use('/api', sessionRoutes);

// Serve index.html for all non-API, non-static routes (SPA fallback)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404 handler for API routes
app.use('/api/*', (_req, res) => {
    res.status(404).json({
        success: false,
        error: { message: 'API route not found' },
    });
});

// Global error handler
app.use(errorHandler);

// ─── HTTP + WebSocket Server ─────────────────────────────────
const server = createServer(app);
initWebSocket(server);

// ─── Startup ─────────────────────────────────────────────────
async function start(): Promise<void> {
    try {
        // Test database connection
        await prisma.$connect();
        logger.info('Database connected');

        // Initialize derivation counter if it doesn't exist
        await prisma.derivationCounter.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', lastIndex: 0 },
            update: {},
        });

        // Start services
        await startAllListeners();
        startExpiryService();
        startSweeper();

        // Start HTTP server
        server.listen(env.PORT, () => {
            logger.info(`🚀 FlashChecker server running on port ${env.PORT}`, {
                env: env.NODE_ENV,
                port: env.PORT,
            });
            logger.info('Services started: Listeners, Expiry, Sweeper');
        });
    } catch (error) {
        logger.error('Failed to start server', {
            error: (error as Error).message,
            stack: (error as Error).stack,
        });
        process.exit(1);
    }
}

// ─── Graceful Shutdown ───────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    try {
        // Stop accepting new connections
        server.close();

        // Stop services in order
        await stopAllListeners();
        stopExpiryService();
        stopSweeper();

        // Disconnect database
        await prisma.$disconnect();

        logger.info('Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', {
            error: (error as Error).message,
        });
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

// ─── Start the server ────────────────────────────────────────
start();
