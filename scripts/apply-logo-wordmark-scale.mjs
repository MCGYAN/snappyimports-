import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SOURCE =
  'C:/Users/user/.cursor/projects/c-Users-user-Desktop-SNAPPY-IMPORT/assets/c__Users_user_AppData_Roaming_Cursor_User_workspaceStorage_493e70b3b79b766c65bf0ad184e430d5_images_44fbe5ab-71a0-4940-a938-6a619f7120ff-d9fecc75-070c-463f-bc16-78a5c033eb30.png';

/** Scale the SNAPPY IMPORTS GLOBAL wordmark relative to the emblem. */
const WORDMARK_SCALE = 1.5;
const WORDMARK_GAP = 14;

function knockoutAndRemap(data, width, height, remapNavyToWhite) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const chroma = maxc - minc;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const orangeScore = r - Math.max(g, b);
    const navyScore = b - r;

    if (maxc < 16) {
      out[i + 3] = 0;
      continue;
    }

    if (chroma < 14 && lum > 35 && lum < 170) {
      out[i + 3] = 0;
      continue;
    }

    const isOrange = orangeScore > 22 && r > 90;
    const isNavy = navyScore > 8 && b > 18 && lum < 110;
    const isWhite = minc > 200;

    if (isWhite) continue;

    if (!isOrange && !isNavy && maxc < 28) {
      out[i + 3] = 0;
      continue;
    }

    if (!isOrange && !isNavy && chroma < 18) {
      out[i + 3] = 0;
      continue;
    }

    if (remapNavyToWhite && isNavy && !isOrange) {
      const t = Math.min(1, Math.max(0.35, b / 90));
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = Math.round(255 * t);
    }
  }
  return out;
}

async function fromRaw(raw, width, height) {
  return sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .trim({ threshold: 12 })
    .png()
    .toBuffer();
}

async function analyzeSplit(raw, width, height) {
  let lastOrange = 0;
  let textStart = height;
  for (let y = 0; y < height; y++) {
    let orange = 0;
    let navy = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      const a = raw[i + 3];
      if (a < 40) continue;
      if (r > 140 && r > g + 25 && r > b + 40) orange++;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (b > r + 15 && b >= g && lum > 12 && lum < 110 && !(r > 140 && r > g + 25)) navy++;
    }
    if (orange > 0) lastOrange = y;
    if (y > lastOrange + 20 && navy > 120 && textStart === height) textStart = y;
  }
  return { lastOrange, textStart };
}

async function buildLogo() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const processed = knockoutAndRemap(data, info.width, info.height, false);
  const { lastOrange, textStart } = await analyzeSplit(processed, info.width, info.height);

  const base = await sharp(processed, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  const emblemEnd = lastOrange + 10;
  const wordmarkTop = textStart - 4;

  const emblemExtracted = await sharp(base)
    .extract({ left: 0, top: 0, width: info.width, height: emblemEnd })
    .png()
    .toBuffer();
  const emblemRaw = await sharp(emblemExtracted).trim({ threshold: 8 }).png().toBuffer();

  const wordmarkExtracted = await sharp(base)
    .extract({ left: 0, top: wordmarkTop, width: info.width, height: info.height - wordmarkTop })
    .png()
    .toBuffer();
  const wordmarkRaw = await sharp(wordmarkExtracted).trim({ threshold: 8 }).png().toBuffer();

  const emblemMeta = await sharp(emblemRaw).metadata();
  const wordMeta = await sharp(wordmarkRaw).metadata();

  const scaledWordW = Math.round((wordMeta.width ?? 1) * WORDMARK_SCALE);
  const scaledWordH = Math.round((wordMeta.height ?? 1) * WORDMARK_SCALE);

  const scaledWord = await sharp(wordmarkRaw)
    .resize(scaledWordW, scaledWordH, { fit: 'fill' })
    .png()
    .toBuffer();

  const canvasW = Math.max(emblemMeta.width ?? 1, scaledWordW) + 40;
  const canvasH = (emblemMeta.height ?? 1) + WORDMARK_GAP + scaledWordH + 24;
  const emblemLeft = Math.floor((canvasW - (emblemMeta.width ?? 1)) / 2);
  const wordLeft = Math.floor((canvasW - scaledWordW) / 2);
  const emblemTop = 12;

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: emblemRaw, left: emblemLeft, top: emblemTop },
      { input: scaledWord, left: wordLeft, top: emblemTop + (emblemMeta.height ?? 1) + WORDMARK_GAP },
    ])
    .png()
    .trim({ threshold: 8 })
    .toBuffer();
}

