// Script to generate PNG icons from SVG
// Run: node generate-icons.js
// Requires: npm install sharp

const fs = require('fs');
const path = require('path');

async function generateIcons() {
    try {
        const sharp = require('sharp');
        const svgBuffer = fs.readFileSync(path.join(__dirname, 'icon.svg'));

        const sizes = [16, 48, 128];

        for (const size of sizes) {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(path.join(__dirname, `icon${size}.png`));

            console.log(`Generated icon${size}.png`);
        }

        console.log('All icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error.message);
        console.log('\nTo generate icons, install sharp:');
        console.log('  npm install sharp');
        console.log('\nOr use ImageMagick:');
        console.log('  convert -background none -resize 16x16 icon.svg icon16.png');
        console.log('  convert -background none -resize 48x48 icon.svg icon48.png');
        console.log('  convert -background none -resize 128x128 icon.svg icon128.png');
    }
}

generateIcons();
