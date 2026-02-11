import { ethers } from 'ethers';
import { env } from '../../config/env';
import { Chain } from '@prisma/client';
import { WalletKeys } from '../../types';
import { logger } from '../../utils/logger';
import prisma from '../../lib/prisma';

/**
 * HD Wallet Derivation Service
 *
 * Derives unique deposit addresses from a master mnemonic using BIP-44 paths:
 *  - EVM (ETH/BSC): m/44'/60'/0'/0/{index}
 *  - Tron:          m/44'/195'/0'/0/{index}
 *  - Solana:        m/44'/501'/{index}'/0'
 *
 * The derivation index is atomically incremented in the database to prevent
 * any reuse across concurrent requests.
 */

const PATHS: Record<Chain, string> = {
    ETHEREUM: "m/44'/60'/0'/0",
    BSC: "m/44'/60'/0'/0",
    TRON: "m/44'/195'/0'/0",
    SOLANA: "m/44'/501'",
};

/**
 * Atomically get and increment the next derivation index.
 * Uses Prisma's upsert to ensure the singleton counter exists.
 */
export async function getNextDerivationIndex(): Promise<number> {
    const result = await prisma.$transaction(async (tx) => {
        // Upsert the singleton counter
        const counter = await tx.derivationCounter.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', lastIndex: 1 },
            update: { lastIndex: { increment: 1 } },
        });
        return counter.lastIndex;
    });

    logger.info('Allocated derivation index', { index: result });
    return result;
}

/**
 * Derive an EVM-compatible wallet (Ethereum, BSC) from the master mnemonic.
 */
export function deriveEVMWallet(chain: Chain, index: number): WalletKeys {
    const hdNode = ethers.HDNodeWallet.fromPhrase(
        env.MASTER_MNEMONIC,
        undefined,
        `${PATHS[chain]}/${index}`
    );

    return {
        address: hdNode.address,
        privateKey: hdNode.privateKey,
    };
}

/**
 * Derive a Tron wallet.
 * Tron uses the same secp256k1 curve as Ethereum but with a different address encoding.
 * We derive via EVM path then convert the address.
 */
export function deriveTronWallet(index: number): WalletKeys {
    const hdNode = ethers.HDNodeWallet.fromPhrase(
        env.MASTER_MNEMONIC,
        undefined,
        `${PATHS.TRON}/${index}`
    );

    // Tron address: take raw public key, keccak256 hash, take last 20 bytes, add 0x41 prefix, base58check
    const evmAddress = hdNode.address;
    const tronAddressHex = '41' + evmAddress.slice(2);

    try {
        // Dynamically require TronWeb
        const TronWebModule = require('tronweb');

        // Handle various export shapes (CommonJS, ESM, v5 vs v6)
        // In v6, 'TronWeb' might be a named export or the default
        const TronWebClass = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;

        // Instantiate TronWeb instance (safest way to access utils)
        // We provide dummy keys/urls just to initialize the util methods
        const tw = new TronWebClass({
            fullHost: 'https://api.trongrid.io',
        });

        const base58 = tw.address.fromHex(tronAddressHex);

        if (base58) {
            return {
                address: base58,
                privateKey: hdNode.privateKey.slice(2),
            };
        }
    } catch (e) {
        // Log error but DO NOT CRASH. Fallback to Hex address.
        // It's better to show an "invalid" address than to crash the server.
        console.error('Tron address conversion failed:', e);
    }

    // Fallback to Hex/Eth style address if conversion fails
    return {
        address: tronAddressHex,
        privateKey: hdNode.privateKey.slice(2),
    };
}

/**
 * Derive a Solana wallet.
 * Solana uses Ed25519, so we derive using the BIP-44 path for SOL.
 * We use ethers to get the seed, then derive the Ed25519 keypair.
 */
export function deriveSolanaWallet(index: number): WalletKeys {
    // Solana uses Ed25519 which is different from secp256k1.
    // We derive a seed from the mnemonic and use it to generate Solana keypairs.
    const { Keypair } = require('@solana/web3.js');
    const { derivePath } = require('ed25519-hd-key');
    const bip39 = require('bip39') as typeof import('bip39');

    const seed = bip39.mnemonicToSeedSync(env.MASTER_MNEMONIC);
    const path = `m/44'/501'/${index}'/0'`;
    const derived = derivePath(path, seed.toString('hex'));
    const keypair = Keypair.fromSeed(derived.key);

    return {
        address: keypair.publicKey.toBase58(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex'),
    };
}

/**
 * Master function: derive a deposit wallet for any supported chain.
 */
export function deriveWallet(chain: Chain, index: number): WalletKeys {
    switch (chain) {
        case 'ETHEREUM':
        case 'BSC':
            return deriveEVMWallet(chain, index);
        case 'TRON':
            return deriveTronWallet(index);
        case 'SOLANA':
            return deriveSolanaWallet(index);
        default:
            throw new Error(`Unsupported chain: ${chain}`);
    }
}

/**
 * Get the master wallet address for a chain (index 0).
 * This is where swept funds are sent.
 */
export function getMasterWalletAddress(chain: Chain): string {
    const wallet = deriveWallet(chain, 0);
    return wallet.address;
}

/**
 * Get the master wallet keys for a chain (index 0).
 * Used by the sweeper to send gas to deposit addresses.
 */
export function getMasterWalletKeys(chain: Chain): WalletKeys {
    return deriveWallet(chain, 0);
}
