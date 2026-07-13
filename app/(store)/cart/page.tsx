'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import PageHero from '@/components/PageHero';
import CartCountdown from '@/components/CartCountdown';
import AdvancedCouponSystem from '@/components/AdvancedCouponSystem';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ShoppingCart, Trash2, Minus, Plus, ShieldCheck, RefreshCcw, HeadphonesIcon, X } from 'lucide-react';
import { formatStoreMoney } from '@/lib/currency';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';

export default function CartPage() {
  usePageTitle('Shopping Cart');
  const { cart: cartItems, removeFromCart, updateQuantity, subtotal, addToCart } = useCart();
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

  const applyCoupon = (coupon: any) => {
    setAppliedCoupon(coupon);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const savings = 0;

  let couponDiscount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      couponDiscount = subtotal * (appliedCoupon.discount / 100);
    } else {
      couponDiscount = appliedCoupon.discount;
    }
  }

  // Same rule as checkout: pickup is free, doorstep delivery is quoted after the order.
  // The total shown here must match the checkout total exactly.
  const total = subtotal - couponDiscount;

  return (
    <div className="store-page flex flex-col">
      <PageHero
        title="Your basket"
        subtitle="Check your items before checkout. You are one step closer to home delivery."
      />

      <div className="store-container store-section flex-grow w-full">
        <CartCountdown />

        {cartItems.length === 0 ? (
          <section className="py-20">
            <div className="store-card mx-auto max-w-md p-12 text-center">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-brand-light rounded-full text-brand-primary">
                <ShoppingCart className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-brand-primary mb-4">Your basket is empty</h2>
              <p className="text-gray-600 mb-8 font-medium">Find something you want to import. Add it here when you are ready.</p>
              <Link href="/shop" className="btn-primary inline-block bg-brand-primary px-8 py-4 rounded-lg font-bold text-white whitespace-nowrap hover:bg-brand-accent">
                Browse imports
              </Link>
            </div>
          </section>
        ) : (
          <section className="py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="store-card p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                    <h2 className="text-2xl font-bold text-brand-primary">Basket Items ({cartItems.length})</h2>
                    {savings > 0 && (
                      <span className="text-brand-accent font-bold bg-brand-accent/10 px-3 py-1 rounded-full text-sm">
                        You save {formatStoreMoney(savings)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-8">
                    {cartItems.map((item) => (
                      <div key={`${item.id}-${item.variant || ''}`} className="flex flex-col sm:flex-row gap-6 pb-8 border-b border-gray-100 last:border-0 last:pb-0 relative group">

                        <Link href={`/product/${item.slug || item.id}`} className="relative w-full sm:w-32 h-40 sm:h-32 flex-shrink-0 liquid-glass-well rounded-xl overflow-hidden p-2">
                          <Image src={item.image} alt={item.name} fill className="object-contain mix-blend-multiply drop-shadow-sm group-hover:scale-110 transition-transform duration-500" sizes="(max-width: 640px) 100vw, 128px" quality={80} />
                        </Link>

                        <div className="flex-1 flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2 pr-8">
                            <Link href={`/product/${item.slug || item.id}`} className="text-lg font-bold text-brand-primary hover:text-brand-accent transition-colors line-clamp-2 leading-snug">
                              {item.name}
                            </Link>
                          </div>

                          <div className="text-sm text-gray-500 mb-4 space-y-1 font-medium">
                            {item.variant && (
                              <p className="bg-brand-light inline-block px-2 py-0.5 rounded text-brand-primary font-semibold">
                                {cleanVariantDisplayLabel(item.variant)}
                              </p>
                            )}
                            <p className="text-green-600 flex items-center gap-1">
                              <ShieldCheck className="w-4 h-4" /> In Stock
                            </p>
                          </div>

                          <div className="flex items-center justify-between flex-wrap gap-4 mt-auto">
                            <span className="text-xl font-extrabold text-brand-primary">{formatStoreMoney(item.price)}</span>

                            <div className="flex items-center space-x-4">
                              <div className="flex h-10 items-center overflow-hidden rounded-lg border border-white/50 liquid-glass-well shadow-sm">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-white hover:text-brand-primary transition-all"
                                  title={item.quantity <= (item.moq || 1) ? 'Remove item' : 'Decrease quantity'}
                                >
                                  {item.quantity <= (item.moq || 1) ? (
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  ) : (
                                    <Minus className="w-4 h-4" />
                                  )}
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || (item.moq || 1), item.variant)}
                                  className="w-12 h-full text-center border-x border-gray-200 focus:outline-none font-bold text-brand-primary bg-white appearance-none"
                                  min={item.moq || 1}
                                  max={item.maxStock}
                                />
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-white hover:text-brand-primary transition-all"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromCart(item.id, item.variant)}
                            className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                            aria-label="Remove item"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="store-card sticky top-24 p-6 sm:p-8">
                  <h3 className="text-xl font-bold text-brand-primary mb-6 pb-4 border-b border-gray-100">Order Summary</h3>

                  <div className="space-y-4 mb-6 text-[15px] font-medium text-gray-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-bold text-gray-900">{formatStoreMoney(subtotal)}</span>
                    </div>

                    {appliedCoupon && (
                      <div className="flex justify-between text-brand-accent">
                        <span>Coupon ({appliedCoupon.code})</span>
                        <span className="font-bold">-{formatStoreMoney(couponDiscount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Delivery</span>
                      <span className="font-bold text-gray-900">Free pickup</span>
                    </div>
                    <p className="text-xs text-gray-400">Doorstep delivery is quoted after your order.</p>
                  </div>

                  <div className="border-t border-gray-200 pt-6 mb-8">
                    <div className="flex justify-between items-center text-2xl font-black text-brand-primary">
                      <span>Total</span>
                      <span>{formatStoreMoney(total)}</span>
                    </div>
                  </div>

                  <AdvancedCouponSystem
                    subtotal={subtotal}
                    onApply={applyCoupon}
                    onRemove={removeCoupon}
                    appliedCoupon={appliedCoupon}
                  />

                  <Link
                    href="/checkout"
                    className="btn-primary mt-6 mb-4 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-accent py-4 text-lg font-bold text-white hover:bg-brand-accent/92"
                  >
                    <ShieldCheck className="w-5 h-5" /> Checkout
                  </Link>

                  <Link
                    href="/shop"
                    className="block w-full text-center text-gray-500 hover:text-brand-primary font-bold py-2 transition-colors whitespace-nowrap"
                  >
                    Continue browsing
                  </Link>

                  <div className="mt-8 bg-gray-50 rounded-xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="liquid-glass-well rounded-md p-1.5 text-brand-primary">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Safe to pay</p>
                        <p className="text-xs text-gray-500 mt-0.5">Your payment is protected</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="liquid-glass-well rounded-md p-1.5 text-brand-primary">
                        <RefreshCcw className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Easy returns</p>
                        <p className="text-xs text-gray-500 mt-0.5">30-day return policy</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="liquid-glass-well rounded-md p-1.5 text-brand-primary">
                        <HeadphonesIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Real people to call</p>
                        <p className="text-xs text-gray-500 mt-0.5">Phone or WhatsApp</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: total + checkout pinned above the bottom nav */}
            <div className="fixed inset-x-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(11,31,58,0.06)] backdrop-blur lg:hidden bottom-[calc(3.4rem+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total</p>
                  <p className="text-lg font-extrabold leading-tight text-brand-primary">{formatStoreMoney(total)}</p>
                </div>
                <Link
                  href="/checkout"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-accent py-3.5 text-base font-bold text-white active:bg-brand-accent/90"
                >
                  <ShieldCheck className="h-5 w-5" /> Checkout
                </Link>
              </div>
            </div>
            <div className="h-24 md:h-16 lg:hidden" aria-hidden />
          </section>
        )}
      </div>
    </div>
  );
}
