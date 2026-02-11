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
import { Chain } from '@prisma/client';
import { chainConfigs } from '../../config/chains';
import { USDT_CONTRACTS, USDT_DECIMALS } from '../../config/constants';
import { deriveWallet, getMasterWalletKeys } from '../wallet';
import { SweepResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Solana Sweeper
 *
 * For a given deposit session:
 * 1. Check SPL USDT balance in the deposit wallet's token account
 * 2. If balance > 0, check SOL balance for transaction fees
 * 3. If insufficient SOL, send from master wallet
 * 4. Transfer all USDT to master wallet's token account
 */
export async function sweepSolana(
    depositAddress: string,
    derivationIndex: number
): Promise<SweepResult | null> {
    const config = chainConfigs.SOLANA;
    const connection = new Connection(config.rpcUrl, 'confirmed');

    const depositKeys = deriveWallet('SOLANA', derivationIndex);
    const masterKeys = getMasterWalletKeys('SOLANA');

    const depositKeypair = Keypair.fromSecretKey(
        Buffer.from(depositKeys.privateKey, 'hex')
    );
    const masterKeypair = Keypair.fromSecretKey(
        Buffer.from(masterKeys.privateKey, 'hex')
    );

    const usdtMint = new PublicKey(USDT_CONTRACTS.SOLANA);
    const depositPubkey = new PublicKey(depositAddress);
    const masterPubkey = masterKeypair.publicKey;

    try {
        // 1. Get deposit wallet's USDT token account
        const depositTokenAccount = await getAssociatedTokenAddress(
            usdtMint,
            depositPubkey
        );

        let tokenAccountInfo;
        try {
            tokenAccountInfo = await getAccount(connection, depositTokenAccount);
        } catch {
            logger.info('[SOLANA Sweeper] No token account found', {
                depositAddress,
            });
            return null;
        }

        const balance = tokenAccountInfo.amount;
        if (balance === 0n) {
            logger.info('[SOLANA Sweeper] No USDT balance to sweep', {
                depositAddress,
            });
            return null;
        }

        const decimals = USDT_DECIMALS.SOLANA;
        const amount = Number(balance) / Math.pow(10, decimals);

        logger.info('[SOLANA Sweeper] Found USDT balance', {
            depositAddress,
            amount,
        });

        // 2. Check SOL balance for fees
        const solBalance = await connection.getBalance(depositPubkey);
        const requiredSol = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL for fees

        let gasTxHash: string | undefined;

        // 3. Send SOL if needed
        if (solBalance < requiredSol) {
            const solDeficit = requiredSol - solBalance;
            logger.info('[SOLANA Sweeper] Sending SOL for fees', {
                depositAddress,
                solDeficit: solDeficit / LAMPORTS_PER_SOL,
            });

            const gasTransaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: masterPubkey,
                    toPubkey: depositPubkey,
                    lamports: Math.ceil(solDeficit),
                })
            );

            gasTxHash = await sendAndConfirmTransaction(
                connection,
                gasTransaction,
                [masterKeypair]
            );

            logger.info('[SOLANA Sweeper] SOL sent', { gasTxHash });
        }

        // 4. Ensure master wallet has a USDT token account
        const masterTokenAccount = await getAssociatedTokenAddress(
            usdtMint,
            masterPubkey
        );

        const transaction = new Transaction();

        // Check if master token account exists, create if not
        try {
            await getAccount(connection, masterTokenAccount);
        } catch {
            logger.info('[SOLANA Sweeper] Creating master token account');
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    depositPubkey, // payer
                    masterTokenAccount,
                    masterPubkey,
                    usdtMint,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
            );
        }

        // Add USDT transfer instruction
        transaction.add(
            createTransferInstruction(
                depositTokenAccount,
                masterTokenAccount,
                depositPubkey,
                balance,
                [],
                TOKEN_PROGRAM_ID
            )
        );

        const sweepTxHash = await sendAndConfirmTransaction(
            connection,
            transaction,
            [depositKeypair]
        );

        logger.info('[SOLANA Sweeper] USDT swept successfully', {
            depositAddress,
            masterAddress: masterPubkey.toBase58(),
            amount,
            sweepTxHash,
        });

        return {
            sessionId: '',
            chain: 'SOLANA',
            fromAddress: depositAddress,
            toAddress: masterPubkey.toBase58(),
            amount: amount.toString(),
            gasTxHash,
            sweepTxHash,
        };
    } catch (error) {
        logger.error('[SOLANA Sweeper] Error sweeping', {
            depositAddress,
            error: (error as Error).message,
        });
        return null;
    }
}
