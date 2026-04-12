import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// Serve the real 32x32 favicon from public (same as favicon/ assets)
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'favicon-32x32.png');
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
