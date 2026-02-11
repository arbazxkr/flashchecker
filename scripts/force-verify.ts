
import { PrismaClient } from '@prisma/client';
import { Connection, PublicKey } from '@solana/web3.js';
import { chainConfigs } from '../src/config/chains';
import { USDT_CONTRACTS, USDT_DECIMALS } from '../src/config/constants';

const prisma = new PrismaClient();

async function main() {
    const sessionId = process.argv[2];
    const txHash = process.argv[3];

    if (!sessionId || !txHash) {
        console.error('Usage: npx ts-node scripts/force-verify.ts <SESSION_ID> <TX_HASH>');
        process.exit(1);
    }

    console.log(`Verifying session ${sessionId} with tx ${txHash}...`);

    const session = await prisma.depositSession.findUnique({
        where: { id: sessionId },
    });

    if (!session) {
        console.error('Session not found');
        process.exit(1);
    }

    if (session.status === 'VERIFIED') {
        console.log('Session already VERIFIED!');
        process.exit(0);
    }

    // Verify on-chain data
    const connection = new Connection(chainConfigs.SOLANA.rpcUrl, 'confirmed');
    const tx = await connection.getParsedTransaction(txHash, {
        maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
        console.error('Transaction not found on-chain');
        process.exit(1);
    }

    // Check for USDT transfer to deposit address
    let validTransfer = false;
    let amount = 0;

    const depositAddress = session.depositAddress;
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];

    const preBalanceEnv = preBalances.find(b => b.owner === depositAddress && b.mint === USDT_CONTRACTS.SOLANA);
    const postBalanceEnv = postBalances.find(b => b.owner === depositAddress && b.mint === USDT_CONTRACTS.SOLANA);

    const preAmount = preBalanceEnv?.uiTokenAmount?.uiAmount || 0;
    const postAmount = postBalanceEnv?.uiTokenAmount?.uiAmount || 0;

    amount = postAmount - preAmount;

    if (amount > 0) {
        console.log(`Found valid USDT transfer of ${amount}`);
        validTransfer = true;
    } else {
        console.error('No increase in USDT balance for deposit address found in this transaction.');
        // Maybe it's a direct transfer? But checks owner.
    }

    if (validTransfer) {
        if (amount < Number(session.requiredAmount)) {
            console.warn(`Amount ${amount} is less than required ${session.requiredAmount}`);
        }

        console.log('Marking session as VERIFIED...');
        await prisma.depositSession.update({
            where: { id: sessionId },
            data: {
                status: 'VERIFIED',
                txHash: txHash,
                receivedAmount: amount,
            },
        });
        console.log('✅ Success!');
    } else {
        console.error('❌ Verification failed: Transaction does not credit deposit address with USDT.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
