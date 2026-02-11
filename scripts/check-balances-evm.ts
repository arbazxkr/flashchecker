
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

const USDT_ABI = ['function balanceOf(address) view returns (uint256)'];
// Updated to RockX from env (now fixed with /api)
const BSC_RPC = env.BSC_RPC_URL;
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

async function main() {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);

    console.log('Checking USDT balances for recent BSC sessions...');

    // Check last 20 sessions
    const sessions = await prisma.depositSession.findMany({
        where: { chain: 'BSC' },
        orderBy: { derivationIndex: 'desc' },
        take: 20
    });

    console.log(`Scanning ${sessions.length} addresses...`);

    for (const s of sessions) {
        try {
            const balance: bigint = await usdt.balanceOf(s.depositAddress);
            const formatted = ethers.formatUnits(balance, 18); // USDT on BSC is 18 decimals

            const usdtBalance: bigint = await usdt.balanceOf(s.depositAddress);
            const formattedUSDT = ethers.formatUnits(usdtBalance, 18);

            const nativeBalance: bigint = await provider.getBalance(s.depositAddress);
            const formattedNative = ethers.formatEther(nativeBalance);

            if (usdtBalance > 0n || nativeBalance > 0n) {
                console.log(`\n💰 FOUND FUNDS! Address: ${s.depositAddress} (Index ${s.derivationIndex})`);
                if (usdtBalance > 0n) console.log(`- USDT: ${formattedUSDT}`);
                if (nativeBalance > 0n) console.log(`- BNB: ${formattedNative}`);

                console.log(`👉 TO SWEEP (USDT Only): npx ts-node scripts/sweep-evm.ts BSC ${s.derivationIndex}`);
            } else {
                // console.log(`- ${s.depositAddress}: 0 USDT / 0 BNB`);
                process.stdout.write('.');
            }
        } catch (e) {
            console.error(`\n❌ Error checking ${s.depositAddress}: ${(e as Error).message}`);
        }
    }
    console.log('\nDone.');
    await prisma.$disconnect();
}

main();
