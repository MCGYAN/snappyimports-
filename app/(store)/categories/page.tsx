import type { Metadata } from 'next';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PageHero from '@/components/PageHero';
import { ShieldCheck, Video, Lock, Target, Server, Search, HeadphonesIcon, ArrowRight, Inbox } from 'lucide-react';
import { SEO } from '@/lib/seo';

export const revalidate = 0;

export const metadata: Metadata = {
  title: SEO.pages.categories.title,
  description: SEO.pages.categories.description,
};

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

  // Palette to cycle through for visual variety using Sambatek colors
  const palette = [
    { bg: 'bg-[#002B5E]', text: 'text-amber-500', Icon: ShieldCheck },
    { bg: 'bg-[#001733]', text: 'text-amber-500', Icon: Video },
    { bg: 'bg-amber-500', text: 'text-[#002B5E]', Icon: Lock },
    { bg: 'bg-[#002B5E]', text: 'text-white', Icon: Target },
    { bg: 'bg-[#001733]', text: 'text-white', Icon: Server },
  ];

  const categories = categoriesData?.map((c, i) => {
    const style = palette[i % palette.length];
    return {
      ...c,
      image: c.image_url || '/hero%205.jpg',
      bgClass: style.bg,
      textClass: style.text,
      Icon: style.Icon,
      productCount: 'Browse',
    };
  }) || [];

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Security Solutions"
        subtitle="Browse our equipment categories"
        backgroundImage="/hero%202.jpg"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {categories.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {categories.map((category) => {
              const Icon = category.Icon;
              return (
                <Link
                  key={category.id}
                  href={`/shop?category=${category.slug}`}
                  className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-2xl hover:border-amber-200 transition-all cursor-pointer"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className={`absolute inset-0 bg-[#001733] opacity-0 group-hover:opacity-40 transition-opacity`}></div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`w-14 h-14 ${category.bgClass} rounded-xl flex items-center justify-center shadow-inner`}>
                        <Icon className={`w-7 h-7 ${category.textClass}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-[#002B5E] group-hover:text-amber-500 transition-colors">{category.name}</h3>
                        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Equipment</p>
                      </div>
                    </div>
                    <p className="text-gray-600 font-medium leading-relaxed text-sm mb-6 line-clamp-2">
                      {category.description || 'Explore our comprehensive selection of security technology in this category.'}
                    </p>
                    <div className="flex items-center text-[#002B5E] font-bold text-sm uppercase tracking-wider group-hover:text-amber-500 group-hover:gap-2 transition-all">
                      <span>Browse category</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100">
            <Inbox className="w-16 h-16 text-gray-300 mb-4 mx-auto" />
            <p className="text-xl text-gray-500 font-medium">No categories found.</p>
          </div>
        )}
      </div>

      <div className="bg-[#001733] py-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-white fill-current">
            <polygon points="100,0 100,100 0,100" />
          </svg>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6">Need a Custom Security Setup?</h2>
          <p className="text-lg text-blue-200 mb-10 leading-relaxed font-medium max-w-2xl mx-auto">
            Our engineers are ready to design a tailored security architecture for your specific requirements.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-amber-500 text-[#001733] px-8 py-4 rounded-xl font-bold hover:bg-amber-400 transition-colors shadow-lg"
            >
              <Search className="w-5 h-5" />
              Search All Products
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-[#002B5E] text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-900 transition-colors shadow-lg border border-blue-800"
            >
              <HeadphonesIcon className="w-5 h-5" />
              Contact Technical Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
