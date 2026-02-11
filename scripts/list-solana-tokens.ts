
import { Connection, PublicKey } from '@solana/web3.js';
import { chainConfigs } from '../src/config/chains';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function main() {
    const address = process.argv[2];
    if (!address) {
        console.error('Usage: npx ts-node scripts/list-solana-tokens.ts <ADDRESS>');
        process.exit(1);
    }

    const connection = new Connection(chainConfigs.SOLANA.rpcUrl, 'confirmed');
    const pubkey = new PublicKey(address);

    console.log(`Scanning tokens for address: ${address}...`);

    try {
        const accounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
            programId: TOKEN_PROGRAM_ID,
        });

        if (accounts.value.length === 0) {
            console.log('No token accounts found.');
            return;
        }

        console.log(`Found ${accounts.value.length} token accounts:`);
        accounts.value.forEach((account) => {
            const info = account.account.data.parsed.info;
            const mint = info.mint;
            const amount = info.tokenAmount.uiAmount;
            const decimals = info.tokenAmount.decimals;

            if (amount > 0) {
                console.log(`- Mint: ${mint}`);
                console.log(`  Balance: ${amount} (Decimals: ${decimals})`);
            } else {
                console.log(`- Mint: ${mint} (Balance: 0)`);
            }
        });

    } catch (e) {
        console.error('Error fetching token accounts:', e);
    }
}

main();
