
import { PrismaClient } from '@prisma/client';
import { sweepSolana } from '../src/services/sweeper/solana';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
    const address = process.argv[2];
    const manualIndex = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

    if (!address) {
        console.error('Please provide a Solana deposit address to sweep.');
        console.error('Usage: npx ts-node scripts/sweep-solana.ts <ADDRESS> [OPTIONAL_INDEX]');
        process.exit(1);
    }

    console.log(`Looking up session for address: ${address}...`);

    let derivationIndex: number | undefined;

    try {
        const session = await prisma.depositSession.findFirst({
            where: { depositAddress: address },
        });

        if (session) {
            console.log(`✅ Found session in DB! Derivation Index: ${session.derivationIndex}`);
            derivationIndex = session.derivationIndex;
        } else {
            console.warn('⚠️ Address not found in database session records.');
        }
    } catch (e) {
        console.warn('⚠️ Database lookup failed (ignoring).');
    }

    if (derivationIndex === undefined) {
        if (manualIndex !== undefined && !isNaN(manualIndex)) {
            console.log(`Using manually provided Derivation Index: ${manualIndex}`);
            derivationIndex = manualIndex;
        } else {
            console.error('❌ Address not found in DB and no manual index provided.');
            console.error('Cannot sweep because derivation index is unknown.');
            process.exit(1);
        }
    }

    console.log('Starting sweep process...');

    // Check Master Wallet Balance first
    const { getMasterWalletAddress } = require('../src/services/wallet');
    const { Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');
    const { chainConfigs } = require('../src/config/chains');

    const masterAddress = getMasterWalletAddress('SOLANA');
    console.log(`Master Wallet Address: ${masterAddress}`);

    try {
        const connection = new Connection(chainConfigs.SOLANA.rpcUrl);
        const balance = await connection.getBalance(new (require('@solana/web3.js').PublicKey)(masterAddress));
        console.log(`Master Wallet Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

        if (balance < 0.01 * LAMPORTS_PER_SOL) {
            console.warn('⚠️ Master Wallet has low SOL! Sweep may fail if deposit wallet needs gas.');
        }
    } catch (e) {
        console.warn('Failed to fetch master wallet balance:', e);
    }

    try {
        const result = await sweepSolana(address, derivationIndex);
        if (result) {
            console.log('✅ Sweep successful!');
            console.log(result);
        } else {
            console.log('⚠️ Sweep claimed success but returned null (check logs for details).');
            // Check logs might show "No USDT balance"
        }
    } catch (error) {
        console.error('❌ Sweep failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
