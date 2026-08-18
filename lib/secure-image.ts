/**
 * Snappy only needs this for product photos, category photos, Alipay QR
 * screenshots, and bulk import images. Rebuild every picture on the server so
 * the stored file is a real image, not the original upload.
 */

import sharp from 'sharp';

export class SecureImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecureImageError';
  }
}

export type SafeImageKind = 'product' | 'alipay';

export type SafeImage = {
  buffer: Buffer;
  contentType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
};

const MAGIC = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  gif: Buffer.from('GIF8', 'ascii'),
  riff: Buffer.from('RIFF', 'ascii'),
  webp: Buffer.from('WEBP', 'ascii'),
};

const LIMITS: Record<
  SafeImageKind,
  { maxBytes: number; maxDimension: number; output: 'webp' | 'jpeg' }
> = {
  product: { maxBytes: 5 * 1024 * 1024, maxDimension: 4000, output: 'webp' },
  alipay: { maxBytes: 5 * 1024 * 1024, maxDimension: 2000, output: 'jpeg' },
};

export const PRODUCT_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

function looksLikeSvg(input: Buffer) {
  const head = input.subarray(0, 256).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  return head.startsWith('<svg') || head.includes('<svg') || head.startsWith('<?xml');
}

function hasAllowedSignature(input: Buffer) {
  if (input.length < 12) return false;
  if (input.subarray(0, 3).equals(MAGIC.jpeg)) return true;
  if (input.subarray(0, 4).equals(MAGIC.png)) return true;
  if (input.subarray(0, 4).equals(MAGIC.gif)) return true;
  if (input.subarray(0, 4).equals(MAGIC.riff) && input.subarray(8, 12).equals(MAGIC.webp)) {
    return true;
  }
  return false;
}

export function randomImagePath(folder: string, extension: string) {
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '');
  return `${safeFolder}/${crypto.randomUUID()}.${extension}`;
}

export async function sanitizeUploadedImage(
  input: Buffer,
  kind: SafeImageKind,
  maxBytes = LIMITS[kind].maxBytes,
): Promise<SafeImage> {
  const limits = LIMITS[kind];
  if (!input.length) throw new SecureImageError('The image file is empty.');
  if (input.length > maxBytes) {
    throw new SecureImageError(`Image must be under ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }
  if (looksLikeSvg(input)) {
    throw new SecureImageError('SVG files are not allowed.');
  }
  if (!hasAllowedSignature(input)) {
    throw new SecureImageError('Upload a real JPG, PNG, or WebP image.');
  }

  let pipeline = sharp(input, { failOn: 'error', sequentialRead: true }).rotate();
  let meta: sharp.Metadata;
  try {
    meta = await pipeline.metadata();
  } catch {
    throw new SecureImageError('That file could not be read as an image.');
  }

  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width < 16 || height < 16) {
    throw new SecureImageError('That image is too small.');
  }
  if (width > 8000 || height > 8000) {
    throw new SecureImageError('That image is too large.');
  }

  pipeline = pipeline.resize({
    width: limits.maxDimension,
    height: limits.maxDimension,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (limits.output === 'webp') {
    const buffer = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer();
    return { buffer, contentType: 'image/webp', extension: 'webp' };
  }

  const buffer = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return { buffer, contentType: 'image/jpeg', extension: 'jpg' };
}

export async function sanitizeImageFile(file: File, kind: SafeImageKind): Promise<SafeImage> {
  const maxBytes = LIMITS[kind].maxBytes;
  if (file.size > maxBytes) {
    throw new SecureImageError(`Image must be under ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.svg') || file.type === 'image/svg+xml') {
    throw new SecureImageError('SVG files are not allowed.');
  }
  const input = Buffer.from(await file.arrayBuffer());
  return sanitizeUploadedImage(input, kind, maxBytes);
}
