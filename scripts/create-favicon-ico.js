
const sharp = require('sharp');
const path = require('path');

const LOGO = path.join(__dirname, '../client/public/logo.png');
const OUTPUT = path.join(__dirname, '../client/public/favicon.ico');

async function main() {
    try {
        console.log(`Reading logo: ${LOGO}...`);

        // Resize to 32x32 for standard favicon
        // ICO format supports multiple sizes (32, 64, etc) but sharp handles basic png fine.
        // Wait, sharp output to .ico? Sharp doesn't support .ico natively easily.
        // It supports .png.
        // Modern browsers support .png as favicon.
        // But traditional favicon.ico is needed for some tools.
        // I'll make a 32x32 PNG and save it as .ico (often works)
        // Or better: save as favicon.png and update layout.tsx to point to it.
        // But let's try to make a real .ico if possible? No, requires specific encoder.
        // I'll make a 32x32 PNG named favicon.ico (might work) OR properly convert.
        // Actually, easiest is to ensure layout.tsx points to `icon: '/favicon.png'`.

        // Let's create `client/public/favicon.png` (32x32).
        const OUTPUT_PNG = path.join(__dirname, '../client/public/favicon.png');

        await sharp(LOGO)
            .resize({ width: 32, height: 32, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(OUTPUT_PNG);

        console.log(`✅ Success! Created favicon.png`);

        // Also create a slightly larger one for apple-touch-icon (180x180)
        const OUTPUT_APPLE = path.join(__dirname, '../client/public/apple-icon.png');
        await sharp(LOGO)
            .resize({ width: 180, height: 180, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }) // Black bg for apple icon
            .png()
            .toFile(OUTPUT_APPLE);

        console.log(`✅ Success! Created apple-icon.png`);

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
