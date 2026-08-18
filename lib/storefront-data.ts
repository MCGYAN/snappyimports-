import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';

const PRODUCT_SELECT = `
  id, name, slug, price, compare_at_price, quantity, moq, featured, rating_avg, review_count, metadata, created_at,
  categories(id, name, slug),
  product_images(url, position),
  product_variants(id, name, price, quantity, option1, option2, image_url)
`;

const SHOP_SELECT = `
  id, name, slug, price, compare_at_price, quantity, moq, featured, rating_avg, created_at,
  categories!inner(name, slug),
  product_images(url, position),
  product_variants(id, name, price, quantity, option1, option2, image_url)
`;

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
  parent_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ShopQuery = {
  category?: string;
  search?: string;
  sort?: string;
  page?: number;
};

async function loadCategories(): Promise<StorefrontCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, image_url, parent_id, metadata')
    .eq('status', 'active')
    .order('name');
  if (error) {
    console.error('[storefront categories]', error);
    return [];
  }
  return (data || []) as StorefrontCategory[];
}

async function loadFeaturedProducts(limit: number) {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'active')
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[storefront featured]', error);
    return [];
  }
  if (data?.length) return data;

  const { data: fallback, error: fallbackError } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallbackError) {
    console.error('[storefront featured fallback]', fallbackError);
    return [];
  }
  return fallback || [];
}

async function loadShopProducts(query: ShopQuery, categories: StorefrontCategory[]) {
  const page = Math.max(1, query.page || 1);
  const productsPerPage = 9;
  const search = (query.search || '').trim();
  const selectedCategory = query.category || 'all';
  const sortBy = query.sort || 'popular';

  let dbQuery = supabase
    .from('products')
    .select(SHOP_SELECT, { count: 'exact' })
    .eq('status', 'active');

  if (search) dbQuery = dbQuery.ilike('name', `%${search}%`);

  if (selectedCategory !== 'all') {
    const categoryObj = categories.find((item) => item.slug === selectedCategory);
    if (categoryObj) {
      const targetSlugs = [
        selectedCategory,
        ...categories.filter((item) => item.parent_id === categoryObj.id).map((item) => item.slug),
      ];
      dbQuery = dbQuery.in('categories.slug', targetSlugs);
    } else {
      dbQuery = dbQuery.eq('categories.slug', selectedCategory);
    }
  }

  switch (sortBy) {
    case 'price-low':
      dbQuery = dbQuery.order('price', { ascending: true });
      break;
    case 'price-high':
      dbQuery = dbQuery.order('price', { ascending: false });
      break;
    case 'rating':
      dbQuery = dbQuery.order('rating_avg', { ascending: false });
      break;
    default:
      dbQuery = dbQuery.order('created_at', { ascending: false });
      break;
  }

  const from = (page - 1) * productsPerPage;
  const to = from + productsPerPage - 1;
  const { data, count, error } = await dbQuery.range(from, to);
  if (error) {
    console.error('[storefront shop]', error);
    return { products: [] as any[], count: 0 };
  }
  return { products: data || [], count: count || 0 };
}

export const getStorefrontCategories = unstable_cache(loadCategories, ['storefront-categories'], {
  revalidate: 300,
});

export const getFeaturedProducts = unstable_cache(
  async (limit = 4) => loadFeaturedProducts(limit),
  ['storefront-featured'],
  { revalidate: 180 },
);

export async function getShopCatalog(query: ShopQuery) {
  const categories = await getStorefrontCategories();
  const isDefault =
    (!query.category || query.category === 'all') &&
    !query.search &&
    (!query.sort || query.sort === 'popular') &&
    (!query.page || query.page === 1);
  if (isDefault) {
    const result = await unstable_cache(
      () => loadShopProducts({ page: 1, sort: 'popular', category: 'all' }, []),
      ['storefront-shop-default'],
      { revalidate: 120 },
    )();
    return { categories, ...result };
  }
  const result = await loadShopProducts(query, categories);
  return { categories, ...result };
}
