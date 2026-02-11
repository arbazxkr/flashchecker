import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    MASTER_MNEMONIC: z.string().min(10),

    // Reliable Public RPCs (LlamaNodes, Ankr, etc.)
    ETH_RPC_URL: z.string().url().default('https://eth.llamarpc.com'),
    ETH_WS_URL: z.string().default('wss://ethereum-rpc.publicnode.com'),

    BSC_RPC_URL: z.string().url().default('https://binance.llamarpc.com'),
    BSC_WS_URL: z.string().default('wss://bsc-rpc.publicnode.com'),

    TRON_API_URL: z.string().url().default('https://api.trongrid.io'),
    TRON_API_KEY: z.string().optional().default(''), // Optional for public

    SOLANA_RPC_URL: z.string().url().default('https://mainnet.helius-rpc.com/?api-key=41f795eb-27ed-43ad-b28b-860e88d5f95c'),
    SOLANA_WS_URL: z.string().default('wss://mainnet.helius-rpc.com/?api-key=41f795eb-27ed-43ad-b28b-860e88d5f95c'),

    ETH_CONFIRMATIONS: z.coerce.number().default(12),
    BSC_CONFIRMATIONS: z.coerce.number().default(15),
    TRON_CONFIRMATIONS: z.coerce.number().default(19),
    SOLANA_CONFIRMATIONS: z.coerce.number().default(31),

    SESSION_EXPIRY_MINUTES: z.coerce.number().default(5),
    REQUIRED_AMOUNT_USDT: z.coerce.number().default(1),

    SWEEPER_INTERVAL_MS: z.coerce.number().default(60000),
    SWEEPER_ENABLED: z
        .string()
        .transform((v) => v === 'true')
        .default('true'),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),

    LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
