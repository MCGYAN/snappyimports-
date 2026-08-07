import { Metadata } from 'next';
import { SEO } from '@/lib/seo';
import { pageMetadata } from '@/lib/page-metadata';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'product' | 'article';
  path?: string;
  price?: number;
  currency?: string;
  availability?: string;
  category?: string;
  publishedTime?: string;
  author?: string;
  noindex?: boolean;
}

/** Prefer `pageMetadata` from `@/lib/page-metadata` for route layouts. */
export function generateMetadata({
  title,
  description,
  keywords = [],
  ogImage,
  path = '/',
  publishedTime,
  author,
  noindex = false,
  ogType = 'website',
}: SEOProps): Metadata {
  const base = pageMetadata(undefined, {
    title: title || SEO.defaultTitle,
    description: description || SEO.defaultDescription,
    keywords,
    ogImage,
    path,
    noindex,
  });

  if (author) {
    base.authors = [{ name: author }];
  }

  if (ogType === 'article' && publishedTime && base.openGraph) {
    base.openGraph = {
      ...base.openGraph,
      type: 'article',
      publishedTime,
    };
  }

  return base;
}

export function generateProductSchema(product: {
  name: string;
  description: string;
  image: string;
  price: number;
  currency?: string;
  sku: string;
  rating?: number;
  reviewCount?: number;
  availability?: string;
  brand?: string;
  category?: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand || SEO.siteName
    },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'GHS',
      availability: product.availability === 'in_stock'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: typeof window !== 'undefined' ? window.location.href : '',
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  };

  if (product.rating && product.reviewCount) {
    (schema as any).aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1
    };
  }

  if (product.category) {
    (schema as any).category = product.category;
  }

  return schema;
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

export function generateOrganizationSchema() {
  const withLogo =
    SEO.logoUrl && SEO.logoUrl.length > 0
      ? { logo: SEO.logoUrl, image: SEO.logoUrl }
      : {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SEO.siteName,
    url: SEO.siteUrl,
    ...withLogo,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: SEO.contact.phone,
      contactType: 'Customer Service',
      areaServed: 'GH',
      availableLanguage: ['English']
    }
  };
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO.siteName,
    url: SEO.siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SEO.siteUrl}/shop?search={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function StructuredData({ data }: { data: any }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}