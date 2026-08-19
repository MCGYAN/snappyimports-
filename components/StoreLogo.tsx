'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { SITE_LOGO_PATH, SITE_LOGO_SIZE } from '@/lib/brand';

interface StoreLogoProps {
  className?: string;
  priority?: boolean;
  /** Smaller logo for compact areas like the mobile footer */
  size?: 'default' | 'sm';
}

export default function StoreLogo({ className = '', priority = false, size = 'default' }: StoreLogoProps) {
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Snappy Import Ghana';
  const src = getSetting('site_logo') || SITE_LOGO_PATH;

  const imageSizeClass =
    size === 'sm'
      ? 'h-10 w-auto max-w-[11rem] object-contain object-left sm:h-12'
      : 'h-12 w-auto max-w-[min(58vw,13.5rem)] object-contain object-left sm:h-14 md:h-[3.75rem]';

  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`} aria-label={siteName}>
      <Image
        src={src}
        alt={siteName}
        width={SITE_LOGO_SIZE.width}
        height={SITE_LOGO_SIZE.height}
        priority={priority}
        unoptimized
        className={imageSizeClass}
      />
    </Link>
  );
}
