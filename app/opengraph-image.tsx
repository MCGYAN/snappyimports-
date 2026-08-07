import { ImageResponse } from 'next/og';
import { SEO } from '@/lib/seo';

/** Edge avoids a Node `@vercel/og` + `fileURLToPath` bug when the project path contains spaces. */
export const runtime = 'edge';

export const alt = `${SEO.brandName} — ${SEO.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const logoSrc = `${SEO.siteUrl}${SEO.logoLightBgPath}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
          background: 'linear-gradient(135deg, #0B1F3A 0%, #071526 50%, #1a0f08 100%)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={300}
            height={150}
            style={{ objectFit: 'contain' }}
            alt=""
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              width: 72,
              height: 6,
              background: '#F26B1D',
              borderRadius: 4,
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 54,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            Import from China to Ghana
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              color: '#cbd5e1',
              maxWidth: 860,
              lineHeight: 1.35,
            }}
          >
            Cars, gadgets, equipment. Clear prices. Real updates. Buy RMB with cedis.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#94a3b8',
          }}
        >
          <span>{SEO.brandName}</span>
          <span style={{ color: '#F26B1D', fontWeight: 600 }}>China to Ghana imports</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
