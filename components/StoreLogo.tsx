'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { SITE_LOGO_PATH } from '@/lib/brand';

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
      ? 'h-6 w-auto max-w-[9.5rem] object-contain object-left sm:h-7'
      : 'h-8 w-auto max-w-[min(52vw,12.5rem)] object-contain object-left sm:h-9 md:h-10';

  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`} aria-label={siteName}>
      <Image
        src={src}
        alt={siteName}
        width={575}
        height={292}
        priority={priority}
        unoptimized
        className={imageSizeClass}
      />
    </Link>
  );
}
