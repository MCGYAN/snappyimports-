import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const logoPath = join(ROOT, 'public', 'logo.png');

async function generateFavicons() {
  const logo = sharp(logoPath);
  const meta = await logo.metadata();
  console.log(`Logo: ${meta.width}x${meta.height}, format: ${meta.format}`);

  // Extract only the shield icon (left portion, no text)
  const shieldWidth = Math.round(meta.width * 0.22);
  const shieldHeight = Math.round(meta.height * 0.55);
  const shieldLeft = Math.round(meta.width * 0.12);
  const shieldTop = Math.round(meta.height * 0.18);

  const shieldBuffer = await sharp(logoPath)
    .extract({ left: shieldLeft, top: shieldTop, width: shieldWidth, height: shieldHeight })
    .png()
    .toBuffer();

  // Generate square versions with padding on dark background
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    const padding = Math.round(size * 0.1);
    const innerSize = size - padding * 2;

    const resizedShield = await sharp(shieldBuffer)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 27, b: 51, alpha: 1 } })
      .png()
      .toBuffer();

    const output = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 27, b: 51, alpha: 1 } // #001B33 dark navy
      }
    })
      .composite([{ input: resizedShield, left: padding, top: padding }])
      .png()
      .toBuffer();

    // Write to public/favicon/ (served at /favicon/*) and favicon/ (source copy)
    const faviconDir = join(ROOT, 'public', 'favicon');
    writeFileSync(join(faviconDir, name), output);
    console.log(`  Generated public/favicon/${name} (${size}x${size})`);

    if (name.startsWith('favicon-') || name === 'apple-touch-icon.png' || name.startsWith('android-chrome-')) {
      writeFileSync(join(ROOT, 'favicon', name), output);
      console.log(`  Generated favicon/${name}`);
    }
  }

  // Generate .ico from the 32x32 version
  const ico32 = await sharp(join(ROOT, 'public', 'favicon-32x32.png'))
    .resize(32, 32)
    .png()
    .toBuffer();
  // ICO is just a PNG wrapped in the ICO container for modern browsers
  // Modern browsers accept PNG as favicon.ico
  writeFileSync(join(ROOT, 'public', 'favicon', 'favicon.ico'), ico32);
  writeFileSync(join(ROOT, 'favicon', 'favicon.ico'), ico32);
  console.log('  Generated favicon.ico (32x32 PNG)');

  console.log('\nDone! All favicons generated from logo.');
}

generateFavicons().catch(err => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
