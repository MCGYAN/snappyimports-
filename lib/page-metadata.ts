import type { Metadata } from 'next';
import { SEO, type SEOPageKey } from '@/lib/seo';

type PageMetaOptions = {
  /** Path for canonical, e.g. /about */
  path?: string;
  title?: string;
  description?: string;
  keywords?: string[];
  /** Absolute URL or site-relative path for OG image */
  ogImage?: string;
  noindex?: boolean;
};

function absolutize(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = SEO.siteUrl.replace(/\/$/, '');
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

/**
 * Server metadata that always prefers brand SEO over CMS.
 * Use in route `layout.tsx` files next to client pages.
 */
export function pageMetadata(
  pageKey?: SEOPageKey | string,
  options: PageMetaOptions = {},
): Metadata {
  const preset = pageKey && SEO.pages[pageKey] ? SEO.pages[pageKey] : null;
  const title = options.title || preset?.title || SEO.defaultTitle;
  const description = options.description || preset?.description || SEO.defaultDescription;
  const path = options.path || (pageKey === 'home' ? '/' : pageKey ? `/${pageKey}` : '/');
  const canonical = absolutize(path);
  const ogImagePath =
    options.ogImage ||
    (pageKey === 'exchange' ? SEO.ogImages.buyRmb : SEO.ogImages.default);
  const ogImage = absolutize(ogImagePath);
  const keywords = [...new Set([...(options.keywords || []), ...SEO.keywords])];

  return {
    title,
    description,
    keywords,
    authors: [{ name: SEO.brandName }],
    creator: SEO.brandName,
    publisher: SEO.brandName,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: SEO.locale,
      url: canonical,
      siteName: SEO.brandName,
      title: title.includes(SEO.siteName) ? title : `${title} | ${SEO.siteName}`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SEO.brandName} — ${title}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title.includes(SEO.siteName) ? title : `${title} | ${SEO.siteName}`,
      description,
      images: [absolutize(SEO.ogImages.twitter)],
    },
    robots: options.noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
  };
}
