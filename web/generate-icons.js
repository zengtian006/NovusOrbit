#!/usr/bin/env node

/**
 * Generate Favicon and Apple Touch Icons from SVG
 * Uses sharp library (already installed with Next.js)
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
    try {
        // Try to import sharp
        const sharp = require('sharp');

        const appDir = path.join(__dirname, 'app');
        const publicDir = path.join(__dirname, 'public');
        const svgFile = path.join(appDir, 'icon.svg');

        console.log('🎨 Generating icons from SVG...');

        // Check if SVG exists
        if (!fs.existsSync(svgFile)) {
            console.error('❌ Error: icon.svg not found in', appDir);
            process.exit(1);
        }

        const svgBuffer = fs.readFileSync(svgFile);

        // Generate favicon (32x32) as PNG
        console.log('  → Generating favicon-32.png (32x32)...');
        await sharp(svgBuffer)
            .resize(32, 32)
            .png()
            .toFile(path.join(publicDir, 'favicon-32.png'));

        // Generate Apple Touch Icon (180x180)
        console.log('  → Generating apple-touch-icon.png (180x180)...');
        await sharp(svgBuffer)
            .resize(180, 180)
            .png()
            .toFile(path.join(publicDir, 'apple-touch-icon.png'));

        // Generate additional sizes for better coverage
        console.log('  → Generating favicon-16.png (16x16)...');
        await sharp(svgBuffer)
            .resize(16, 16)
            .png()
            .toFile(path.join(publicDir, 'favicon-16.png'));

        console.log('✅ Icons generated successfully!');
        console.log('');
        console.log('Generated files:');
        console.log('  - favicon-16.png (16x16)');
        console.log('  - favicon-32.png (32x32)');
        console.log('  - apple-touch-icon.png (180x180)');
        console.log('');
        console.log('📋 Note: For .ico format, use online converter or ImageMagick:');
        console.log('  → https://cloudconvert.com/png-to-ico');
        console.log('  → brew install imagemagick && convert favicon-32.png favicon.ico');
        console.log('');
        console.log('📋 Next steps:');
        console.log('  1. (Optional) Convert favicon-32.png to favicon.ico');
        console.log('  2. Clear browser cache (Shift+F5)');
        console.log('  3. Restart dev server: npm run dev');

    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            console.error('❌ Error: sharp module not found');
            console.error('');
            console.error('Please install sharp:');
            console.error('  npm install sharp');
            console.error('');
            console.error('Or use the bash script with ImageMagick:');
            console.error('  brew install imagemagick');
            console.error('  ./generate-icons.sh');
            process.exit(1);
        } else {
            console.error('❌ Error generating icons:', error.message);
            process.exit(1);
        }
    }
}

generateIcons();
