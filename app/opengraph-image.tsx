import { ImageResponse } from 'next/og';
import { SEO } from '@/lib/seo';

/** Edge avoids a Node `@vercel/og` + `fileURLToPath` bug when the project path contains spaces (e.g. `SNAPPY IMPORT`). */
export const runtime = 'edge';

export const alt = SEO.siteName;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0B1F3A 0%, #050f1f 55%, #1a0a05 100%)',
          color: '#fff',
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        {SEO.siteName}
      </div>
    ),
    { ...size }
  );
}