async function toDarkLogo(lightBuf) {
  const { data, info } = await sharp(lightBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const remapped = knockoutAndRemap(data, info.width, info.height, true);
  return sharp(remapped, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .trim({ threshold: 8 })
    .toBuffer();
}

async function cropEmblem(path, outPath) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let lastOrange = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 40 && r > 140 && r > g + 25 && r > b + 40) lastOrange = y;
    }
  }

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y <= lastOrange; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] > 40) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const pad = 20;
  const extractLeft = Math.max(0, minX - pad);
  const extractTop = Math.max(0, minY - pad);
  const extractRight = Math.min(info.width, maxX + pad + 1);
  const extractBottom = Math.min(info.height, lastOrange + 4);
  const cropped = await sharp(path)
    .extract({
      left: extractLeft,
      top: extractTop,
      width: extractRight - extractLeft,
      height: extractBottom - extractTop,
    })
    .png()
    .toBuffer();

  const cMeta = await sharp(cropped).metadata();
  const side = Math.max(cMeta.width ?? 1, cMeta.height ?? 1) + 16;
  const canvas = await sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: cropped,
        left: Math.floor((side - (cMeta.width ?? side)) / 2),
        top: Math.floor((side - (cMeta.height ?? side)) / 2),
      },
    ])
    .png()
    .toBuffer();

  writeFileSync(outPath, canvas);
}

async function makeOg({ outPath, title, subtitle, logoBuf, square = false }) {
  const width = square ? 1080 : 1200;
  const height = square ? 1080 : 630;
  const logoH = square ? 400 : 260;
  const resized = await sharp(logoBuf)
    .resize({ height: logoH, fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const logoMeta = await sharp(resized).metadata();
  const logoLeft = Math.round((width - (logoMeta.width ?? 0)) / 2);
  const logoTop = square ? 150 : 28;

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0B1F3A"/>
      <rect x="${width - 280}" y="-40" width="360" height="360" rx="180" fill="#F26B1D" fill-opacity="0.12"/>
      <text x="${width / 2}" y="${square ? 700 : 390}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${square ? 46 : 40}" font-weight="700" fill="#ffffff">${title}</text>
      <rect x="${width / 2 - 36}" y="${square ? 728 : 412}" width="72" height="6" rx="3" fill="#F26B1D"/>
      <text x="${width / 2}" y="${square ? 790 : 458}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${square ? 26 : 20}" font-weight="500" fill="#cbd5e1">${subtitle}</text>
      <text x="${width / 2}" y="${height - 48}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#94a3b8">snappyimportsglobal.com</text>
    </svg>
  `);

  const image = await sharp(svg)
    .composite([{ input: resized, left: logoLeft, top: logoTop }])
    .png()
    .toBuffer();
  writeFileSync(outPath, image);
}

async function main() {
  const imagesDir = join(ROOT, 'public', 'images');
  mkdirSync(imagesDir, { recursive: true });

  const light = await buildLogo();
  const dark = await toDarkLogo(light);

  const lightPath = join(imagesDir, 'snappy-imports-global-logo-light-bg.png');
  const darkPath = join(imagesDir, 'snappy-imports-global-logo.png');
  writeFileSync(lightPath, light);
  writeFileSync(darkPath, dark);

  const lightMeta = await sharp(light).metadata();
  const darkMeta = await sharp(dark).metadata();
  console.log('light', lightMeta.width, lightMeta.height);
  console.log('dark', darkMeta.width, darkMeta.height);

  await cropEmblem(lightPath, join(imagesDir, 'admin-logo.png'));
  await cropEmblem(darkPath, join(imagesDir, 'snappy-favicon-source.png'));

  const ogDir = join(ROOT, 'public', 'og');
  mkdirSync(ogDir, { recursive: true });
  await makeOg({
    outPath: join(ogDir, 'default.png'),
    title: 'Import from China to Ghana',
    subtitle: 'Cars, gadgets, equipment. Clear prices. Real updates.',
    logoBuf: dark,
  });
  await makeOg({
    outPath: join(ogDir, 'twitter.png'),
    title: 'Import from China to Ghana',
    subtitle: 'Cars, gadgets, equipment. Clear prices. Real updates.',
    logoBuf: dark,
  });
  await makeOg({
    outPath: join(ogDir, 'buy-rmb.png'),
    title: 'Buy RMB with Ghana Cedis',
    subtitle: 'Official buy rate. Invoice and pay. RMB for China suppliers.',
    logoBuf: dark,
  });
  await makeOg({
    outPath: join(ogDir, 'square.png'),
    title: 'Snappy Imports Global',
    subtitle: 'China to Ghana imports',
    logoBuf: dark,
    square: true,
  });

  writeFileSync(
    join(ROOT, '.tmp-logo-size.json'),
    JSON.stringify({ width: darkMeta.width, height: darkMeta.height }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
