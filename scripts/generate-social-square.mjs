import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const logoPath = join(ROOT, 'public', 'logo.png');

async function generateSquare() {
  const size = 1080;

  const logoResized = await sharp(logoPath)
    .resize(760, 260, { fit: 'contain', background: { r: 0, g: 27, b: 51, alpha: 0 } })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoResized).metadata();
  const bgColor = { r: 0, g: 21, b: 46, alpha: 255 }; // #00152E

  const overlaySvg = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <text x="${size / 2}" y="720" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="800" fill="#F59E0B">
        Your Store
      </text>
      <text x="${size / 2}" y="780" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" fill="#F59E0B">
        Shop online with confidence
      </text>
      <text x="${size / 2}" y="850" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="500" fill="rgba(255,255,255,0.9)">
        Catalog • Checkout • Order tracking
      </text>
      <text x="${size / 2}" y="940" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="rgba(255,255,255,0.7)">
        example.com
      </text>
    </svg>
  `);

  const logoLeft = Math.round((size - (logoMeta.width || 0)) / 2);
  const logoTop = 220;

  const image = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bgColor
    }
  })
    .composite([
      { input: logoResized, left: logoLeft, top: logoTop },
      { input: overlaySvg, left: 0, top: 0 }
    ])
    .png({ quality: 90 })
    .toBuffer();

  writeFileSync(join(ROOT, 'public', 'social-square.png'), image);
  console.log('Generated public/social-square.png (1080x1080)');
}

generateSquare().catch(err => {
  console.error('Error generating social square image:', err);
  process.exit(1);
});

