import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SOURCE_CANDIDATES = [
  join(ROOT, 'public', 'images', 'snappy-favicon-source.png'),
  join(
    ROOT,
    'public',
    'images',
    'snappy-imports-global-logo.png',
  ),
];

function resolveSource() {
  for (const path of SOURCE_CANDIDATES) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    'No favicon source found. Add public/images/snappy-favicon-source.png',
  );
}

const BRAND_NAVY = { r: 11, g: 31, b: 58, alpha: 1 };

async function extractEmblem(sourcePath) {
  const meta = await sharp(sourcePath).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 512;

  // Horizontal logo: crop left emblem. Square source: use full frame.
  const isWide = width > height * 1.2;
  const crop = isWide
    ? {
        left: Math.round(width * 0.04),
        top: Math.round(height * 0.06),
        width: Math.round(width * 0.38),
        height: Math.round(height * 0.88),
      }
    : { left: 0, top: 0, width, height };

  const emblem = await sharp(sourcePath).extract(crop).png().toBuffer();
  const cropMeta = await sharp(emblem).metadata();
  const side = Math.max(cropMeta.width ?? 1, cropMeta.height ?? 1);

  return sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: BRAND_NAVY,
    },
  })
    .composite([
      {
        input: emblem,
        left: Math.floor((side - (cropMeta.width ?? side)) / 2),
        top: Math.floor((side - (cropMeta.height ?? side)) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function generateFavicons() {
  const sourcePath = resolveSource();
  console.log(`Source: ${sourcePath}`);
  const emblemBuffer = await extractEmblem(sourcePath);

  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  const outDirs = [join(ROOT, 'public', 'favicon'), join(ROOT, 'favicon')];
  for (const dir of outDirs) mkdirSync(dir, { recursive: true });

  for (const { name, size } of sizes) {
    const padding = Math.max(1, Math.round(size * 0.08));
    const inner = size - padding * 2;

    const resized = await sharp(emblemBuffer)
      .resize(inner, inner, { fit: 'contain', background: BRAND_NAVY })
      .png()
      .toBuffer();

    const output = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BRAND_NAVY,
      },
    })
      .composite([{ input: resized, left: padding, top: padding }])
      .png()
      .toBuffer();

    for (const dir of outDirs) {
      writeFileSync(join(dir, name), output);
    }
    console.log(`  Generated ${name} (${size}x${size})`);
  }

  const ico32 = await sharp(join(ROOT, 'public', 'favicon', 'favicon-32x32.png'))
    .resize(32, 32)
    .png()
    .toBuffer();

  for (const dir of outDirs) {
    writeFileSync(join(dir, 'favicon.ico'), ico32);
  }
  console.log('  Generated favicon.ico');

  console.log('\nDone! Favicons generated from Snappy Imports emblem.');
}

generateFavicons().catch((err) => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
