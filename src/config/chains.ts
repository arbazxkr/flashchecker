import { env } from './env';

export interface ChainConfig {
    name: string;
    rpcUrl: string;
    wsUrl?: string;
    usdtContract: string;
    confirmations: number;
    decimals: number;
    hdPath: string;
}

export const chainConfigs: Record<string, ChainConfig> = {
    ETHEREUM: {
        name: 'Ethereum',
        rpcUrl: env.ETH_RPC_URL,
        wsUrl: env.ETH_WS_URL,
        usdtContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        confirmations: env.ETH_CONFIRMATIONS,
        decimals: 6,
        hdPath: "m/44'/60'/0'/0",
    },
    BSC: {
        name: 'BNB Smart Chain',
        rpcUrl: env.BSC_RPC_URL,
        wsUrl: env.BSC_WS_URL,
        usdtContract: '0x55d398326f99059fF775485246999027B3197955',
        confirmations: env.BSC_CONFIRMATIONS,
        decimals: 18,
        hdPath: "m/44'/60'/0'/0",
    },
    TRON: {
        name: 'Tron',
        rpcUrl: env.TRON_API_URL,
        usdtContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        confirmations: env.TRON_CONFIRMATIONS,
        decimals: 6,
        hdPath: "m/44'/195'/0'/0",
    },
    SOLANA: {
        name: 'Solana',
        rpcUrl: env.SOLANA_RPC_URL,
        wsUrl: env.SOLANA_WS_URL,
        usdtContract: 'Es9vMFrzaCER1n8BDSC7G6T4k6xJzQvGkX6pY7hV7Z',
        confirmations: env.SOLANA_CONFIRMATIONS,
        decimals: 6,
        hdPath: "m/44'/501'",
    },
};

export const SUPPORTED_CHAINS = Object.keys(chainConfigs);
