
const TARGETS = [
    'TLRYKySpn9UGjSJ23usQPpoBZx3uxQ7t8T'
];

async function main() {
    console.log(`Checking ${TARGETS.length} Tron wallets via TronScan...`);

    for (const addr of TARGETS) {
        console.log(`\nAnalyzing ${addr}...`);

        try {
            const url = `https://apilist.tronscan.org/api/account?address=${addr}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json() as any;

            // TRX (in Sun)
            const trx = (data.balance || 0) / 1000000;

            // USDT (TRC20)
            let usdt = 0;
            if (data.trc20token_balances) {
                const token = data.trc20token_balances.find((t: any) =>
                    t.contract_address === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
                );
                if (token) {
                    usdt = parseFloat(token.balance) / Math.pow(10, token.decimals);
                }
            } else if (data.balances) {
                // Sometimes balance list is different
            }

            console.log(`  TRX: ${trx}`);
            console.log(`  USDT: ${usdt}`);

        } catch (e: any) {
            console.error(`  Error:`, e.message);
        }
    }
}

main();
