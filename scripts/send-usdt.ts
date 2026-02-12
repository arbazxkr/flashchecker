
const { ethers } = require('ethers');
const { env } = require('../src/config/env');

const TARGET = '0xfdFb8226FDF0618821Aa1190EDcf02E6778c0899';
const AMOUNT = '1.0';
// Force reliable RPC
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

async function main() {
    console.log(`Sending ${AMOUNT} USDT to ${TARGET}...`);

    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const wallet = ethers.Wallet.fromPhrase(env.MASTER_MNEMONIC).connect(provider);

    console.log(`From Master: ${wallet.address}`);

    const abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address) view returns (uint256)'
    ];
    const contract = new ethers.Contract(USDT_ADDRESS, abi, wallet);

    // Check balance
    const bal = await contract.balanceOf(wallet.address);
    const balFmt = ethers.formatUnits(bal, 18);
    console.log(`Master Balance: ${balFmt} USDT`);

    if (parseFloat(balFmt) < parseFloat(AMOUNT)) {
        console.error('❌ Insufficient USDT in Master Wallet! (Did the sweep confirm?)');
        process.exit(1);
    }

    try {
        const tx = await contract.transfer(TARGET, ethers.parseUnits(AMOUNT, 18));
        console.log(`✅ Tx Sent! Hash: ${tx.hash}`);
        console.log('Waiting for confirmation...');
        await tx.wait();
        console.log('Confirmed! 🚀');
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

main();
