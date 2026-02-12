
const { ethers } = require('ethers');
const { chainConfigs } = require('../src/config/chains');
const { env } = require('../src/config/env');

// Force reliable RPC
const PROVIDER_URL = 'https://bsc-dataseed.binance.org/';

const MASTER_ADDRESS = '0x0258eF60991627A9314571e7d07aE00FB3B9FA29';

async function main() {
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    try {
        const balance = await provider.getBalance(MASTER_ADDRESS);
        const fmt = ethers.formatEther(balance);

        console.log(`Checking Master Wallet: ${MASTER_ADDRESS}`);
        console.log(`- Balance: ${fmt} BNB`);

        if (balance > 0n) {
            console.log('✅ SUFFICIENT GAS! Ready to sweep.');
        } else {
            console.log('❌ INSUFFICIENT GAS: Still 0 BNB.');
        }
    } catch (e: any) {
        console.log('Error:', e.message);
    }
}

main();
