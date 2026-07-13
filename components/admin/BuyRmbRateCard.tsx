'use client';

import { SITE_LOGO_LIGHT_BG_PATH, BRAND_PRIMARY, BRAND_ACCENT } from '@/lib/brand';
import { posterRateNumber } from '@/lib/rate-card-share';

type BuyRmbRateCardProps = {
  buyRate: number;
  validUntil?: string | null;
  /** Fixed export size for crisp WhatsApp posters */
  size?: number;
  className?: string;
};

/**
 * Branded Buy RMB rate poster — matches Snappy's WhatsApp rate graphic.
 * Capture this node with html2canvas for PNG share / download.
 */
export default function BuyRmbRateCard({
  buyRate,
  validUntil,
  size = 720,
  className = '',
}: BuyRmbRateCardProps) {
  const rate = posterRateNumber(buyRate);
  const validLabel =
    validUntil && !Number.isNaN(new Date(validUntil).getTime())
      ? `Valid until ${new Date(validUntil).toLocaleString()}`
      : 'Official Snappy RMB desk rate';

  return (
    <div
      className={`relative overflow-hidden bg-white ${className}`}
      style={{
        width: size,
        height: size,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
      data-rate-card
    >
      {/* Top-left swoosh */}
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={size * 0.42}
        height={size * 0.28}
        viewBox="0 0 300 200"
        aria-hidden
      >
        <path
          d="M0 0 H220 C160 20 90 70 0 155 Z"
          fill={BRAND_ACCENT}
        />
        <path
          d="M0 0 H165 C120 35 55 85 0 130 Z"
          fill={BRAND_PRIMARY}
        />
      </svg>

      {/* Bottom-right swoosh */}
      <svg
        className="pointer-events-none absolute bottom-0 right-0"
        width={size * 0.42}
        height={size * 0.28}
        viewBox="0 0 300 200"
        aria-hidden
      >
        <path
          d="M300 200 H80 C140 180 210 130 300 45 Z"
          fill={BRAND_PRIMARY}
        />
        <path
          d="M300 200 H135 C180 165 245 115 300 70 Z"
          fill={BRAND_ACCENT}
        />
      </svg>

      <div
        className="relative z-10 flex h-full flex-col items-center"
        style={{ padding: size * 0.1 }}
      >
        <img
          src={SITE_LOGO_LIGHT_BG_PATH}
          alt="Snappy Imports Global"
          style={{
            height: size * 0.14,
            width: 'auto',
            objectFit: 'contain',
            marginTop: size * 0.06,
          }}
        />

        <p
          style={{
            marginTop: size * 0.028,
            color: BRAND_PRIMARY,
            fontWeight: 800,
            fontSize: size * 0.038,
            letterSpacing: '0.12em',
            textAlign: 'center',
          }}
        >
          SNAPPY IMPORTS GLOBAL
        </p>

        <div
          className="flex items-center justify-center"
          style={{ width: '72%', marginTop: size * 0.035, marginBottom: size * 0.05 }}
        >
          <span style={{ flex: 1, height: 1.5, background: BRAND_PRIMARY, opacity: 0.35 }} />
          <span
            style={{
              width: size * 0.018,
              height: size * 0.018,
              borderRadius: '50%',
              background: BRAND_ACCENT,
              margin: `0 ${size * 0.02}px`,
            }}
          />
          <span style={{ flex: 1, height: 1.5, background: BRAND_PRIMARY, opacity: 0.35 }} />
        </div>

        <div
          className="flex flex-col items-center justify-center"
          style={{
            width: '78%',
            border: `${Math.max(3, size * 0.006)}px solid ${BRAND_ACCENT}`,
            borderRadius: size * 0.025,
            padding: `${size * 0.055}px ${size * 0.04}px`,
            background: '#fff',
          }}
        >
          <p
            style={{
              color: BRAND_PRIMARY,
              fontWeight: 800,
              fontSize: size * 0.045,
              letterSpacing: '0.06em',
              margin: 0,
            }}
          >
            TODAY&apos;S RATE
          </p>
          <p
            style={{
              color: '#0a0a0a',
              fontWeight: 900,
              fontSize: size * 0.16,
              lineHeight: 1.05,
              margin: `${size * 0.02}px 0 0`,
              letterSpacing: '-0.02em',
            }}
          >
            {rate}
          </p>
          <p
            style={{
              color: BRAND_PRIMARY,
              fontWeight: 700,
              fontSize: size * 0.032,
              margin: `${size * 0.018}px 0 0`,
              opacity: 0.9,
            }}
          >
            1 GH¢ = {rate} RMB
          </p>
        </div>

        <p
          style={{
            marginTop: 'auto',
            color: BRAND_PRIMARY,
            fontWeight: 600,
            fontSize: size * 0.028,
            textAlign: 'center',
            opacity: 0.75,
            maxWidth: '80%',
          }}
        >
          {validLabel}
        </p>
        <p
          style={{
            marginTop: size * 0.012,
            color: BRAND_ACCENT,
            fontWeight: 800,
            fontSize: size * 0.026,
            letterSpacing: '0.04em',
          }}
        >
          BUY RMB · PAY CEDIS · GET RMB IN CHINA
        </p>
      </div>
    </div>
  );
}
