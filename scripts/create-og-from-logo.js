
const sharp = require('sharp');
const path = require('path');

const LOGO = path.join(__dirname, '../client/public/logo.png');
const OUTPUT = path.join(__dirname, '../client/public/opengraph-image.png');

async function main() {
    try {
        console.log(`Reading logo: ${LOGO}...`);

        // Resize logo to fit within 1200x630 (e.g. max height 500px, leaving padding)
        const logoBuffer = await sharp(LOGO)
            .resize({
                height: 500, // Fit height (leave 65px padding top/bottom)
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent padding if needed
            })
            .toBuffer();

        // Create 1200x630 Black Canvas and composite logo
        console.log(`Creating Composite OG Image...`);

        await sharp({
            create: {
                width: 1200,
                height: 630,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 } // Black Background
            }
        })
            .composite([
                { input: logoBuffer, gravity: 'center' } // Center the resized logo
            ])
            .png()
            .toFile(OUTPUT);

        console.log(`✅ Success! Created new opengraph-image.png from logo.png`);

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
