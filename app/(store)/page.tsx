'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import AnimatedSection from '@/components/AnimatedSection';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ShieldCheck, Video, Lock, Wrench, ArrowRight, Shield, Phone, PhoneCall, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function Home() {
  usePageTitle('Sambatek | Security Solutions');
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [promoIndex, setPromoIndex] = useState(0);

  const heroImages = ['/hero%201.jpg', '/hero%202.jpg', '/hero%203.jpg', '/hero4.jpg'];
  const promoImages = ['/hero4.jpg', '/hero%201.jpg', '/hero%203.jpg', '/hero%202.jpg'];

  const sliderRef = useRef<HTMLDivElement>(null);
  const categorySliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*, product_variants(*), product_images(*)')
          .eq('status', 'active')
          .eq('featured', true)
          .order('created_at', { ascending: false })
          .limit(8);

        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .eq('status', 'active');

        if (productsError) throw productsError;
        setFeaturedProducts(productsData || []);
        setCategories(categoriesData || []);
      } catch (error: unknown) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = 350;
      sliderRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollCategorySlider = (direction: 'left' | 'right') => {
    if (categorySliderRef.current) {
      const scrollAmount = 400;
      categorySliderRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  useEffect(() => {
    const promoInterval = setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % promoImages.length);
    }, 2000);
    return () => clearInterval(promoInterval);
  }, [promoImages.length]);

  return (
    <main className="flex-col items-center justify-between min-h-screen bg-white">

      {/* 1. HERO SECTION */}
      <section className="relative w-full min-h-[85vh] flex items-center justify-center overflow-hidden bg-[#001733]">
        <div className="absolute inset-0 z-0">
          {heroImages.map((src, idx) => (
            <div
              key={src}
              className={`absolute inset-0 transition-all duration-1000 ease-in-out ${idx === heroIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
            >
              <Image
                src={src}
                alt={`Secure Home ${idx + 1}`}
                fill
                className="object-cover object-center"
                priority={idx === 0}
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-[#002B5E] via-[#002B5E]/80 to-black/30"></div>
        </div>

        <div className="relative z-10 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col justify-center">
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-semibold text-xs sm:text-sm tracking-widest uppercase mb-4 sm:mb-6 border border-amber-500/30 shadow-sm">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Trusted Security Experts
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 leading-[1.15] tracking-tight">
              Advanced Security Doors <br />
              <span className="text-amber-400 drop-shadow-sm">
                Smart Protection Systems
              </span>
              <br />
              <span className="text-white/95">in Ghana</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-blue-50 mb-8 sm:mb-10 font-medium max-w-2xl leading-relaxed opacity-95">
              Protect your home, office and business with high quality security Doors, CCTV cameras, smart locks and access control system installed by professionals.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-12 sm:mb-16 w-full sm:w-auto">
              <Link
                href="/shop"
                className="group flex items-center justify-center gap-2 bg-amber-500 text-[#002B5E] px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-amber-400 transition-all shadow-lg hover:shadow-amber-500/30 hover:-translate-y-0.5 w-full sm:w-auto"
              >
                Start Shopping <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/contact"
                className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white border-2 border-white/20 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-white/20 hover:border-white/40 transition-all w-full sm:w-auto"
              >
                Contact Us
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-white/10">
              {[
                { icon: <ShieldCheck />, text: "Secure Products" },
                { icon: <Wrench />, text: "Professional Installation" },
                { icon: <PhoneCall />, text: "Reliable Support" }
              ].map((badge, idx) => (
                <div key={idx} className="flex items-center gap-3 text-white/90">
                  <div className="text-amber-400 bg-white/5 p-2 rounded-lg backdrop-blur-sm border border-white/10">
                    {badge.icon}
                  </div>
                  <span className="font-semibold">{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY SHOWCASE */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#002B5E] mb-3">Browse Categories</h2>
              <p className="text-gray-600 text-lg font-medium">Find the perfect security solution for your needs.</p>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/categories" className="hidden md:flex text-[#002B5E] font-bold items-center hover:text-amber-500 transition-colors gap-1">
                View All <ArrowRight className="w-5 h-5" />
              </Link>
              <div className="hidden md:flex gap-3">
                <button onClick={() => scrollCategorySlider('left')} className="p-3 rounded-full border border-gray-200 text-[#002B5E] hover:bg-[#002B5E] hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => scrollCategorySlider('right')} className="p-3 rounded-full border border-gray-200 text-[#002B5E] hover:bg-[#002B5E] hover:text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal Slider */}
          <div
            ref={categorySliderRef}
            className="flex overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide gap-6 md:gap-8 pt-4"
            style={{ scrollBehavior: 'smooth' }}
          >
            {categories.map((cat, idx) => (
              <Link
                href={`/shop?category=${cat.slug}`}
                key={cat.id}
                className="group relative flex-none w-[280px] sm:w-[320px] md:w-[400px] h-[320px] rounded-2xl overflow-hidden snap-start shadow-md hover:shadow-xl transition-shadow"
              >
                <Image src={cat.image_url || '/hero%202.jpg'} alt={cat.name} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001733]/90 via-[#001733]/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <p className="text-amber-400 text-sm font-bold tracking-wider uppercase mb-1">Explore</p>
                  <h3 className="text-white text-2xl font-bold group-hover:text-amber-400 transition-colors">{cat.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FEATURED PRODUCTS SLIDER */}
      <section className="py-16 md:py-24 bg-white border-y border-gray-100">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
            <div className="text-left w-full md:w-auto">
              <span className="text-sm font-bold tracking-widest text-amber-500 uppercase mb-2 block">Top Rated</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#002B5E] mb-2">Featured Products</h2>
            </div>
            <div className="hidden md:flex gap-3">
              <button onClick={() => scrollSlider('left')} className="p-3 rounded-full border border-gray-200 text-[#002B5E] hover:bg-[#002B5E] hover:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => scrollSlider('right')} className="p-3 rounded-full border border-gray-200 text-[#002B5E] hover:bg-[#002B5E] hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex gap-6 overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="min-w-[280px] w-[280px]"><ProductCardSkeleton /></div>
              ))}
            </div>
          ) : (
            <div
              ref={sliderRef}
              className="flex overflow-x-auto gap-6 sm:gap-8 pb-10 snap-x snap-mandatory scrollbar-hide pt-4"
              style={{ scrollBehavior: 'smooth' }}
            >
              {featuredProducts.map((product) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || product.price)) : undefined;
                const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
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

                return (
                  <div key={product.id} className="min-w-[280px] w-[280px] sm:min-w-[320px] sm:w-[320px] snap-start">
                    <ProductCard
                      id={product.id}
                      slug={product.slug}
                      name={product.name}
                      price={product.price}
                      originalPrice={product.compare_at_price}
                      image={product.product_images?.[0]?.url || 'https://via.placeholder.com/400x500'}
                      rating={product.rating_avg || 5}
                      reviewCount={product.review_count || 0}
                      badge={product.featured ? 'Featured' : undefined}
                      inStock={effectiveStock > 0}
                      maxStock={effectiveStock || 50}
                      moq={product.moq || 1}
                      hasVariants={hasVariants}
                      minVariantPrice={minVariantPrice}
                      colorVariants={colorVariants}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 4. PROMO SECTION 1 */}
      <section className="relative py-24 bg-[#001733] overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-white fill-current">
            <polygon points="100,0 100,100 0,100" />
          </svg>
        </div>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-white z-10 text-center md:text-left">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 leading-tight">
              Protect What <br /><span className="text-amber-400 drop-shadow-md">Matters Most</span>
            </h2>
            <p className="text-base sm:text-lg text-blue-50 font-medium mb-6 sm:mb-8 max-w-xl mx-auto md:mx-0 leading-relaxed text-opacity-90">
              Reliable Security Solutions for Homes and Businesses. From high-grade steel doors to intelligent surveillance systems, we provide the ultimate peace of mind.
            </p>
            <ul className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 text-left w-max mx-auto md:mx-0">
              {['24/7 Protection Capabilities', 'Weather-resistant Materials', 'Smart Home Integration', 'Vandal-proof Designs'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-blue-50 font-medium">
                  <CheckCircle2 className="text-amber-400 w-6 h-6" /> {item}
                </li>
              ))}
            </ul>
            <div className="flex justify-center md:justify-start">
              <Link href="/shop" className="inline-flex items-center justify-center gap-2 bg-amber-500 text-[#002B5E] px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-amber-400 transition-colors shadow-xl shadow-amber-500/20 w-full sm:w-auto">
                Explore Solutions
              </Link>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <div className="aspect-square w-full max-w-lg mx-auto relative rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border-8 border-[#002B5E]">
              {promoImages.map((src, idx) => (
                <div
                  key={src}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === promoIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                >
                  <Image
                    src={src}
                    fill
                    alt={`Security Control ${idx + 1}`}
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* 5. FOOTER CTA */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0b1c3c] rounded-3xl p-8 sm:p-12 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl shrink-0 pointer-events-none"></div>

            <div className="relative z-10 text-center md:text-left">
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">Need Security Advice?</h3>
              <p className="text-blue-200 text-lg font-medium max-w-xl">
                Not sure which products fit your building? Our experts are ready to guide you.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row gap-4 shrink-0">
              <a href="tel:0593610190" className="flex items-center justify-center gap-3 bg-white text-[#002B5E] px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg">
                <PhoneCall className="w-6 h-6" /> Call 059 361 0190
              </a>
              <a href="https://wa.me/233593517270" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-500 transition-colors shadow-lg">
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
