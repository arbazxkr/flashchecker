
const TronWeb = require('tronweb').TronWeb;

const address = 'TGS6EWijTThJ6Mtj2eMhb2FsaSDQGax38S';

try {
    const tw = new TronWeb({ fullHost: 'https://api.trongrid.io' });
    const valid = tw.isAddress(address);
    const hex = tw.address.toHex(address);

    console.log(`Address: ${address}`);
    console.log(`Valid: ${valid}`);
    console.log(`Hex: ${hex}`);

    if (valid) {
        console.log('✅ PASS: This is a perfectly valid Tron address.');
    } else {
        console.log('❌ FAIL: This address is INVALID (checksum error).');
    }
} catch (e) {
    console.error(e);
}
