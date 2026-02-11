
const { PublicKey } = require('@solana/web3.js');

const USER_MINT = 'Es9vMFrzaCER1n8BDSC7G6T4k6xJzQvGkX6pY7hV7Z';
const OFFICIAL_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

console.log('Testing User Mint:', USER_MINT);
try {
    const pub = new PublicKey(USER_MINT);
    console.log('✅ Valid Public Key:', pub.toBase58());
} catch (e) {
    console.error('❌ Invalid User Mint:', e.message);
}

console.log('Testing Official Mint:', OFFICIAL_MINT);
try {
    const pub = new PublicKey(OFFICIAL_MINT);
    console.log('✅ Valid Public Key:', pub.toBase58());
} catch (e) {
    console.error('❌ Invalid Official Mint:', e.message);
}
