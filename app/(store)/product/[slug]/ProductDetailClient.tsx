'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import { StructuredData, generateProductSchema, generateBreadcrumbSchema } from '@/components/SEOHead';
import { notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { buildTelHref, buildWhatsAppHref, getImportProductMode, resolveContactWhatsApp } from '@/lib/snappy-import';
import { formatStoreMoney, STORE_CURRENCY } from '@/lib/currency';
import {
  buildAvailabilityWhatsAppText,
  buildProductInquiryWhatsAppText,
  getProductShareUrl,
  parseProductCommerce,
  resolveDirectPayment,
} from '@/lib/product-commerce';
import {
  getProductColorOptions,
  getSizeOptionsForColor,
  getVariantColor,
  getVariantSizeLabel,
  inferVariantSizeName,
  isColorOnlyCatalog,
  variantsForColor,
  formatVariantLabel,
} from '@/lib/product-variants';
import SocialShareButtons from '@/components/SocialShareButtons';
import ImportDetailsCard from '@/components/snappy/ImportDetailsCard';
import { ChevronRight, Heart, Star, Minus, Plus, ShoppingCart, ShieldCheck, RefreshCcw, Info, CheckCircle, AlertTriangle, XCircle, Store, Barcode, CheckCircle2, MessageCircle } from 'lucide-react';

// Map common color names to hex values for the swatch preview
function colorNameToHex(name: string): string {
  const map: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', pink: '#ec4899', black: '#111827',
    white: '#ffffff', gray: '#6b7280', grey: '#6b7280', brown: '#92400e',
    navy: '#1e3a5f', gold: '#d4a017', silver: '#c0c0c0', beige: '#f5f5dc',
    maroon: '#800000', teal: '#14b8a6', coral: '#ff7f50', ivory: '#fffff0',
    cream: '#fffdd0', burgundy: '#800020', lavender: '#e6e6fa', cyan: '#06b6d4',
    magenta: '#d946ef', olive: '#84cc16', peach: '#ffcba4', mint: '#98f5e1',
    rose: '#f43f5e', wine: '#722f37', charcoal: '#374151', sky: '#0ea5e9',
  };
  return map[name.toLowerCase().trim()] || '#d1d5db';
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  const { getSetting } = useCMS();
  const money = (n: number) => formatStoreMoney(n, getSetting('currency') || STORE_CURRENCY);
  usePageTitle(product?.name || 'Product');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        // Fetch main product (cached for 2 minutes)
        const { data: productData, error } = await cachedQuery<{ data: any; error: any }>(
          `product:${slug}`,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name, slug),
                product_variants(*),
                product_images(url, position, alt_text)
              `);

            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

            if (isUUID) {
              query = query.or(`id.eq.${slug},slug.eq.${slug}`);
            } else {
              query = query.eq('slug', slug);
            }

            return query.single() as any;
          },
          2 * 60 * 1000 // 2 minutes
        );

        if (error || !productData) {
          console.error('Error fetching product:', error);
          setLoading(false);
          return;
        }

        // Transform product data
        // Map variant colors from option2, and extract color_hex from metadata
        const rawVariants = (productData.product_variants || []).map((v: any) => ({
          ...v,
          color: v.option2 || '',
          colorHex: v.metadata?.color_hex || ''
        }));

        // Build a color-to-hex map from variants (prefer stored hex, fallback to colorNameToHex)
        const colorHexMap: Record<string, string> = {};
        rawVariants.forEach((v: any) => {
          if (v.color) {
            if (!colorHexMap[v.color]) {
              colorHexMap[v.color] = v.colorHex || colorNameToHex(v.color);
            }
          }
        });

        const transformedProduct = {
          ...productData,
          images: productData.product_images?.sort((a: any, b: any) => a.position - b.position).map((img: any) => img.url) || [],
          category: productData.categories?.name || 'Shop',
          categorySlug: productData.categories?.slug || '',
          rating: productData.rating_avg || 0,
          reviewCount: 0,
          stockCount: productData.quantity,
          moq: productData.moq || 1,
          colors: getProductColorOptions(rawVariants),
          colorHexMap,
          variants: rawVariants,
          sizes: rawVariants.map((v: any) => v.name) || [],
          features: ['Premium Quality', 'Authentic Design'],
          featured: ['Premium Quality', 'Authentic Design'],
          care: 'Handle with care.',
          preorderShipping: productData.metadata?.preorder_shipping || null,
          commerce: parseProductCommerce(productData.metadata),
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['https://via.placeholder.com/800x800?text=No+Image'];
        }

        setProduct(transformedProduct);

        // Set initial quantity to MOQ
        if (transformedProduct.moq > 1) {
          setQuantity(transformedProduct.moq);
        }

        // If variants exist, do NOT pre-select; force user to choose
        // Reset variant and color selection
        setSelectedVariant(null);
        setSelectedSize('');
        setSelectedColor('');

        // Fetch related products (cached for 5 minutes)
        if (productData.category_id) {
          const { data: related } = await cachedQuery<{ data: any; error: any }>(
            `related:${productData.category_id}:${productData.id}`,
            (() => supabase
              .from('products')
              .select('*, product_images(url, position), product_variants(id, name, price, quantity)')
              .eq('category_id', productData.category_id)
              .neq('id', productData.id)
              .limit(4)) as any,
            5 * 60 * 1000
          );

          if (related) {
            setRelatedProducts(related.map((p: any) => {
              const variants = p.product_variants || [];
              const hasVariants = variants.length > 0;
              const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
              const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
              const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
              return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.product_images?.[0]?.url || 'https://via.placeholder.com/800?text=No+Image',
                rating: p.rating_avg || 0,
                reviewCount: 0,
                inStock: effectiveStock > 0,
                maxStock: effectiveStock || 50,
                moq: p.moq || 1,
                hasVariants,
                minVariantPrice
              };
            }));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const hasVariants = product?.variants?.length > 0;
  const hasColors = (product?.colors?.length ?? 0) > 0;
  const colorOnlyCatalog = hasVariants && isColorOnlyCatalog(product?.variants || []);
  const needsColorSelection = hasColors && !selectedColor;
  const needsVariantSelection =
    hasVariants &&
    !selectedVariant &&
    (!hasColors || (Boolean(selectedColor) && !colorOnlyCatalog && getSizeOptionsForColor(product.variants, selectedColor, product.colors || []).length > 0));

  // Determine the active price: variant price if selected, otherwise base price
  const activePrice = selectedVariant?.price ?? product?.price ?? 0;
  const activeStock = selectedVariant ? (selectedVariant.stock ?? selectedVariant.quantity ?? product?.stockCount ?? 0) : (product?.stockCount ?? 0);

  const addCurrentSelectionToCart = (openCart: boolean): boolean => {
    if (!product) return false;
    if (needsColorSelection || needsVariantSelection) return false;

    // Color-only catalog: ensure a concrete variant row is attached
    let variantRow = selectedVariant;
    if (!variantRow && selectedColor && colorOnlyCatalog) {
      const matching = variantsForColor(product.variants || [], selectedColor);
      variantRow = matching[0] || null;
    }

    if (hasVariants && !variantRow) return false;

    const variantLabel = formatVariantLabel(variantRow, selectedColor) || undefined;

    addToCart(
      {
        id: product.id,
        name: product.name,
        price: activePrice,
        image: product.images[0],
        quantity: quantity,
        variant: variantLabel,
        variantId: variantRow?.id || undefined,
        slug: product.slug,
        maxStock: activeStock,
        moq: product.moq || 1
      },
      { openCart },
    );
    return true;
  };

  const handleAddToCart = () => {
    addCurrentSelectionToCart(true);
  };

  const handleBuyNow = () => {
    // Add silently and go straight to checkout. No basket detour.
    if (addCurrentSelectionToCart(false)) {
      window.location.href = '/checkout';
    }
  };

  if (loading) {
    return (
      <div className="store-page py-12 flex justify-center items-center">
        <div className="text-center">
          <RefreshCcw className="w-10 h-10 text-brand-primary animate-spin mb-4 block mx-auto" />
          <p className="text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="store-page py-20 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-primary mb-4">Product Not Found</h2>
          <Link href="/shop" className="text-brand-primary hover:underline">Return to Shop</Link>
        </div>
      </div>
    );
  }

  const discount = product.compare_at_price ? Math.round((1 - activePrice / product.compare_at_price) * 100) : 0;
  const minVariantPrice = hasVariants
    ? Math.min(...product.variants.map((v: any) => Number(v.price) || product.price))
    : product.price;
  const maxVariantPrice = hasVariants
    ? Math.max(...product.variants.map((v: any) => Number(v.price) || product.price))
    : product.price;
  const variantPricesDiffer = hasVariants && Math.abs(maxVariantPrice - minVariantPrice) > 0.009;
  const listedPrice = hasVariants ? minVariantPrice : product.price;
  const displayPrice = selectedVariant ? activePrice : listedPrice;
  const optionConfirmed = Boolean(selectedVariant) || !hasVariants;

  const colorPriceHints =
    hasVariants && product.colors?.length > 0
      ? product.colors
          .map((color: string) => {
            const matching = variantsForColor(product.variants, color);
            if (!matching.length) return null;
            const price = Math.min(
              ...matching.map((v: any) => Number(v.price) || product.price),
            );
            return { color, price };
          })
          .filter(Boolean) as { color: string; price: number }[]
      : [];
  const colorPricesDiffer =
    colorPriceHints.length > 1 &&
    Math.abs(
      Math.max(...colorPriceHints.map((h) => h.price)) -
        Math.min(...colorPriceHints.map((h) => h.price)),
    ) > 0.009;

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images[0],
    price: hasVariants ? minVariantPrice : product.price,
    currency: STORE_CURRENCY,
    sku: product.sku,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availability: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
    category: product.category
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: 'Shop', url: `${baseUrl}/shop` },
    { name: product.category, url: `${baseUrl}/shop?category=${product.category.toLowerCase().replace(/\s+/g, '-')}` },
    { name: product.name, url: `${baseUrl}/product/${slug}` }
  ]);

  const importMode = getImportProductMode(product.category, product.categorySlug);
  const shareUrl = getProductShareUrl(product.slug || slug);
  const waBase = buildWhatsAppHref(resolveContactWhatsApp(getSetting('contact_whatsapp')));
  const waInquiry = waBase
    ? `${waBase}${waBase.includes('?') ? '&' : '?'}text=${encodeURIComponent(buildProductInquiryWhatsAppText(product.name, shareUrl))}`
    : '';
  const waAvailability = waBase
    ? `${waBase}${waBase.includes('?') ? '&' : '?'}text=${encodeURIComponent(buildAvailabilityWhatsAppText(product.name, shareUrl))}`
    : '';
  const telDirect = buildTelHref(getSetting('contact_phone'));
  const allowOnlineCheckout = resolveDirectPayment(product.commerce?.directPayment ?? null, importMode);
  const showImportDetails = Boolean(product.commerce?.importType || product.commerce?.importNotes);
  const variantsForSelectedColor = selectedColor
    ? variantsForColor(product.variants, selectedColor)
    : [];
  const sizeOptionsForColor = selectedColor
    ? getSizeOptionsForColor(product.variants, selectedColor, product.colors || [])
    : [];
  const showSizeSelector =
    hasColors &&
    Boolean(selectedColor) &&
    !colorOnlyCatalog &&
    sizeOptionsForColor.length > 0;
  const variantsWithoutColors = hasVariants && !hasColors ? product.variants : [];

  return (
    <>
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="store-page">
        <section className="py-8 bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-2 text-sm flex-wrap gap-y-2">
              <Link href="/" className="text-gray-600 hover:text-brand-primary transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <Link href="/shop" className="text-gray-600 hover:text-brand-primary transition-colors">Shop</Link>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <Link
                href={product.categorySlug ? `/shop?category=${product.categorySlug}` : '/shop'}
                className="text-gray-600 hover:text-brand-primary transition-colors"
              >
                {product.category}
              </Link>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="text-brand-primary font-bold truncate max-w-[200px]">{product.name}</span>
            </nav>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <Image
                    src={product.images[selectedImage]}
                    alt={product.name}
                    fill
                    className="object-contain object-center p-5 sm:p-8 md:p-10"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                    quality={85}
                  />
                  {discount > 0 && (
                    <span className="absolute top-4 right-4 z-10 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                      Save {discount}%
                    </span>
                  )}
                </div>

                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-3 sm:gap-4">
                    {product.images.map((image: string, index: number) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedImage(index)}
                        className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-white transition-all cursor-pointer ${
                          selectedImage === index
                            ? 'border-brand-primary shadow-md'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Image
                          src={image}
                          alt={`${product.name} view ${index + 1}`}
                          fill
                          className="object-contain object-center p-2"
                          sizes="(max-width: 1024px) 25vw, 12vw"
                          quality={60}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-brand-primary font-semibold mb-2">{product.category}</p>
                    <h1 className="text-3xl lg:text-4xl font-extrabold text-brand-primary mb-3">{product.name}</h1>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <SocialShareButtons
                      url={shareUrl}
                      title={product.name}
                      description={product.description}
                      image={product.images[0]}
                    />
                    <button
                      onClick={() => setIsWishlisted(!isWishlisted)}
                      className="w-12 h-12 flex items-center justify-center border border-gray-200 hover:border-brand-accent rounded-full transition-all hover:shadow-md cursor-pointer"
                      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <Heart className={`w-6 h-6 transition-colors ${isWishlisted ? 'fill-brand-accent text-brand-accent' : 'text-gray-700'}`} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center mb-6">
                  <div className="flex items-center space-x-1 mr-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${star <= Math.round(product.rating) ? 'fill-brand-accent text-brand-accent' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <span className="text-gray-700 font-medium">{Number(product.rating).toFixed(1)}</span>
                </div>

                <div className="mb-6">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-3xl font-bold text-gray-900 lg:text-4xl">
                      {money(displayPrice)}
                    </span>
                    {product.compare_at_price && product.compare_at_price > displayPrice ? (
                      <span className="text-xl text-gray-400 line-through">
                        {money(product.compare_at_price)}
                      </span>
                    ) : null}
                  </div>
                  {hasVariants && !optionConfirmed ? (
                    <p className="mt-1.5 text-sm text-gray-500">
                      Price updates when you pick an option.
                      {variantPricesDiffer
                        ? ` Options run ${money(minVariantPrice)} to ${money(maxVariantPrice)}.`
                        : ''}
                    </p>
                  ) : null}
                  {hasVariants && optionConfirmed ? (
                    <p className="mt-1.5 text-sm font-medium text-brand-primary">
                      Your price for this option.
                    </p>
                  ) : null}
                </div>

                <p className="text-gray-700 leading-relaxed mb-6 text-lg">{product.description}</p>

                {showImportDetails ? (
                  <ImportDetailsCard
                    importType={product.commerce.importType}
                    importNotes={product.commerce.importNotes}
                    priceLabel={product.commerce.importType ? undefined : 'as shown'}
                  />
                ) : null}

                {/* Color Selector */}
                {hasVariants && product.colors.length > 0 && (
                  <div className="mb-6">
                    <label className="block font-semibold text-gray-900 mb-3">
                      Color: {selectedColor ? (
                        <span className="text-brand-primary font-normal">{selectedColor}</span>
                      ) : (
                        <span className="text-red-500 font-normal text-sm">Please select a color</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {product.colors.map((color: string) => {
                        const isSelected = selectedColor === color;
                        const colorVariants = variantsForColor(product.variants, color);
                        const colorStock = colorVariants.reduce(
                          (sum: number, v: any) => sum + (v.stock ?? v.quantity ?? 0),
                          0,
                        );
                        const isOutOfStock = colorStock === 0 && product.stockCount === 0;
                        return (
                          <button
                            key={color}
                            onClick={() => {
                              setSelectedColor(color);
                              const matching = variantsForColor(product.variants, color);
                              const colorOnlyMatch = matching.find(
                                (v: any) =>
                                  inferVariantSizeName(getVariantColor(v), v.name || '') === '',
                              );
                              if (colorOnlyMatch) {
                                setSelectedVariant(colorOnlyMatch);
                                setSelectedSize(getVariantSizeLabel(colorOnlyMatch));
                              } else if (matching.length === 1) {
                                setSelectedVariant(matching[0]);
                                setSelectedSize(getVariantSizeLabel(matching[0]));
                              } else {
                                setSelectedVariant(null);
                                setSelectedSize('');
                              }
                            }}
                            disabled={isOutOfStock}
                            className={`px-5 py-2.5 rounded-full border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${isSelected
                              ? 'border-brand-primary bg-brand-light text-brand-primary shadow-sm'
                              : isOutOfStock
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                              }`}
                          >
                            <span className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0 shadow-sm" style={{ backgroundColor: product.colorHexMap?.[color] || colorNameToHex(color) }}></span>
                            <span>{color}</span>
                          </button>
                        );
                      })}
                    </div>
                    {colorPricesDiffer ? (
                      <p className="mt-3 text-sm text-gray-600">
                        {colorPriceHints
                          .map((h) => `${h.color} ${money(h.price)}`)
                          .join(', ')}
                      </p>
                    ) : null}
                  </div>
                )}

                {/* Size / Type — only options for the selected color */}
                {showSizeSelector && (
                  <div className="mb-8">
                    <label className="block font-semibold text-gray-900 mb-3">
                      Size / Type: {selectedVariant ? (
                        <span className="text-brand-primary font-normal">
                          {getVariantSizeLabel(selectedVariant)}: {money(selectedVariant.price || 0)}
                        </span>
                      ) : (
                        <span className="text-red-500 font-normal text-sm">Please select</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {variantsForSelectedColor
                        .filter((variant: any) => {
                          const label = getVariantSizeLabel(variant);
                          return label && label.toLowerCase() !== selectedColor.trim().toLowerCase();
                        })
                        .map((variant: any) => {
                          const isSelected = selectedVariant?.id === variant.id;
                          const variantStock = variant.stock ?? variant.quantity ?? 0;
                          const isOutOfStock = variantStock === 0 && product.stockCount === 0;
                          const sizeLabel = getVariantSizeLabel(variant);
                          return (
                            <button
                              key={variant.id || `${getVariantColor(variant)}-${sizeLabel}`}
                              onClick={() => {
                                setSelectedVariant(variant);
                                setSelectedSize(sizeLabel);
                              }}
                              disabled={isOutOfStock}
                              className={`px-6 py-3 rounded-lg border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center ${isSelected
                                ? 'border-brand-primary bg-brand-light text-brand-primary shadow-sm'
                                : isOutOfStock
                                  ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
                                }`}
                            >
                              <span>{sizeLabel}</span>
                              <span className={`text-xs mt-0.5 ${isSelected ? 'text-brand-accent' : 'text-gray-500'}`}>
                                {money(variant.price || product.price)}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Products without colors — pick variant directly */}
                {variantsWithoutColors.length > 0 && (
                  <div className="mb-8">
                    <label className="block font-semibold text-gray-900 mb-3">
                      Variant: {selectedVariant ? (
                        <span className="text-brand-primary font-normal">
                          {getVariantSizeLabel(selectedVariant)}: {money(selectedVariant.price || 0)}
                        </span>
                      ) : (
                        <span className="text-red-500 font-normal text-sm">Please select a variant</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {variantsWithoutColors.map((variant: any) => {
                        const isSelected = selectedVariant?.id === variant.id;
                        const variantStock = variant.stock ?? variant.quantity ?? 0;
                        const isOutOfStock = variantStock === 0 && product.stockCount === 0;
                        const label = getVariantSizeLabel(variant) || 'Default';
                        return (
                          <button
                            key={variant.id || label}
                            onClick={() => {
                              setSelectedVariant(variant);
                              setSelectedSize(label);
                            }}
                            disabled={isOutOfStock}
                            className={`px-6 py-3 rounded-lg border-2 font-medium transition-all whitespace-nowrap cursor-pointer flex flex-col items-center ${isSelected
                              ? 'border-brand-primary bg-brand-light text-brand-primary shadow-sm'
                              : isOutOfStock
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                                : 'border-gray-300 text-gray-700 hover:border-gray-400'
                              }`}
                          >
                            <span>{label}</span>
                            <span className={`text-xs mt-0.5 ${isSelected ? 'text-brand-accent' : 'text-gray-500'}`}>
                              {money(variant.price || product.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Combined Purchase Actions Panel */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm mb-8">
                  {allowOnlineCheckout && (
                    <div className="mb-5 flex flex-col sm:flex-row sm:items-end gap-4">
                      <div className="flex-1">
                        <label className="block font-semibold text-gray-900 mb-2">Quantity</label>
                        <div className="flex items-center border-2 border-gray-300 rounded-xl max-w-[140px] bg-white">
                          <button
                            onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                            className="w-12 h-12 flex items-center justify-center text-gray-600 hover:text-brand-primary transition-colors cursor-pointer disabled:opacity-50"
                            disabled={activeStock === 0 || quantity <= (product.moq || 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(product.moq || 1, Math.min(activeStock, parseInt(e.target.value) || (product.moq || 1))))}
                            className="w-full h-12 text-center border-x-2 border-gray-300 focus:outline-none text-lg font-bold text-gray-900"
                            min={product.moq || 1}
                            max={activeStock}
                            disabled={activeStock === 0}
                          />
                          <button
                            onClick={() => setQuantity(Math.min(activeStock, quantity + 1))}
                            className="w-12 h-12 flex items-center justify-center text-gray-600 hover:text-brand-primary transition-colors cursor-pointer disabled:opacity-50"
                            disabled={activeStock === 0}
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1 text-sm pt-1">
                        {product.moq > 1 && (
                          <span className="text-brand-primary font-medium flex items-center">
                            <Info className="w-4 h-4 mr-1.5" />
                            Min. order: {product.moq} units
                          </span>
                        )}
                        {activeStock > 10 && (
                          <span className="text-gray-600 font-medium flex items-center">
                            <CheckCircle className="w-4 h-4 text-green-600 mr-1.5" />
                            {activeStock} in stock
                          </span>
                        )}
                        {activeStock > 0 && activeStock <= 10 && (
                          <span className="text-brand-accent font-medium flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1.5" />
                            Only {activeStock} left
                          </span>
                        )}
                        {activeStock === 0 && (
                          <span className="text-red-600 font-bold flex items-center">
                            <XCircle className="w-4 h-4 mr-1.5" />
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {allowOnlineCheckout && (
                      <>
                        <button
                          disabled={activeStock === 0 || needsVariantSelection || needsColorSelection}
                          className={`w-full flex items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold text-white transition-all shadow-sm ${
                            activeStock === 0 || needsVariantSelection || needsColorSelection
                              ? 'bg-brand-primary/50 cursor-not-allowed'
                              : 'bg-brand-primary hover:bg-brand-primary/90 hover:shadow-md hover:-translate-y-0.5'
                          }`}
                          onClick={handleBuyNow}
                        >
                          <span>
                            {activeStock === 0
                              ? 'Out of Stock'
                              : needsColorSelection
                                ? 'Select a Color'
                                : needsVariantSelection
                                  ? 'Select a Variant'
                                  : 'Buy now'}
                          </span>
                        </button>

                        {activeStock > 0 && !needsVariantSelection && !needsColorSelection && (
                          <button
                            onClick={handleAddToCart}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-brand-primary/20 bg-white px-5 py-3 text-base font-bold text-brand-primary transition-all hover:border-brand-primary/40 hover:bg-brand-light"
                          >
                            <ShoppingCart className="w-5 h-5" />
                            Add to basket instead
                          </button>
                        )}
                      </>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      {waInquiry && (
                        <a
                          href={waInquiry}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-[#20bd5a] hover:shadow-md"
                        >
                          <MessageCircle className="h-5 w-5" />
                          Chat on WhatsApp
                        </a>
                      )}
                      {!allowOnlineCheckout && waAvailability && (
                        <a
                          href={waAvailability}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-brand-primary bg-white px-5 py-3 text-base font-bold text-brand-primary transition-colors hover:bg-brand-light"
                        >
                          <MessageCircle className="h-5 w-5 text-brand-accent" />
                          Request Availability
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {!allowOnlineCheckout && (
                  <div className="mb-8 rounded-xl border border-brand-accent/25 bg-brand-accent/10 px-4 py-3 text-sm text-brand-primary flex items-start gap-3">
                    <Info className="w-5 h-5 shrink-0 text-brand-accent mt-0.5" />
                    <p>
                      {importMode === 'vehicles' && 'Want this vehicle? Message us to reserve it. We walk you through every step.'}
                      {importMode === 'equipment' && 'Need a quote first? We confirm specs and full cost before you pay.'}
                      {importMode !== 'vehicles' && importMode !== 'equipment' && 'Online checkout is not enabled for this item. Chat with us or request availability first.'}
                    </p>
                  </div>
                )}

                {telDirect ? (
                  <p className="mb-6 text-sm text-gray-500">
                    Prefer a call?{' '}
                    <a href={telDirect} className="font-semibold text-brand-primary hover:text-brand-accent">
                      Phone us
                    </a>
                  </p>
                ) : null}

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <div className="flex items-center text-gray-700">
                    <Store className="w-5 h-5 text-brand-primary mr-3" />
                    <span>Free store pickup available</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <RefreshCcw className="w-5 h-5 text-brand-primary mr-3" />
                    <span>30-day easy returns and exchanges</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <ShieldCheck className="w-5 h-5 text-brand-primary mr-3" />
                    <span>Secure payment & buyer protection</span>
                  </div>
                  {product.sku && (
                    <div className="flex items-center text-gray-700">
                      <Barcode className="w-5 h-5 text-brand-primary mr-3" />
                      <span>SKU: {product.sku}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="border-b border-gray-300 mb-8">
              <div className="flex space-x-4 sm:space-x-8 overflow-x-auto">
                {['description', 'features', 'care', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 font-bold transition-colors relative whitespace-nowrap cursor-pointer ${activeTab === tab
                      ? 'text-brand-primary border-b-2 border-brand-accent'
                      : 'text-gray-500 hover:text-brand-primary'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <p className="text-gray-700 text-lg leading-relaxed">{product.description}</p>
              </div>
            )}

            {activeTab === 'features' && (
              <div>
                <h3 className="text-2xl font-bold text-brand-primary mb-6">Key Features</h3>
                <ul className="grid md:grid-cols-2 gap-4">
                  {product.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-brand-accent mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-lg">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTab === 'care' && (
              <div>
                <h3 className="text-2xl font-bold text-brand-primary mb-6">Care Instructions</h3>
                <p className="text-gray-700 text-lg leading-relaxed">{product.care}</p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div id="reviews">
                <ProductReviews productId={product.id} />
              </div>
            )}
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="store-section bg-white/20 backdrop-blur-sm" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-extrabold text-brand-primary mb-4">You May Also Like</h2>
                <p className="text-lg text-gray-500 font-medium">Curated recommendations based on this product</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} {...p} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Mobile: price + add to basket always within thumb reach (sits above MobileBottomNav on phones) */}
        {allowOnlineCheckout && (
          <div className="fixed inset-x-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(11,31,58,0.06)] backdrop-blur lg:hidden bottom-[calc(3.4rem+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2.5">
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight text-brand-primary">{money(displayPrice)}</p>
                <p className="truncate text-[11px] text-gray-500">
                  {activeStock === 0
                    ? 'Out of stock'
                    : !optionConfirmed
                      ? 'Pick an option above'
                      : quantity > 1
                        ? `Qty ${quantity}`
                        : 'Full price'}
                </p>
              </div>
              {activeStock > 0 && !needsVariantSelection && !needsColorSelection && (
                <button
                  onClick={handleAddToCart}
                  aria-label="Add to basket"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-brand-primary/20 bg-white text-brand-primary active:bg-brand-light"
                >
                  <ShoppingCart className="h-5 w-5" />
                </button>
              )}
              <button
                disabled={activeStock === 0 || needsVariantSelection || needsColorSelection}
                onClick={handleBuyNow}
                className={`flex-1 rounded-xl py-3.5 text-base font-bold text-white transition-colors ${
                  activeStock === 0 || needsVariantSelection || needsColorSelection
                    ? 'bg-brand-primary/40'
                    : 'bg-brand-primary active:bg-brand-primary/90'
                }`}
              >
                {activeStock === 0
                  ? 'Out of stock'
                  : needsColorSelection
                    ? 'Pick a color above'
                    : needsVariantSelection
                      ? 'Pick an option above'
                      : 'Buy now'}
              </button>
            </div>
          </div>
        )}
        {/* Keep page content clear of the fixed bar + bottom nav */}
        {allowOnlineCheckout && <div className="h-36 md:h-20 lg:hidden" aria-hidden />}
      </main>
    </>
  );
}
