'use client';

import React from 'react';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  /** Tall hero for marketing pages; compact for catalog/account flows */
  size?: 'compact' | 'large';
}

export default function PageHero({ title, subtitle, size = 'compact' }: PageHeroProps) {
  const isLarge = size === 'large';

  return (
    <div
      className={`relative overflow-hidden bg-brand-primary ${
        isLarge ? 'py-14 md:py-28' : 'py-10 md:py-16'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_80%_60%_at_30%_-20%,rgba(242,107,29,0.12),transparent_55%)] md:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-brand-accent/30 md:bg-gradient-to-r md:from-transparent md:via-brand-accent/40 md:to-transparent"
        aria-hidden
      />

      <div className="store-container relative z-10">
        <div className={`${isLarge ? 'max-w-3xl' : 'max-w-2xl'} max-md:mobile-editorial-inset`}>
          <p className="mobile-editorial-kicker mb-2 md:store-eyebrow md:mb-3">Snappy Import Ghana</p>
          <h1
            className={`font-heading font-bold tracking-tight text-white ${
              isLarge
                ? 'text-[1.75rem] leading-tight sm:text-4xl md:text-5xl lg:text-6xl'
                : 'text-[1.625rem] leading-tight sm:text-3xl md:text-4xl'
            }`}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={`mt-3 max-w-2xl leading-relaxed text-white/85 ${
                isLarge ? 'text-[15px] sm:text-lg md:text-xl' : 'text-[15px] sm:text-base md:text-lg'
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
