
const sharp = require('sharp');
const path = require('path');

const LOGO = path.join(__dirname, '../client/public/logo.png');
const PUBLIC_DIR = path.join(__dirname, '../client/public');

async function main() {
    try {
        console.log(`Reading logo: ${LOGO}...`);

        // Settings for PWA icons (Black background, centered logo)
        const sizes = [192, 512];

        for (const size of sizes) {
            const fileName = `android-chrome-${size}x${size}.png`;
            const outputPath = path.join(PUBLIC_DIR, fileName);

            console.log(`Generating ${fileName}...`);

            // Resize logo to fit inside the square (e.g. 80% of size)
            const padding = Math.floor(size * 0.2);
            const innerSize = size - padding;

            const logoBuffer = await sharp(LOGO)
                .resize({
                    height: innerSize,
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .toBuffer();

            // Composite on Black Square
            await sharp({
                create: {
                    width: size,
                    height: size,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 1 } // Solid Black
                }
            })
                .composite([{ input: logoBuffer, gravity: 'center' }])
                .png()
                .toFile(outputPath);
        }

        console.log(`✅ Success! Created PWA icons.`);

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
