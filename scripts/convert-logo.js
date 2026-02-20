
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../client/public/logo.png');

async function main() {
    try {
        console.log(`Processing ${FILE}...`);

        // Read file
        const input = await sharp(FILE).metadata();
        console.log(`Original: ${input.width}x${input.height}, Format: ${input.format}`);

        // Convert: Flatten (add bg) -> PNG
        await sharp(FILE)
            .flatten({ background: '#000000' }) // Black background
            .toFile(FILE.replace('.png', '-black.png')); // Write to temp file first

        // Move temp file back to original (overwrite)
        fs.renameSync(FILE.replace('.png', '-black.png'), FILE);

        console.log(`✅ Success! Added Black Background to logo.png`);
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
