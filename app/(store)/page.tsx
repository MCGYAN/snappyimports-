'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import CategoryCard from '@/components/CategoryCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCMS } from '@/context/CMSContext';
import { buildWhatsAppHref } from '@/lib/snappy-import';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const TrustSection = dynamic(() => import('@/components/snappy/TrustSection'), { loading: () => null });
const ProcessSteps = dynamic(() => import('@/components/snappy/ProcessSteps'), { loading: () => null });
const ImportJourneyTimeline = dynamic(() => import('@/components/snappy/ImportJourneyTimeline'), { loading: () => null });
const ImportCta = dynamic(() => import('@/components/snappy/ImportCta'), { loading: () => null });

const FALLBACK_CATEGORIES = [
  { slug: 'vehicles', name: 'Vehicles' },
  { slug: 'electronics', name: 'Electronics' },
  { slug: 'appliances', name: 'Appliances' },
  { slug: 'equipment', name: 'Equipment' },
  { slug: 'spare-parts', name: 'Spare Parts' },
];

export default function Home() {
  usePageTitle('Snappy Import Ghana | Home');
  const { getSetting } = useCMS();
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);
  const categorySliderRef = useRef<HTMLDivElement>(null);

  const waHero = buildWhatsAppHref(getSetting('contact_whatsapp'));
  const waHeroPrefilled = waHero
    ? `${waHero}${waHero.includes('?') ? '&' : '?'}text=${encodeURIComponent('Hi Snappy Import, I want to import from China.')}`
    : '';

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch('/api/storefront/products?featured=true&limit=4'),
          fetch('/api/storefront/categories'),
        ]);

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          if (Array.isArray(productsData)) {
            setFeaturedProducts(productsData);
          }
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          if (Array.isArray(categoriesData)) {
            setCategories(categoriesData);
          }
        }
      } catch (error: unknown) {
        if (process.env.NODE_ENV === 'development') {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('[Home] Storefront data unavailable:', message);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({
        left: direction === 'left' ? -350 : 350,
        behavior: 'smooth',
      });
    }
  };

  const scrollCategorySlider = (direction: 'left' | 'right') => {
    if (categorySliderRef.current) {
      categorySliderRef.current.scrollBy({
        left: direction === 'left' ? -400 : 400,
        behavior: 'smooth',
      });
    }
  };


  const displayCategories =
    categories.length > 0
      ? categories.filter((c: any) => !c.parent_id).slice(0, 8)
      : FALLBACK_CATEGORIES;

  const showCategoryFallback = !loading && featuredProducts.length === 0;

  const renderProductCard = (product: any) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const minVariantPrice = hasVariants
                  ? Math.min(...variants.map((v: any) => v.price || product.price))
                  : undefined;
                const totalVariantStock = hasVariants
                  ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0)
                  : 0;
                const effectiveStock = hasVariants ? totalVariantStock : product.quantity;

                const colorVariants: ColorVariant[] = [];
                const seenColors = new Set<string>();
                for (const v of variants) {
                  const colorName = (v as any).option2;
                  if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
                    const hex = getColorHex(colorName);
                    if (hex) {
                      seenColors.add(colorName.toLowerCase().trim());
                      colorVariants.push({ name: colorName.trim(), hex });
                    }
                  }
                }

    const imageUrl =
      product.product_images?.find((img: any) => img.url)?.url ||
      product.product_images?.[0]?.url ||
      'https://via.placeholder.com/400x500';

                return (
      <div key={product.id} className="min-w-0 w-full">
                    <ProductCard
                      id={product.id}
                      slug={product.slug}
                      name={product.name}
                      price={product.price}
                      originalPrice={product.compare_at_price}
            image={imageUrl}
                      rating={product.rating_avg || 5}
                      reviewCount={product.review_count || 0}
                      badge={product.featured ? 'Featured' : undefined}
                      inStock={effectiveStock > 0}
                      maxStock={effectiveStock || 50}
                      moq={product.moq || 1}
                      hasVariants={hasVariants}
                      minVariantPrice={minVariantPrice}
                      colorVariants={colorVariants}
                      categoryName={product.categories?.name}
                      categorySlug={product.categories?.slug}
            compact
                    />
                  </div>
                );
  };

  return (
    <main className="min-h-screen">
      {/* Hero: image on mobile and desktop */}
      <section className="relative isolate w-full overflow-hidden bg-[#0a1628]">
        {/* Mobile */}
        <div className="pointer-events-none absolute inset-0 lg:hidden" aria-hidden>
          <Image
            src="/hero-mobile.png"
            alt=""
            fill
            priority
            quality={78}
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/92 via-[#0B1F3A]/40 to-[#0B1F3A]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/55 via-transparent to-transparent" />
        </div>

        {/* Desktop landscape */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          <Image
            src="/hero-desktop.png"
            alt=""
            fill
            priority
            quality={78}
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/85 via-[#0B1F3A]/45 via-40% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/50 via-transparent to-transparent" />
        </div>

        <div className="relative aspect-[4/5] w-full max-h-[90svh] sm:aspect-[5/4] lg:aspect-auto lg:h-[56.25vw] lg:max-h-[100svh]">
          <div className="absolute inset-0 z-10 mx-auto flex w-full max-w-[1440px] flex-col justify-end px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-10 md:px-8 lg:justify-center lg:px-10 lg:py-0 lg:pb-28 xl:px-14">
            <div className="max-w-xl text-white max-md:text-left lg:max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/80 sm:mb-4 sm:text-sm sm:font-medium sm:normal-case sm:tracking-normal">
              China to Ghana
            </p>

            <h1 className="font-heading text-[2rem] font-bold leading-[1.12] tracking-[-0.02em] text-white sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] lg:leading-[1.05]">
              Import what you need without the stress.
            </h1>

            <p className="mt-4 max-w-lg text-[15px] font-medium leading-relaxed text-white/90 sm:mt-6 sm:text-lg md:text-xl">
              We handle the hard part. You stay in the loop from start to finish.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:mt-9 sm:flex-row sm:gap-4">
              <Link
                href="/shop"
                prefetch
                className="btn-interactive inline-flex min-h-[50px] items-center justify-center rounded-2xl bg-brand-accent px-8 py-3.5 text-[15px] font-bold tracking-wide text-white shadow-[0_8px_20px_rgba(242,107,29,0.35)] sm:min-h-[56px] sm:px-10 sm:text-base border border-transparent"
              >
                Order Now
              </Link>
              {waHeroPrefilled ? (
                <a
                  href={waHeroPrefilled}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-interactive glass-panel-dark inline-flex min-h-[50px] items-center justify-center rounded-2xl px-8 py-3.5 text-[15px] font-semibold tracking-wide text-white sm:min-h-[56px] sm:px-10 sm:text-base border border-white/20"
                >
                  Ask us on WhatsApp
                </a>
              ) : (
                <Link
                  href="/contact"
                  prefetch
                  className="btn-interactive glass-panel-dark inline-flex min-h-[50px] items-center justify-center rounded-2xl px-8 py-3.5 text-[15px] font-semibold tracking-wide text-white sm:min-h-[56px] sm:px-10 sm:text-base border border-white/20"
                >
                  Ask us on WhatsApp
                </Link>
              )}
            </div>

            <p className="mt-5 hidden text-sm leading-relaxed text-white/90 sm:mt-8 sm:block">
              Suppliers you can trust. China to Tema port. Updates you can count on.
            </p>
          </div>
          </div>

          {/* Category strip */}
          <div
            className="absolute inset-x-0 bottom-0 z-10 glass-panel-dark border-b-0 border-x-0 rounded-none lg:rounded-t-3xl mx-auto lg:max-w-[1440px] lg:bottom-4 lg:inset-x-10 xl:inset-x-14 lg:border lg:border-white/15"
          >
            <div className="flex items-center gap-6 overflow-x-auto px-6 py-4 scrollbar-hide sm:gap-10 sm:px-8 sm:py-5 md:px-10 lg:justify-center">
              {['Vehicles', 'Electronics', 'Appliances', 'Equipment', 'Spare parts'].map((label) => (
                <span key={label} className="shrink-0 whitespace-nowrap text-sm font-semibold tracking-wide text-white/90 sm:text-[15px]">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="store-section relative overflow-hidden border-b border-white/30 bg-gradient-to-b from-white/45 via-[#eef2f8]/55 to-[#f8fafc]/35">
        <div className="pointer-events-none absolute -left-32 top-0 h-64 w-64 rounded-full bg-brand-accent/5 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-48 w-48 rounded-full bg-brand-primary/5 blur-3xl" aria-hidden />
        <div className="store-container relative">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 md:mb-7 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-accent">Browse</p>
              <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
                Shop by Category
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                Pick a category. We help you import it.
              </p>
            </div>
            <div className="hidden gap-3 md:flex lg:hidden">
              <button
                type="button"
                onClick={() => scrollCategorySlider('left')}
                className="btn-interactive flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-primary shadow-sm hover:border-brand-accent/30"
                aria-label="Scroll categories left"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategorySlider('right')}
                className="btn-interactive flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-primary shadow-sm hover:border-brand-accent/30"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div
            ref={categorySliderRef}
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-1 scrollbar-hide sm:mx-0 sm:gap-4 sm:px-0 lg:grid lg:snap-none lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:pb-0 xl:gap-5"
          >
            {displayCategories.map((cat: any, idx: number) => (
              <CategoryCard
                key={cat.id || cat.slug}
                slug={cat.slug}
                name={cat.name}
                image={cat.image_url || cat.image}
                index={idx}
              />
            ))}
          </div>
          <div className="mt-5 md:mt-8 md:hidden">
            <Link href="/categories" className="text-sm font-semibold text-brand-primary active:text-brand-accent">
              View all categories
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="store-section relative overflow-hidden border-b border-white/30 bg-gradient-to-b from-[#f8fafc]/50 via-[#f1f5f9]/55 to-[#eef2f7]/40">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-white/60 blur-3xl" aria-hidden />
        <div className="store-container relative">
          <div className="mb-5 flex flex-col justify-between gap-4 md:mb-7 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-accent">Discover</p>
              <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem] lg:text-[2.5rem]">
                {showCategoryFallback ? 'Popular imports' : 'Featured products'}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 md:mt-3 md:text-base">
                {showCategoryFallback
                  ? 'Pick a category and start browsing.'
                  : 'Hand picked for you. See the price up front. Or ask for a quote.'}
              </p>
            </div>
            {showCategoryFallback && (
            <div className="hidden gap-3 md:flex lg:hidden">
              <button
                type="button"
                onClick={() => scrollSlider('left')}
                className="btn-interactive flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-primary shadow-sm hover:border-brand-accent/30"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => scrollSlider('right')}
                className="btn-interactive flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-primary shadow-sm hover:border-brand-accent/30"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-5 xl:gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="min-w-0">
                  <ProductCardSkeleton />
                </div>
              ))}
            </div>
          ) : showCategoryFallback ? (
            <div
              ref={sliderRef}
              className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-1 scrollbar-hide sm:mx-0 sm:gap-4 sm:px-0 lg:grid lg:snap-none lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:pb-0 xl:gap-6"
            >
              {displayCategories.slice(0, 6).map((cat: any, idx: number) => (
                <CategoryCard
                  key={cat.id || cat.slug}
                  slug={cat.slug}
                  name={cat.name}
                  image={cat.image_url || cat.image}
                  index={idx}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-5 xl:gap-6">
              {featuredProducts.map(renderProductCard)}
            </div>
          )}
        </div>
      </section>

      <TrustSection />
      <ProcessSteps />
      <ImportJourneyTimeline />

      <ImportCta whatsAppHref={waHeroPrefilled || undefined} />
    </main>
  );
}


