import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { Chain } from '@prisma/client';
import { chainConfigs } from '../../config/chains';
import { ERC20_ABI, USDT_DECIMALS } from '../../config/constants';
import { deriveWallet, getMasterWalletKeys } from '../wallet';
import { SweepResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * EVM Sweeper (Ethereum & BSC)
 *
 * For a given deposit session:
 * 1. Check USDT balance at the deposit address
 * 2. If balance > 0, check native gas balance
 * 3. If insufficient gas, send gas from master wallet
 * 4. Transfer all USDT to the master wallet address
 */
export async function sweepEVM(
    chain: Chain,
    depositAddress: string,
    derivationIndex: number
): Promise<SweepResult | null> {
    const config = chainConfigs[chain];
    const provider = new JsonRpcProvider(config.rpcUrl);

    const depositWalletKeys = deriveWallet(chain, derivationIndex);
    const masterKeys = getMasterWalletKeys(chain);

    const usdtContract = new Contract(config.usdtContract, ERC20_ABI, provider);

    try {
        // 1. Check USDT balance
        const usdtBalance: bigint = await usdtContract.balanceOf(depositAddress);

        if (usdtBalance === 0n) {
            logger.info(`[${chain} Sweeper] No USDT balance to sweep`, {
                depositAddress,
            });
            return null;
        }

        const decimals = USDT_DECIMALS[chain];
        const amountFormatted = ethers.formatUnits(usdtBalance, decimals);

        logger.info(`[${chain} Sweeper] Found USDT balance`, {
            depositAddress,
            amount: amountFormatted,
        });

        // 2. Check gas balance
        const depositWallet = new Wallet(depositWalletKeys.privateKey, provider);
        const gasBalance = await provider.getBalance(depositAddress);

        // Estimate gas for ERC20 transfer
        const gasEstimate = await usdtContract
            .connect(depositWallet)
            .getFunction('transfer')
            .estimateGas(masterKeys.address, usdtBalance);
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');
        const requiredGas = gasEstimate * gasPrice * 12n / 10n; // 1.2x buffer

        let gasTxHash: string | undefined;

        // 3. Send gas if needed
        if (gasBalance < requiredGas) {
            const gasDeficit = requiredGas - gasBalance;
            logger.info(`[${chain} Sweeper] Sending gas to deposit address`, {
                depositAddress,
                gasDeficit: ethers.formatEther(gasDeficit),
            });

            const masterWallet = new Wallet(masterKeys.privateKey, provider);
            const gasTx = await masterWallet.sendTransaction({
                to: depositAddress,
                value: gasDeficit,
            });

            const gasReceipt = await gasTx.wait();
            gasTxHash = gasReceipt?.hash;

            logger.info(`[${chain} Sweeper] Gas sent`, {
                gasTxHash,
                amount: ethers.formatEther(gasDeficit),
            });

            // Wait a moment for the gas to be available
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // 4. Transfer USDT to master wallet
        const connectedContract = usdtContract.connect(depositWallet) as Contract;
        const sweepTx = await connectedContract.getFunction('transfer')(
            masterKeys.address,
            usdtBalance
        );

        const sweepReceipt = await sweepTx.wait();

        logger.info(`[${chain} Sweeper] USDT swept successfully`, {
            depositAddress,
            masterAddress: masterKeys.address,
            amount: amountFormatted,
            sweepTxHash: sweepReceipt.hash,
        });

        return {
            sessionId: '', // Will be filled by caller
            chain,
            fromAddress: depositAddress,
            toAddress: masterKeys.address,
            amount: amountFormatted,
            gasTxHash,
            sweepTxHash: sweepReceipt.hash,
        };
    } catch (error) {
        logger.error(`[${chain} Sweeper] Error sweeping`, {
            depositAddress,
            error: (error as Error).message,
        });
        return null;
    }
}
