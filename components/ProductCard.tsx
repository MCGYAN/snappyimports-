'use client';

import { useState } from 'react';
import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
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
  shortDescription
}: ProductCardProps) {
  const { addToCart } = useCart();
  const wishlist = useWishlist();
  const [activeColor, setActiveColor] = useState<string | null>(null);

  const displayPrice = hasVariants && minVariantPrice ? minVariantPrice : price;
  const discount = originalPrice ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;
  const isWishlisted = wishlist?.isInWishlist(id) ?? false;
  const MAX_SWATCHES = 4;

  const formatPrice = (val: number) => `GH\u20B5${val.toFixed(2)}`;

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

  return (
    <div className="group bg-white rounded-xl h-full flex flex-col border border-gray-100 hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-300 overflow-hidden relative">

      {/* Product Image Section */}
      <Link href={`/product/${slug}`} className="relative block aspect-[4/5] overflow-hidden bg-gray-50/50 p-2 sm:p-4">
        <LazyImage
          src={image}
          alt={name}
          className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500 ease-out drop-shadow-sm"
        />

        {/* Badges */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1.5 sm:gap-2 z-10">
          {badge && (
            <span className="bg-[#002B5E] text-white text-[9px] sm:text-[10px] uppercase tracking-wider font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-md shadow-sm">
              {badge}
            </span>
          )}
          {discount > 0 && (
            <span className="bg-amber-500 text-[#001733] text-[9px] sm:text-[10px] uppercase tracking-wider font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-md shadow-sm">
              -{discount}%
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center shadow-md border border-gray-100/50 text-gray-400 hover:text-red-500 hover:scale-110 transition-all duration-200"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
        </button>

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
            <span className="bg-gray-900 text-white px-4 py-2 rounded-md justify-center text-xs font-bold uppercase tracking-wider">Out of Stock</span>
          </div>
        )}
      </Link>

      {/* Product Info Section */}
      <div className="flex flex-col flex-grow p-3 sm:p-5 text-left bg-white">

        {/* Rating */}
        {(rating > 0 || reviewCount > 0) && (
          <div className="flex items-center gap-1 mb-1.5 sm:mb-2">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${i < Math.floor(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            {reviewCount > 0 && <span className="text-[10px] sm:text-xs text-gray-500 ml-1">({reviewCount})</span>}
          </div>
        )}

        <Link href={`/product/${slug}`}>
          <h3 className="font-bold text-[#002B5E] text-sm sm:text-[15px] leading-snug mb-1.5 sm:mb-2 group-hover:text-amber-500 transition-colors line-clamp-2">
            {name}
          </h3>
        </Link>

        {/* Short Description */}
        {shortDescription ? (
          <p className="hidden sm:block text-[11px] sm:text-xs text-gray-500 line-clamp-2 mb-2 sm:mb-3 leading-relaxed">
            {shortDescription}
          </p>
        ) : (
          <p className="hidden sm:block text-[11px] sm:text-xs text-gray-500 line-clamp-2 mb-2 sm:mb-3 leading-relaxed">
            Premium security and reliability for modern requirements.
          </p>
        )}

        {/* Colors */}
        {colorVariants.length > 0 && (
          <div className="flex items-center gap-1 sm:gap-1.5 mb-2 sm:mb-3 mt-auto pt-2">
            {colorVariants.slice(0, MAX_SWATCHES).map((color) => (
              <button
                key={color.name}
                title={color.name}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveColor(activeColor === color.name ? null : color.name);
                }}
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-gray-200 transition-all ${activeColor === color.name ? 'ring-2 ring-offset-1 ring-amber-400 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
            {colorVariants.length > MAX_SWATCHES && (
              <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium">+{colorVariants.length - MAX_SWATCHES}</span>
            )}
          </div>
        )}

        {/* Price & Action Row */}
        <div className="flex items-center justify-between mt-auto border-t border-gray-50 pt-2 sm:pt-3">
          <div className="flex flex-col">
            {originalPrice && (
              <span className="text-[10px] sm:text-[11px] text-gray-400 line-through mb-0.5">{formatPrice(originalPrice)}</span>
            )}
            <span className="text-[#002B5E] font-extrabold text-sm sm:text-base flex flex-wrap">
              {hasVariants && minVariantPrice ? `From ${formatPrice(minVariantPrice)}` : formatPrice(price)}
            </span>
          </div>

          <div className="flex-shrink-0 ml-1.5 sm:ml-2">
            {hasVariants ? (
              <Link
                href={`/product/${slug}`}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-[#f4f7fa] text-[#002B5E] rounded-full hover:bg-amber-500 hover:text-white transition-colors"
                aria-label="Select Options"
              >
                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={!inStock}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-[#002B5E] text-white rounded-full hover:bg-amber-500 hover:text-white transition-colors shadow-sm shadow-[#002B5E]/20 disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-105"
                aria-label={moq > 1 ? `Add ${moq} to Cart` : 'Add to Cart'}
              >
                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
