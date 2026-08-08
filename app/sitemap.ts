import { MetadataRoute } from 'next';
import { SEO } from '@/lib/seo';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

/** Always return a valid sitemap, even if the database is slow. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (SEO.siteUrl || 'https://www.snappyimportsglobal.com').replace(/\/+$/, '');

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/exchange`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/faqs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${baseUrl}/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/shipping`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.65 },
    { url: `${baseUrl}/order-tracking`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/returns`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  if (!isSupabaseConfigured) {
    return staticPages;
  }

  try {
    const result = await withTimeout(
      supabase.from('products').select('slug, updated_at').eq('status', 'active'),
      4000,
    );

    const products = result && 'data' in result ? result.data : null;
    if (!products?.length) return staticPages;

    const productPages: MetadataRoute.Sitemap = products
      .filter((product) => Boolean(product?.slug))
      .map((product) => ({
        url: `${baseUrl}/product/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));

    return [...staticPages, ...productPages];
  } catch (error) {
    console.error('Error generating sitemap products:', error);
    return staticPages;
  }
}
