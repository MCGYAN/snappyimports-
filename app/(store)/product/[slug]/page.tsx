import { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SEO } from '@/lib/seo';
import { formatStoreMoney } from '@/lib/currency';
import ProductDetailClient from './ProductDetailClient';

type Props = { params: Promise<{ slug: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function absolutizeImage(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = SEO.siteUrl.replace(/\/+$/, '');
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

function plainText(html: string | null | undefined, max = 150): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug || '').trim();
  if (!decoded) {
    return { title: 'Product Not Found', robots: { index: false, follow: false } };
  }

  let query = supabaseAdmin
    .from('products')
    .select(
      'id, name, description, slug, price, compare_at_price, status, product_images(url, position), product_variants(price, quantity)',
    )
    .eq('status', 'active');

  // Avoid id.eq.<slug> when slug is not a UUID — that breaks the whole query in PostgREST.
  if (UUID_RE.test(decoded)) {
    query = query.or(`id.eq.${decoded},slug.eq.${decoded}`);
  } else {
    query = query.eq('slug', decoded);
  }

  const { data: product, error } = await query.maybeSingle();

  if (error || !product) {
    return { title: 'Product Not Found', robots: { index: false, follow: false } };
  }

  const images = ([...(product.product_images || [])] as { url?: string; position?: number }[])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const productImage =
    absolutizeImage(images[0]?.url) || `${SEO.siteUrl}${SEO.ogImages.default}`;

  const variantPrices = (
    (product.product_variants || []) as { price?: number; quantity?: number }[]
  )
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const basePrice = Number(product.price);
  const priceCandidates = [
    ...(Number.isFinite(basePrice) && basePrice > 0 ? [basePrice] : []),
    ...variantPrices,
  ];
  const price = priceCandidates.length ? Math.min(...priceCandidates) : null;
  const priceLabel = price != null ? formatStoreMoney(price) : null;

  const title = `${product.name} | Import to Ghana`;
  const descriptionParts = [
    priceLabel ? `${priceLabel}.` : null,
    `Order from ${SEO.brandName}.`,
    plainText(product.description, 100) || 'Import from China to Ghana. Clear price. Easy checkout.',
  ].filter(Boolean);
  const description = descriptionParts.join(' ');

  const pageUrl = `${SEO.siteUrl}/product/${encodeURIComponent(product.slug || decoded)}`;

  return {
    title,
    description,
    keywords: [
      product.name,
      product.slug || '',
      'import Ghana',
      'China to Ghana',
      SEO.brandName,
      ...SEO.keywords.slice(0, 8),
    ],
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: 'website',
      url: pageUrl,
      title: `${product.name} | ${SEO.brandName}`,
      description,
      siteName: SEO.brandName,
      locale: SEO.locale,
      images: [
        {
          url: productImage,
          width: 1200,
          height: 630,
          alt: `${product.name} for sale on ${SEO.brandName}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | ${SEO.brandName}`,
      description,
      images: [productImage],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
