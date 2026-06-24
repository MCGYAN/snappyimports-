import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

const LOGO_PATH = join(process.cwd(), 'public', 'favicon', 'favicon-32x32.png');

/** Minimal valid 1×1 transparent PNG fallback */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET() {
  try {
    if (existsSync(LOGO_PATH)) {
      const buf = readFileSync(LOGO_PATH);
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800, immutable',
        },
      });
    }
  } catch {
    // fall through
  }
  return new NextResponse(PNG_1X1, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
