
// Convert to CommonJS style to control execution order (force RPC override)
const { chainConfigs } = require('../src/config/chains');

// FORCE Public RPC to bypass RockX/ts-node issues
chainConfigs.BSC.rpcUrl = 'https://bsc-dataseed.binance.org/';
console.log('Using Forced RPC for BSC:', chainConfigs.BSC.rpcUrl);

const { sweepEVM } = require('../src/services/sweeper/evm');
const { deriveWallet } = require('../src/services/wallet');

async function main() {
    const chainStr = process.argv[2];
    const indexStr = process.argv[3];

    if (!chainStr || !indexStr) {
        console.error('Usage: Check args');
        process.exit(1);
    }

    const chain = chainStr.toUpperCase();
    // Handle aliases manually if enum not used
    const validChain = (chain === 'BNB' ? 'BSC' : chain);
    const index = parseInt(indexStr, 10);

    try {
        const wallet = deriveWallet(validChain, index);
        console.log(`Sweeping ${validChain} Index ${index} -> ${wallet.address}`);

        const result = await sweepEVM(validChain, wallet.address, index);

        if (result) {
            console.log('✅ SUCCESS!');
            console.log(result);
        } else {
            console.log('❌ FAILED: returned null (no funds or error logged)');
        }
    } catch (e) {
        console.error(e);
    }
}

main();
