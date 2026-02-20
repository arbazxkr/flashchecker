
import { ethers } from 'ethers';
import { env } from '../src/config/env';

const TARGETS = [
    '0x9e9DD7cBF4f55C6a2463B6822E638Ab1c3D7f9c6'
];

async function main() {
    console.log(`Checking target wallets on BSC and ETH...`);

    // Providers (Simpler Public RPCs to avoid hang)
    const bscProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const ethProvider = new ethers.JsonRpcProvider('https://cloudflare-eth.com');

    // Contracts
    const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';
    const USDT_ETH = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const ABI = ['function balanceOf(address) view returns (uint256)'];

    const bscUSDT = new ethers.Contract(USDT_BSC, ABI, bscProvider);
    const ethUSDT = new ethers.Contract(USDT_ETH, ABI, ethProvider);

    for (const addr of TARGETS) {
        console.log(`\nAnalyzing ${addr}...`);

        // BSC Check
        try {
            const bnb = ethers.formatEther(await bscProvider.getBalance(addr));
            const busdt = ethers.formatUnits(await bscUSDT.balanceOf(addr), 18);
            const bscBlock = await bscProvider.getBlockNumber();
            console.log(`[BSC @ ${bscBlock}] BNB: ${bnb} | USDT: ${busdt}`);
        } catch (e) {
            console.error(`[BSC] Check failed: ${(e as Error).message}`);
        }

        // ETH Check
        try {
            const eth = ethers.formatEther(await ethProvider.getBalance(addr));
            const eusdt = ethers.formatUnits(await ethUSDT.balanceOf(addr), 6);
            const ethBlock = await ethProvider.getBlockNumber();
            console.log(`[ETH @ ${ethBlock}] ETH: ${eth} | USDT: ${eusdt}`);
        } catch (e) {
            console.error(`[ETH] Check failed: ${(e as Error).message}`);
        }
    }
}

main();
