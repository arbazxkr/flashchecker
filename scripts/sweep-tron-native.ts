
const TronWeb = require('tronweb').TronWeb;
const { env } = require('../src/config/env');
const { deriveWallet } = require('../src/services/wallet'); // Adjust path? Service exports deriveWallet? 
// Actually src/services/wallet/index.ts exports it likely.

// Check if imports work with require. If not, I'll specificy path.
// src/services/wallet.ts might be TS. 

const INDICES = [115, 116];

async function main() {
    console.log(`Sweeping Native TRX from indices: ${INDICES.join(', ')}`);

    // Master Mnemonic -> Address
    const masterInfo = deriveWallet('TRON', 0); // Is 0 master? No. deriveWallet uses master mnemonic and index.
    // Master is usually internal logic.
    // Let's manually derive master address from mnemonic if needed, or use a hardcoded target?
    // User wants to sweep TO Master.
    // I need MASTER Address.
    // I can get it from logs or derive it.
    // Let's assume I can get it.
    // Or just sweep to the first address "T..." from environment?
    // I'll derive Master Address properly.

    // Wait, deriveWallet uses Master Mnemonic + Index.
    // Master Wallet itself is usually Path m/44'/195'/0'/0/0? 
    // No, deriveWallet(index) gives child.
    // I need the Parent.

    // Let's look at `src/services/sweeper/tron.ts`.
    // It imports `getMasterWalletKeys`.

    const { getMasterWalletKeys } = require('../src/services/wallet');
    const masterKeys = getMasterWalletKeys('TRON');

    // Setup TronWeb
    const apiKey = env.TRON_API_KEY;
    console.log(`Using API Key: ${apiKey}`);

    for (const dataIndex of INDICES) {
        try {
            const wallet = deriveWallet('TRON', dataIndex);
            console.log(`\nIndex ${dataIndex} -> ${wallet.address}`);

            const tw = new TronWeb({
                fullHost: 'https://api.trongrid.io',
                headers: { 'TRON-PRO-API-KEY': apiKey },
                privateKey: wallet.privateKey
            });

            const bal = await tw.trx.getBalance(wallet.address); // Sun
            const balTrx = tw.fromSun(bal);
            console.log(`  Balance: ${balTrx} TRX`);

            // Fee logic
            // Reserve 0.3 TRX for Bandwidth (conservative)
            const RESERVE = 300_000; // 0.3 TRX
            const amount = bal - RESERVE;

            if (amount <= 0) {
                console.log(`  Cannot sweep. Balance too low (Needs > 0.3 TRX).`);
                continue;
            }

            console.log(`  Sweeping ${tw.fromSun(amount)} TRX to ${masterKeys.address}...`);

            const tx = await tw.trx.sendTransaction(masterKeys.address, amount);
            console.log(`  ✅ Success! TxID: ${tx.txid}`);

        } catch (e: any) {
            console.error(`  Error:`, e.message);
        }
    }
}

main();
