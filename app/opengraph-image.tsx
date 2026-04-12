import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const alt = 'SaMba TeK | Security Doors, CCTV, Smart Locks & Access Control in Ghana';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const buffer = await readFile(join(process.cwd(), 'public', 'og-image.png'));
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
