import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { SEO } from '@/lib/seo';
import { generateMetadata as generateSEOMetadata } from '@/components/SEOHead';
import ProductDetailClient from './ProductDetailClient';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: product } = await supabase
    .from('products')
    .select('name, description, product_images(url), slug')
    .eq('status', 'active')
    .or(`id.eq.${slug},slug.eq.${slug}`)
    .single();

  if (!product) {
    return { title: 'Product Not Found', robots: { index: false, follow: false } };
  }

  const description =
    (product.description && typeof product.description === 'string'
      ? product.description.replace(/<[^>]*>/g, '').slice(0, 160)
      : `${product.name} — Security solutions from ${SEO.siteName}.`) + '…';
  const image =
    (product.product_images as { url?: string }[])?.[0]?.url ||
    `${SEO.siteUrl}/logo.png`;

  return generateSEOMetadata({
    title: product.name,
    description,
    ogImage: image.startsWith('http') ? image : `${SEO.siteUrl}${image.startsWith('/') ? '' : '/'}${image}`,
    ogType: 'product',
    keywords: [product.name, product.slug ?? '', 'Ghana', SEO.siteName],
  });
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
