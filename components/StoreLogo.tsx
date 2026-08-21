'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { SITE_LOGO_PATH, SITE_LOGO_SIZE } from '@/lib/brand';

/** Compact header asset (~400px WebP). Falls back to full PNG for CMS overrides. */
const HEADER_LOGO_PATH = '/images/snappy-imports-global-logo-header.webp';

interface StoreLogoProps {
  className?: string;
  priority?: boolean;
  /** Smaller logo for compact areas like the mobile footer */
  size?: 'default' | 'sm';
}

export default function StoreLogo({ className = '', priority = false, size = 'default' }: StoreLogoProps) {
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Snappy Import Ghana';
  const cmsLogo = getSetting('site_logo');
  const usingDefault = !cmsLogo || cmsLogo === SITE_LOGO_PATH;
  const src = usingDefault ? HEADER_LOGO_PATH : cmsLogo;

  const imageSizeClass =
    size === 'sm'
      ? 'h-10 w-auto max-w-[11rem] object-contain object-left sm:h-12'
      : 'h-12 w-auto max-w-[min(58vw,13.5rem)] object-contain object-left sm:h-14 md:h-[3.75rem]';

  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`} aria-label={siteName}>
      <Image
        src={src}
        alt={siteName}
        width={usingDefault ? 400 : SITE_LOGO_SIZE.width}
        height={usingDefault ? 193 : SITE_LOGO_SIZE.height}
        priority={priority}
        sizes={size === 'sm' ? '160px' : '(max-width: 640px) 180px, 220px'}
        quality={85}
        className={imageSizeClass}
      />
    </Link>
  );
}
