'use client';

import { useEffect } from 'react';
import { SEO } from '@/lib/seo';

/** Client title helper. Prefer server `pageMetadata` for crawlers. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const site = SEO.siteName;
    if (!title) {
      document.title = SEO.defaultTitle;
      return;
    }
    document.title = title.includes(site) ? title : `${title} | ${site}`;
  }, [title]);
}
