import { Suspense } from 'react';
import ShopClient from './ShopClient';
import { getShopCatalog } from '@/lib/storefront-data';

export const revalidate = 120;

type ShopPageProps = {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const category = params.category || 'all';
  const search = params.search || '';
  const sort = params.sort || 'popular';
  const page = Math.max(1, Number(params.page) || 1);
  const { categories, products, count } = await getShopCatalog({
    category,
    search,
    sort,
    page,
  });

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <ShopClient
        initialCategories={categories}
        initialProducts={products}
        initialCount={count}
        initialCategory={category}
        initialSearch={search}
        initialSort={sort}
      />
    </Suspense>
  );
}
