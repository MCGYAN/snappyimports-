'use client';

import { useState } from 'react';
import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCMS } from '@/context/CMSContext';
import { getImportProductMode, type ImportProductMode } from '@/lib/snappy-import';
import { ShoppingCart, Heart } from 'lucide-react';

const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#EF4444', blue: '#3B82F6',
  navy: '#1E3A5F', green: '#22C55E', yellow: '#EAB308', orange: '#F97316',
  grey: '#6B7280', gray: '#6B7280', silver: '#C0C0C0', gold: '#FFD700',
  bronze: '#CD7F32', brown: '#8B4513'
};

export function getColorHex(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export interface ColorVariant {
  name: string;
  hex: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  inStock?: boolean;
  maxStock?: number;
  moq?: number;
  hasVariants?: boolean;
  minVariantPrice?: number;
  colorVariants?: ColorVariant[];
  shortDescription?: string;
  categoryName?: string;
  categorySlug?: string;
  /** Tighter layout for homepage 2×2 mobile grid */
  compact?: boolean;
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  rating = 5,
  reviewCount = 0,
  badge,
  inStock = true,
  maxStock = 50,
  moq = 1,
  hasVariants = false,
  minVariantPrice,
  colorVariants = [],
  shortDescription,
  categoryName,
  categorySlug,
  compact = false,
}: ProductCardProps) {
  const { addToCart } = useCart();
  const wishlist = useWishlist();
  const { getSetting } = useCMS();
  const [activeColor, setActiveColor] = useState<string | null>(null);

  const sym = getSetting('currency_symbol') || 'GH¢';
  const displayPrice = hasVariants && minVariantPrice ? minVariantPrice : price;
  const discount = originalPrice ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;
  const isWishlisted = wishlist?.isInWishlist(id) ?? false;
  const MAX_SWATCHES = 4;
  const mode: ImportProductMode = getImportProductMode(categoryName, categorySlug);

  const formatPrice = (val: number) => `${sym}${val.toFixed(2)}`;

  const priceLabel = () => {
    if (mode === 'equipment') return 'Request quote';
    if (hasVariants && minVariantPrice) return formatPrice(minVariantPrice);
    return formatPrice(price);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWishlisted) wishlist?.removeFromWishlist(id);
    else wishlist?.addToWishlist({ id, name, price, originalPrice, image, rating, reviewCount, badge, inStock, slug });
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq });
  };

  const cartButtonClass = `btn-interactive flex shrink-0 items-center justify-center bg-brand-accent text-white font-bold transition-all shadow-[0_4px_12px_rgba(242,107,29,0.25)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(242,107,29,0.35)] disabled:pointer-events-none disabled:opacity-50 ${
    compact ? 'h-8 rounded-lg px-3 text-[10px] lg:h-9 lg:rounded-xl lg:px-4 lg:text-xs' : 'h-9 rounded-xl px-3 text-[11px] sm:h-10 sm:px-5 sm:text-xs'
  }`;
  const openProductForOptions =
    mode === 'vehicles' || mode === 'equipment' || hasVariants;

  return (
    <div className={`group liquid-glass-card liquid-glass-card-interactive flex h-full flex-col overflow-hidden ${compact ? 'max-lg:rounded-xl' : ''}`}>
      {/* Product Image */}
      <Link
        href={`/product/${slug}`}
        className={`relative block w-full shrink-0 overflow-hidden liquid-glass-well ${
          compact
            ? 'aspect-square max-lg:p-2.5 lg:aspect-[4/3] lg:p-6'
            : 'aspect-[4/3] p-5 sm:p-6'
        }`}
      >
        <LazyImage
          src={image}
          alt={name}
          fit="contain"
          className="h-full w-full object-contain transition-transform duration-500 ease-out mix-blend-multiply md:group-hover:scale-[1.05]"
          sizes={compact ? '(max-width: 1024px) 45vw, 25vw' : '(max-width: 640px) 72vw, 260px'}
        />

        <div className={`absolute left-3 top-3 z-10 flex flex-col gap-1.5 ${compact ? 'max-lg:left-2 max-lg:top-2' : ''}`}>
          {badge && (
            <span className="rounded-full bg-brand-primary/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              {badge}
            </span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-brand-accent/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-sm">
              -{discount}%
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleWishlistToggle}
          className={`absolute right-3 top-3 z-20 flex items-center justify-center rounded-full bg-white/80 text-slate-400 shadow-sm backdrop-blur-sm ring-1 ring-slate-200 transition-all duration-300 hover:scale-110 hover:bg-white hover:text-red-500 hover:shadow-md ${
            compact ? 'h-7 w-7 max-lg:right-2 max-lg:top-2 lg:h-8 lg:w-8' : 'h-8 w-8'
          }`}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`transition-colors ${compact ? 'h-3.5 w-3.5 lg:h-4 lg:w-4' : 'h-4 w-4'} ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        {!inStock && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <span className="liquid-glass-inset rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
              Out of Stock
            </span>
          </div>
        )}
      </Link>

      <div className={`flex flex-1 flex-col ${compact ? 'p-3 max-lg:pt-2.5 lg:p-6' : 'p-5 sm:p-6'}`}>
        <div className={`mb-1.5 flex items-center justify-between gap-2 ${compact ? 'max-lg:mb-1' : ''}`}>
          {categoryName ? (
            <span className={`truncate font-bold uppercase tracking-widest text-brand-accent ${compact ? 'max-lg:hidden text-[10px] lg:text-[10px]' : 'text-[9px] sm:text-[10px]'}`}>
              {categoryName}
            </span>
          ) : (
            <span />
          )}
          {(rating > 0 || reviewCount > 0) && (
            <div className={`flex shrink-0 items-center gap-0.5 ${compact ? 'max-lg:ml-auto' : ''}`}>
              <svg className="h-3 w-3 text-brand-accent" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-[10px] font-semibold text-slate-600 sm:text-[11px]">
                {rating.toFixed(1)}
                {reviewCount > 0 && <span className="text-slate-400"> ({reviewCount})</span>}
              </span>
            </div>
          )}
        </div>

        <Link href={`/product/${slug}`}>
          <h3 className={`font-heading line-clamp-2 font-bold leading-snug text-brand-primary transition-colors group-hover:text-brand-accent ${compact ? 'text-[12px] max-lg:line-clamp-2 lg:text-[15px]' : 'text-[14px] sm:text-[15px]'}`}>
            {name}
          </h3>
        </Link>

        {shortDescription && (
          <p className="mt-1 hidden line-clamp-1 text-xs text-slate-500 sm:block">{shortDescription}</p>
        )}

        {colorVariants.length > 0 && (
          <div className={`mt-2 flex items-center gap-1 ${compact ? 'max-lg:hidden' : ''}`}>
            {colorVariants.slice(0, MAX_SWATCHES).map((color) => (
              <button
                key={color.name}
                title={color.name}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveColor(activeColor === color.name ? null : color.name);
                }}
                className={`h-3.5 w-3.5 rounded-full border border-white shadow-sm transition-all sm:h-4 sm:w-4 ${activeColor === color.name ? 'ring-2 ring-brand-accent ring-offset-1' : 'hover:scale-110'}`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
            {colorVariants.length > MAX_SWATCHES && (
              <span className="ml-0.5 text-[9px] font-bold text-slate-400">
                +{colorVariants.length - MAX_SWATCHES}
              </span>
            )}
          </div>
        )}

        <div className={`mt-auto flex items-end justify-between gap-2 border-t border-slate-100 ${compact ? 'max-lg:pt-2.5 lg:gap-3 lg:pt-5' : 'gap-3 pt-4 sm:pt-5'}`}>
          <div className="min-w-0 flex-1">
            {originalPrice && originalPrice > displayPrice && (
              <span className={`block font-medium text-slate-400 line-through ${compact ? 'text-[10px] lg:text-xs' : 'text-[11px] sm:text-xs'}`}>
                {formatPrice(originalPrice)}
              </span>
            )}
            <span className={`font-heading block font-black leading-tight text-brand-primary ${compact ? 'text-[13px] line-clamp-2 lg:text-lg' : 'text-base line-clamp-2 sm:text-lg'}`}>
              {priceLabel()}
            </span>
          </div>

          <div className="shrink-0 mt-0.5">
            {openProductForOptions ? (
              <Link
                href={`/product/${slug}`}
                className={cartButtonClass}
                aria-label="View product options to order"
              >
                Order now
              </Link>
            ) : (
              <button
                onClick={(e) => {
                  // Direct Buy Now functionality
                  e.preventDefault();
                  e.stopPropagation();
                  addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq }, { openCart: false });
                  window.location.href = '/checkout';
                }}
                disabled={!inStock}
                className={cartButtonClass}
                aria-label={moq > 1 ? `Order ${moq} now` : 'Order now'}
              >
                Order now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
