import { Chain } from '@prisma/client';
import { chainConfigs } from '../../config/chains';
import { USDT_CONTRACTS, USDT_DECIMALS } from '../../config/constants';
import { deriveWallet, getMasterWalletKeys } from '../wallet';
import { SweepResult } from '../../types';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

/**
 * Tron Sweeper
 *
 * For a given deposit session:
 * 1. Check TRC20 USDT balance at the deposit address
 * 2. If balance > 0, check TRX balance for energy/bandwidth
 * 3. If insufficient TRX, send from master wallet
 * 4. Transfer all USDT to the master wallet
 */
export async function sweepTron(
    depositAddress: string,
    derivationIndex: number
): Promise<SweepResult | null> {
    const TronWeb = require('tronweb');
    const config = chainConfigs.TRON;

    const depositKeys = deriveWallet('TRON', derivationIndex);
    const masterKeys = getMasterWalletKeys('TRON');

    try {
        // Initialize TronWeb with deposit wallet's private key
        const tronWeb = new TronWeb({
            fullHost: config.rpcUrl,
            headers: { 'TRON-PRO-API-KEY': env.TRON_API_KEY },
            privateKey: depositKeys.privateKey,
        });

        // 1. Check TRC20 USDT balance
        const contract = await tronWeb.contract().at(USDT_CONTRACTS.TRON);
        const balanceRaw = await contract.balanceOf(depositAddress).call();
        const balance = BigInt(balanceRaw.toString());

        if (balance === 0n) {
            logger.info('[TRON Sweeper] No USDT balance to sweep', {
                depositAddress,
            });
            return null;
        }

        const decimals = USDT_DECIMALS.TRON;
        const amount = Number(balance) / Math.pow(10, decimals);

        logger.info('[TRON Sweeper] Found USDT balance', {
            depositAddress,
            amount,
        });

        // 2. Check TRX balance (need ~15 TRX for TRC20 transfer)
        const trxBalance = await tronWeb.trx.getBalance(depositAddress);
        const requiredTrx = 15_000_000; // 15 TRX in SUN

        let gasTxHash: string | undefined;

        // 3. Send TRX if needed
        if (trxBalance < requiredTrx) {
            const trxDeficit = requiredTrx - trxBalance;
            logger.info('[TRON Sweeper] Sending TRX for energy', {
                depositAddress,
                trxDeficit: trxDeficit / 1_000_000,
            });

            // Use master wallet to send TRX
            const masterTronWeb = new TronWeb({
                fullHost: config.rpcUrl,
                headers: { 'TRON-PRO-API-KEY': env.TRON_API_KEY },
                privateKey: masterKeys.privateKey,
            });

            const masterBase58 = tronWeb.address.fromHex(masterKeys.address);
            const depositBase58 = tronWeb.address.fromHex(depositAddress);

            const gasTx = await masterTronWeb.trx.sendTransaction(
                depositBase58,
                trxDeficit
            );

            gasTxHash = gasTx.txid;
            logger.info('[TRON Sweeper] TRX sent', { gasTxHash });

            // Wait for the TRX to arrive
            await new Promise((resolve) => setTimeout(resolve, 6000));
        }

        // 4. Transfer USDT to master wallet
        const masterBase58 = tronWeb.address.fromHex(masterKeys.address);

        const sweepTx = await contract.transfer(masterBase58, balance.toString()).send({
            feeLimit: 30_000_000, // 30 TRX fee limit
        });

        logger.info('[TRON Sweeper] USDT swept successfully', {
            depositAddress,
            masterAddress: masterBase58,
            amount,
            sweepTxHash: sweepTx,
        });

        return {
            sessionId: '',
            chain: 'TRON',
            fromAddress: depositAddress,
            toAddress: masterBase58,
            amount: amount.toString(),
            gasTxHash,
            sweepTxHash: sweepTx,
        };
    } catch (error) {
        logger.error('[TRON Sweeper] Error sweeping', {
            depositAddress,
            error: (error as Error).message,
        });
        return null;
    }
}
