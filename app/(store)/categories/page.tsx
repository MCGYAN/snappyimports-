import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import PageHero from '@/components/PageHero';
import { Search, HeadphonesIcon, ArrowRight, Inbox } from 'lucide-react';
import { SEO } from '@/lib/seo';

export const revalidate = 0;

export const metadata: Metadata = {
  title: SEO.pages.categories.title,
  description: SEO.pages.categories.description,
};

const PLACEHOLDER_BGS = [
  'bg-gradient-to-br from-brand-primary via-[#0d2747] to-[#050f1f]',
  'bg-gradient-to-br from-[#0d2747] via-brand-primary to-[#050f1f]',
  'bg-gradient-to-br from-[#1a0f08] via-brand-primary to-[#050f1f]',
  'bg-gradient-to-br from-brand-primary via-slate-900 to-slate-950',
];

export default async function CategoriesPage() {
  const { data: categoriesData } = await supabase
    .from('categories')
    .select(`
      id,
      name,
      slug,
      description,
      image_url,
      position
    `)
    .eq('status', 'active')
    .order('position', { ascending: true });

  const categories = categoriesData || [];

  return (
    <div className="min-h-screen bg-brand-surface">
      <PageHero
        title="Shop by Category"
        subtitle="Cars, phones, machines, and more. Pick a category and we help you import it."
      />

      <div className="store-container py-12 md:py-16">
        {categories.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-6">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/shop?category=${category.slug}`}
                className="group liquid-glass-card liquid-glass-card-interactive overflow-hidden"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {category.image_url ? (
                    <Image
                      src={category.image_url}
                      alt={category.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      className={`absolute inset-0 ${PLACEHOLDER_BGS[index % PLACEHOLDER_BGS.length]}`}
                      aria-hidden
                    />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 via-black/15 to-transparent" aria-hidden />
                  <h3 className="absolute bottom-4 left-4 right-4 font-heading text-lg font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                    {category.name}
                  </h3>
                </div>

                <div className="p-5">
                  <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                    {category.description ||
                      'We help you source it, ship it, and get it home. No surprises.'}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-brand-accent transition-all group-hover:gap-2">
                    <span>View category</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="liquid-glass-card py-20 text-center">
            <Inbox className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <p className="text-xl font-medium text-brand-foreground/70">
              No categories yet. Check back soon or browse featured products in the shop.
            </p>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden bg-brand-primary py-16 md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(242,107,29,0.14),transparent)]" aria-hidden />
        <div className="store-container relative z-10 max-w-3xl text-center">
          <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
            Not sure where to start?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            Tell us what you want to bring in. We walk you through cost and timing so you buy with confidence.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/shop"
              className="btn-interactive inline-flex items-center gap-2 rounded-xl bg-brand-accent px-8 py-4 font-bold text-white hover:bg-brand-accent/90"
            >
              <Search className="h-5 w-5" />
              Browse featured products
            </Link>
            <Link
              href="/contact"
              className="btn-interactive inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-4 font-bold text-white hover:bg-white/15"
            >
              <HeadphonesIcon className="h-5 w-5" />
              Talk to Snappy Import
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
