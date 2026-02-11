
import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    getAccount,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { chainConfigs } from '../src/config/chains';
import { deriveWallet, getMasterWalletKeys } from '../src/services/wallet';

async function main() {
    const address = process.argv[2];
    const indexStr = process.argv[3];
    const mintStr = process.argv[4];

    if (!address || !indexStr || !mintStr) {
        console.error('Usage: npx ts-node scripts/sweep-custom.ts <ADDRESS> <DERIVATION_INDEX> <MINT_ADDRESS>');
        process.exit(1);
    }

    const derivationIndex = parseInt(indexStr, 10);
    const mintAddress = new PublicKey(mintStr);
    const depositAddress = new PublicKey(address);

    console.log(`Sweeping Custom Token...`);
    console.log(`Address: ${address} (Index: ${derivationIndex})`);
    console.log(`Mint: ${mintStr}`);

    const config = chainConfigs.SOLANA;
    const connection = new Connection(config.rpcUrl, 'confirmed');

    const depositKeys = deriveWallet('SOLANA', derivationIndex);
    const masterKeys = getMasterWalletKeys('SOLANA');

    const depositKeypair = Keypair.fromSecretKey(Buffer.from(depositKeys.privateKey, 'hex'));
    const masterKeypair = Keypair.fromSecretKey(Buffer.from(masterKeys.privateKey, 'hex'));
    const masterPubkey = masterKeypair.publicKey;

    // 1. Get Deposit Token Account
    const depositTokenAccount = await getAssociatedTokenAddress(mintAddress, depositAddress);

    try {
        const accountInfo = await getAccount(connection, depositTokenAccount);
        const balance = accountInfo.amount;

        if (balance === 0n) {
            console.log('❌ Token balance is 0. Nothing to sweep.');
            return;
        }

        console.log(`✅ Found Balance: ${balance.toString()} (Raw Units)`);

        // 2. Check SOL for Gas
        const solBalance = await connection.getBalance(depositAddress);
        const requiredSol = 0.01 * LAMPORTS_PER_SOL;

        if (solBalance < requiredSol) {
            console.log(`⚠️ Low SOL (${solBalance / LAMPORTS_PER_SOL}). Sending gas from Master...`);
            const tx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: masterPubkey,
                    toPubkey: depositAddress,
                    lamports: requiredSol - solBalance,
                })
            );
            await sendAndConfirmTransaction(connection, tx, [masterKeypair]);
            console.log('✅ Gas sent.');
        }

        // 3. Ensure Master has Token Account
        const masterTokenAccount = await getAssociatedTokenAddress(mintAddress, masterPubkey);
        const transaction = new Transaction();

        try {
            await getAccount(connection, masterTokenAccount);
        } catch {
            console.log('⚠️ Master token account missing. Creating...');
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    depositAddress, // Payer (Deposit wallet has gas now)
                    masterTokenAccount,
                    masterPubkey,
                    mintAddress,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
            );
        }

        // 4. Transfer
        transaction.add(
            createTransferInstruction(
                depositTokenAccount,
                masterTokenAccount,
                depositAddress,
                balance,
                [],
                TOKEN_PROGRAM_ID
            )
        );

        console.log('🚀 Sending Sweep Transaction...');
        const sig = await sendAndConfirmTransaction(connection, transaction, [depositKeypair]);

        console.log(`✅ SUCCESS! Tx Hash: ${sig}`);

    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
}

main();
