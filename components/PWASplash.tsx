'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { SITE_LOGO_PATH, SITE_LOGO_SIZE } from '@/lib/brand';

export default function PWASplash() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Only show splash in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Only show on first load (not on subsequent navigations)
    const hasShownSplash = sessionStorage.getItem('splashShown');

    if (isStandalone && !hasShownSplash) {
      setShowSplash(true);
      sessionStorage.setItem('splashShown', 'true');

      const timer = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showSplash) return null;

  return (
    <div className="pwa-splash" aria-hidden="true">
      <div className="pwa-splash-logo mb-6">
        <Image
          src={SITE_LOGO_PATH}
          alt="Snappy Imports Global"
          width={SITE_LOGO_SIZE.width}
          height={SITE_LOGO_SIZE.height}
          priority
          unoptimized
          className="h-28 w-auto object-contain sm:h-32"
        />
      </div>
      <p className="text-white/75 text-sm font-medium mb-8">Importing is no longer stressful</p>
      <div className="pwa-splash-dots flex gap-1.5">
        <span className="w-2 h-2 bg-white rounded-full" />
        <span className="w-2 h-2 bg-white rounded-full" />
        <span className="w-2 h-2 bg-white rounded-full" />
      </div>
    </div>
  );
}
