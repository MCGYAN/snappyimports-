import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const logoPath = join(ROOT, 'public', 'logo.png');

async function generateOG() {
  const width = 1200;
  const height = 630;

  // Resize logo to fit nicely (max ~700px wide, ~220px tall, centered)
  const logoResized = await sharp(logoPath)
    .resize(700, 220, { fit: 'contain', background: { r: 0, g: 27, b: 51, alpha: 0 } })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoResized).metadata();

  // Create the OG image with a gradient-like background
  // Use layered dark navy rectangles to simulate gradient
  const bgColor = { r: 0, g: 21, b: 46, alpha: 255 }; // #00152E

  // Build the tagline as an SVG overlay
  const taglineSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${width / 2}" y="410" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#F59E0B">
        Advanced Security Solutions
      </text>
      <text x="${width / 2}" y="462" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="500" fill="rgba(255,255,255,0.9)">
        Security Doors • CCTV • Smart Locks • Access Control
      </text>
      <text x="${width / 2}" y="520" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">
        Accra • Tarkwa • Ghana
      </text>
    </svg>
  `);

  const logoLeft = Math.round((width - logoMeta.width) / 2);
  const logoTop = 140;

  const ogImage = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bgColor
    }
  })
    .composite([
      { input: logoResized, left: logoLeft, top: logoTop },
      { input: taglineSvg, left: 0, top: 0 }
    ])
    .png({ quality: 90 })
    .toBuffer();

  writeFileSync(join(ROOT, 'public', 'og-image.png'), ogImage);
  console.log('Generated public/og-image.png (1200x630)');
}

generateOG().catch(err => {
  console.error('Error generating OG image:', err);
  process.exit(1);
});
