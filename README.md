# FlashChecker — Multi-Chain USDT Deposit Verification System

A production-ready TypeScript backend that implements multi-chain USDT deposit verification using HD-derived deposit addresses from a master wallet.

## Supported Chains

| Chain | Token Standard | USDT Contract |
|-------|---------------|---------------|
| Ethereum | ERC-20 | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| BNB Smart Chain | BEP-20 | `0x55d398326f99059fF775485246999027B3197955` |
| Tron | TRC-20 | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| Solana | SPL | `Es9vMFrzaCER1n8BDSC7G6T4k6xJzQvGkX6pY7hV7Z` |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Express API   │────▶│  Session Service  │────▶│   PostgreSQL     │
│  /create-session│     │  HD Derivation    │     │  (Prisma ORM)    │
│  /session/:id   │     └──────────────────┘     └──────────────────┘
│  /health        │              │                        │
└─────────────────┘              │                        │
        │                        ▼                        │
        │              ┌──────────────────┐               │
        │              │  Blockchain       │               │
        │              │  Listeners        │◀──────────────┘
        │              │  (ETH/BSC/TRX/SOL)│
        │              └──────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│  WebSocket       │◀───│  Verification     │
│  Server (/ws)    │     │  + Sweep Service  │
└─────────────────┘     └──────────────────┘
```

## Quick Start

### Prerequisites
- Node.js >= 18
- PostgreSQL
- BIP-39 mnemonic phrase

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Start development server
npm run dev
```

### Production

```bash
npm run build
npx prisma migrate deploy
npm start
```

## API Endpoints

### `POST /api/create-session`

Creates a new deposit session with a unique HD-derived address.

**Request:**
```json
{
  "chain": "ETHEREUM"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "depositAddress": "0x...",
    "chain": "ETHEREUM",
    "requiredAmount": "1",
    "expiresAt": "2025-01-01T00:05:00.000Z"
  }
}
```

### `GET /api/session/:id`

Get session status and details.

### `GET /api/health`

Health check endpoint.

## WebSocket

Connect to `ws://host:port/ws?session_id=<SESSION_ID>` to receive real-time verification events:

```json
{
  "type": "session_verified",
  "session_id": "uuid",
  "status": "verified",
  "tx_hash": "0x..."
}
```

## Session Flow

1. Client calls `POST /create-session` → receives deposit address
2. Client connects to WebSocket with session_id
3. User sends USDT to the deposit address
4. Blockchain listener detects the transfer
5. System waits for required confirmations
6. Session marked as `VERIFIED`, WebSocket event emitted
7. Sweeper moves USDT from deposit address to master wallet
8. If 5 minutes pass with no payment → session marked `EXPIRED`

## Folder Structure

```
src/
├── config/
│   ├── chains.ts        # Chain-specific configurations
│   ├── constants.ts     # Contract addresses, ABIs, HD paths
│   └── env.ts           # Zod-validated environment config
├── lib/
│   ├── prisma.ts        # Database client singleton
│   └── websocket.ts     # WebSocket server & event emitter
├── middleware/
│   ├── errorHandler.ts  # Error handling & async wrapper
│   ├── rateLimiter.ts   # Rate limiting config
│   └── validate.ts      # Zod validation middleware
├── routes/
│   └── session.ts       # API endpoints
├── services/
│   ├── listeners/
│   │   ├── base.ts      # Abstract listener base class
│   │   ├── evm.ts       # Ethereum & BSC listener
│   │   ├── tron.ts      # Tron listener
│   │   ├── solana.ts    # Solana listener
│   │   └── index.ts     # Listener orchestrator
│   ├── sweeper/
│   │   ├── evm.ts       # Ethereum & BSC sweeper
│   │   ├── tron.ts      # Tron sweeper
│   │   ├── solana.ts    # Solana sweeper
│   │   └── index.ts     # Sweeper orchestrator
│   ├── wallet/
│   │   ├── hd.ts        # HD derivation logic
│   │   └── index.ts     # Wallet exports
│   ├── expiry.ts        # Session expiry service
│   └── session.ts       # Session business logic
├── types/
│   └── index.ts         # TypeScript interfaces
├── utils/
│   └── logger.ts        # Winston logger
└── server.ts            # Application entry point
```

## Security Features

- **HD Derivation**: Unique address per session, no key reuse
- **Atomic Index Allocation**: Database transaction prevents derivation index collision
- **Optimistic Locking**: Prevents double-verification of sessions
- **Rate Limiting**: Per-endpoint rate limits
- **Input Validation**: Zod schemas on all inputs
- **Helmet**: Security headers
- **Graceful Shutdown**: Proper cleanup on SIGINT/SIGTERM

## License

MIT
