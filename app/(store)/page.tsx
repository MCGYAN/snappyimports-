import { pageMetadata } from '@/lib/page-metadata';
import { getFeaturedProducts, getStorefrontCategories } from '@/lib/storefront-data';
import HomeClient from './HomeClient';

export const revalidate = 120;
export const metadata = pageMetadata('home', { path: '/' });

export default async function HomePage() {
  const [featuredProducts, categories] = await Promise.all([
    getFeaturedProducts(4),
    getStorefrontCategories(),
  ]);

  return (
    <HomeClient
      featuredProducts={featuredProducts}
      categories={categories}
    />
  );
}
