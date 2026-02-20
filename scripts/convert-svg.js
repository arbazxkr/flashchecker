
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '../client/public/favicon.svg');
const OUTPUT = path.join(__dirname, '../client/public/opengraph-image.png');

async function main() {
    try {
        console.log(`Reading ${INPUT}...`);
        const buffer = fs.readFileSync(INPUT);

        console.log(`Generating PNG (1200x630)...`);

        await sharp(buffer)
            .resize({
                width: 1200,
                height: 630,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 1 } // Black background
            })
            .png()
            .toFile(OUTPUT);

        console.log(`✅ Success! Created: ${OUTPUT}`);
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
