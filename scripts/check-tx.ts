
const TX_IDS = [
    'a5f044ecc5ade3986b6109644ae0f0f1b441fbdd66be239893af1013b9f194aa',
    '40c42864b2dffa78f91838643973b58feb6407a7eff7a2c220633d30e1313581'
];

async function main() {
    console.log(`Checking ${TX_IDS.length} transactions via TronScan...`);

    for (const tx of TX_IDS) {
        console.log(`\nAnalyzing ${tx}...`);
        try {
            const url = `https://apilist.tronscan.org/api/transaction-info?hash=${tx}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json() as any;

            console.log(`  Status: ${data.contractRet}`);
            console.log(`  Confirmed: ${data.confirmed}`);
            if (data.cost) {
                console.log(`  Fee: ${data.cost.net_fee} bandwidth, ${data.cost.energy_fee} energy?`);
                // TronScan format covers cost details
            }
            console.log(`  Result: ${JSON.stringify(data.contractRet)}`);

        } catch (e: any) {
            console.error(`  Error:`, e.message);
        }
    }
}

main();
