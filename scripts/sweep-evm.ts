
import { sweepEVM } from '../src/services/sweeper/evm';
import { deriveWallet } from '../src/services/wallet';
import { Chain } from '@prisma/client';

async function main() {
    const chainStr = process.argv[2];
    const indexStr = process.argv[3];

    if (!chainStr || !indexStr) {
        console.error('Usage: npx ts-node scripts/sweep-evm.ts <CHAIN> <INDEX>');
        console.error('Example: npx ts-node scripts/sweep-evm.ts BSC 62');
        process.exit(1);
    }

    const chain = chainStr.toUpperCase() as Chain;
    const index = parseInt(indexStr, 10);

    if (isNaN(index)) {
        console.error('Invalid index');
        process.exit(1);
    }

    console.log(`Calculating address for ${chain} Index ${index}...`);
    try {
        const wallet = deriveWallet(chain, index);
        console.log(`Target Address: ${wallet.address}`);

        console.log('Starting Sweep...');
        const result = await sweepEVM(chain, wallet.address, index);

        if (result) {
            console.log('\n✅ SWEEP SUCCESS!');
            console.log(`- Tx Hash: ${result.sweepTxHash}`);
            console.log(`- Amount: ${result.amount} USDT`);
            console.log(`- To Master: ${result.toAddress}`);
            if (result.gasTxHash) {
                console.log(`- Gas Sent Tx: ${result.gasTxHash}`);
            }
        } else {
            console.log('\n❌ Sweep failed or no funds found.');
        }
    } catch (error) {
        console.error(`\n❌ Error: ${(error as Error).message}`);
    }
}

main();
