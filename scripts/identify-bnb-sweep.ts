
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

async function main() {
    const txHashes = process.argv.slice(2);
    if (txHashes.length === 0) {
        console.error('Usage: npx ts-node scripts/identify-bnb-sweep.ts <TX_HASH_1> <TX_HASH_2> ...');
        process.exit(1);
    }

    // BSC Provider (Try ETH if BSC fails?)
    // const provider = new ethers.JsonRpcProvider(env.BSC_RPC_URL);
    const provider = new ethers.JsonRpcProvider(env.ETH_RPC_URL);

    try {
        const block = await provider.getBlockNumber();
        console.log(`Connected to RPC. Block Height: ${block}`);
    } catch (e) {
        console.error(`RPC Connection Failed: ${(e as Error).message}`);
        process.exit(1);
    }

    console.log(`Checking ${txHashes.length} transactions...`);

    for (const txHash of txHashes) {
        console.log(`\nAnalyzing Tx: ${txHash}`);
        try {
            const tx = await provider.getTransaction(txHash);
            if (!tx) {
                console.error(`❌ Tx not found on BSC.`);
                continue;
            }

            const toAddress = tx.to;

            if (!toAddress) {
                console.log(`- Contract Creation Tx (No 'to' address). Skipping.`);
                continue;
            }


            console.log(`- To Address (Contract/User): ${toAddress}`);

            let searchAddress = toAddress;

            // Check if it's an ERC20 Transfer (method 0xa9059cbb)
            if (tx.data && tx.data.startsWith('0xa9059cbb')) {
                try {
                    const iface = new ethers.Interface(['function transfer(address to, uint amount)']);
                    const decoded = iface.decodeFunctionData('transfer', tx.data);
                    searchAddress = decoded[0];
                    console.log(`- 📦 Decoded ERC20 Transfer to: ${searchAddress}`);
                } catch (e) {
                    console.warn(`- Failed to decode ERC20 data: ${(e as Error).message}`);
                }
            }

            // Find session in DB
            const session = await prisma.depositSession.findFirst({
                where: { depositAddress: { equals: searchAddress, mode: 'insensitive' } },
            });

            if (session) {
                console.log(`✅ Found Session!`);
                console.log(`- Session ID: ${session.id}`);
                console.log(`- Derivation Index: ${session.derivationIndex}`);
                console.log(`- Required Amount: ${session.requiredAmount}`);
                console.log(`- Status: ${session.status}`);
                console.log(`\n👉 TO SWEEP run:`);
                console.log(`npx ts-node scripts/sweep-evm.ts BSC ${session.derivationIndex}`);
            } else {
                console.error(`❌ No session found for address ${toAddress} in DB.`);
            }

        } catch (e) {
            console.error(`❌ Error: ${(e as Error).message}`);
        }
    }

    await prisma.$disconnect();
}

main();
