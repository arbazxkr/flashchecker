export const USDT_CONTRACTS = {
    ETHEREUM: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    BSC: '0x55d398326f99059fF775485246999027B3197955',
    TRON: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    SOLANA: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
} as const;

// Standard ERC20/BEP20 Transfer event signature
export const ERC20_TRANSFER_TOPIC =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Minimal ERC20 ABI for Transfer events and balance/transfer calls
export const ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
] as const;

// USDT decimals per chain
export const USDT_DECIMALS: Record<string, number> = {
    ETHEREUM: 6,
    BSC: 18,
    TRON: 6,
    SOLANA: 6,
};

// HD derivation path base (BIP-44)
// m/44'/60'/0'/0/{index} for EVM
// m/44'/195'/0'/0/{index} for Tron
// m/44'/501'/{index}'/0' for Solana
export const HD_PATHS = {
    ETHEREUM: "m/44'/60'/0'/0",
    BSC: "m/44'/60'/0'/0",
    TRON: "m/44'/195'/0'/0",
    SOLANA: "m/44'/501'",
} as const;
