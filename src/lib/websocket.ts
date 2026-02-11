import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { SessionVerifiedEvent } from '../types';

let wss: WebSocketServer;

// Map session IDs to connected clients
const sessionClients = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: Server): WebSocketServer {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const sessionId = url.searchParams.get('session_id');

        if (!sessionId) {
            ws.close(4001, 'Missing session_id parameter');
            return;
        }

        logger.info('WebSocket client connected', { sessionId });

        // Register client for this session
        if (!sessionClients.has(sessionId)) {
            sessionClients.set(sessionId, new Set());
        }
        sessionClients.get(sessionId)!.add(ws);

        ws.on('close', () => {
            logger.info('WebSocket client disconnected', { sessionId });
            const clients = sessionClients.get(sessionId);
            if (clients) {
                clients.delete(ws);
                if (clients.size === 0) {
                    sessionClients.delete(sessionId);
                }
            }
        });

        ws.on('error', (error) => {
            logger.error('WebSocket error', { sessionId, error: error.message });
        });

        // Send initial acknowledgment
        ws.send(JSON.stringify({ type: 'connected', session_id: sessionId }));
    });

    wss.on('error', (error) => {
        logger.error('WebSocket server error', { error: error.message });
    });

    logger.info('WebSocket server initialized on /ws');
    return wss;
}

export function emitSessionVerified(event: SessionVerifiedEvent): void {
    const clients = sessionClients.get(event.session_id);
    if (!clients || clients.size === 0) {
        logger.warn('No WebSocket clients for session', {
            sessionId: event.session_id,
        });
        return;
    }

    const message = JSON.stringify({
        type: 'session_verified',
        ...event,
    });

    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            logger.info('Emitted session_verified to client', {
                sessionId: event.session_id,
            });
        }
    });
}

export function getWSS(): WebSocketServer {
    return wss;
}
