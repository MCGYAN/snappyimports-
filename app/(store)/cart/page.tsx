'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import CartCountdown from '@/components/CartCountdown';
import AdvancedCouponSystem from '@/components/AdvancedCouponSystem';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ShoppingCart, Trash2, Minus, Plus, ShieldCheck, RefreshCcw, HeadphonesIcon, X } from 'lucide-react';

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

  const shipping = subtotal >= 500 ? 0 : 50;
  const total = subtotal - couponDiscount + shipping;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Brand Header replacement for PageHero */}
      <div className="bg-[#001733] py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Your Basket</h1>
          <p className="text-blue-200 text-lg font-medium">Review your items before proceeding to secure checkout</p>
        </div>
      </div>

      <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-grow">
        <CartCountdown />

        {cartItems.length === 0 ? (
          <section className="py-20">
            <div className="max-w-md mx-auto px-4 sm:px-6 text-center bg-white p-12 rounded-3xl shadow-sm border border-gray-100">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-blue-50 rounded-full text-[#002B5E]">
                <ShoppingCart className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-[#002B5E] mb-4">Your basket is empty</h2>
              <p className="text-gray-600 mb-8 font-medium">Looks like you haven't added any security products to your basket yet.</p>
              <Link href="/shop" className="inline-block bg-[#002B5E] hover:bg-[#001733] text-white px-8 py-4 rounded-lg font-bold transition-all shadow-lg shadow-[#002B5E]/20 whitespace-nowrap">
                Continue Shopping
              </Link>
            </div>
          </section>
        ) : (
          <section className="py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                    <h2 className="text-2xl font-bold text-[#002B5E]">Basket Items ({cartItems.length})</h2>
                    {savings > 0 && (
                      <span className="text-amber-600 font-bold bg-amber-50 px-3 py-1 rounded-full text-sm">
                        You save GH₵{savings.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-8">
                    {cartItems.map((item) => (
                      <div key={`${item.id}-${item.variant || ''}`} className="flex flex-col sm:flex-row gap-6 pb-8 border-b border-gray-100 last:border-0 last:pb-0 relative group">

                        <Link href={`/product/${item.slug || item.id}`} className="relative w-full sm:w-32 h-40 sm:h-32 flex-shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 p-2">
                          <Image src={item.image} alt={item.name} fill className="object-contain mix-blend-multiply drop-shadow-sm group-hover:scale-110 transition-transform duration-500" sizes="(max-width: 640px) 100vw, 128px" quality={80} />
                        </Link>

                        <div className="flex-1 flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2 pr-8">
                            <Link href={`/product/${item.slug || item.id}`} className="text-lg font-bold text-[#002B5E] hover:text-amber-500 transition-colors line-clamp-2 leading-snug">
                              {item.name}
                            </Link>
                          </div>

                          <div className="text-sm text-gray-500 mb-4 space-y-1 font-medium">
                            {item.variant && <p className="bg-gray-100 inline-block px-2 py-0.5 rounded text-gray-700">Variant: {item.variant}</p>}
                            <p className="text-green-600 flex items-center gap-1">
                              <ShieldCheck className="w-4 h-4" /> In Stock
                            </p>
                          </div>

                          <div className="flex items-center justify-between flex-wrap gap-4 mt-auto">
                            <span className="text-xl font-extrabold text-[#002B5E]">GH₵{item.price.toFixed(2)}</span>

                            <div className="flex items-center space-x-4">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden h-10 shadow-sm bg-gray-50">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#002B5E] transition-all"
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
                                  className="w-12 h-full text-center border-x border-gray-200 focus:outline-none font-bold text-[#002B5E] bg-white appearance-none"
                                  min={item.moq || 1}
                                  max={item.maxStock}
                                />
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#002B5E] transition-all"
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
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 sticky top-24">
                  <h3 className="text-xl font-bold text-[#002B5E] mb-6 pb-4 border-b border-gray-100">Order Summary</h3>

                  <div className="space-y-4 mb-6 text-[15px] font-medium text-gray-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-bold text-gray-900">GH₵{subtotal.toFixed(2)}</span>
                    </div>

                    {appliedCoupon && (
                      <div className="flex justify-between text-amber-600">
                        <span>Coupon ({appliedCoupon.code})</span>
                        <span className="font-bold">-GH₵{couponDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span className="font-bold text-gray-900">{shipping === 0 ? 'FREE' : `GH₵${shipping.toFixed(2)}`}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6 mb-8">
                    <div className="flex justify-between items-center text-2xl font-black text-[#002B5E]">
                      <span>Total</span>
                      <span>GH₵{total.toFixed(2)}</span>
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
                    className="flex justify-center items-center gap-2 w-full bg-amber-500 hover:bg-amber-400 text-[#002B5E] py-4 rounded-xl font-bold text-lg shadow-lg shadow-amber-500/20 transition-all mt-6 mb-4 whitespace-nowrap hover:-translate-y-0.5"
                  >
                    <ShieldCheck className="w-5 h-5" /> Secure Checkout
                  </Link>

                  <Link
                    href="/shop"
                    className="block w-full text-center text-gray-500 hover:text-[#002B5E] font-bold py-2 transition-colors whitespace-nowrap"
                  >
                    Continue Shopping
                  </Link>

                  <div className="mt-8 bg-gray-50 rounded-xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-1.5 rounded-md shadow-sm text-[#002B5E]">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Secure Payment</p>
                        <p className="text-xs text-gray-500 mt-0.5">256-bit encrypted checkout</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-1.5 rounded-md shadow-sm text-[#002B5E]">
                        <RefreshCcw className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Easy Returns</p>
                        <p className="text-xs text-gray-500 mt-0.5">30-day return policy</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-1.5 rounded-md shadow-sm text-[#002B5E]">
                        <HeadphonesIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Expert Support</p>
                        <p className="text-xs text-gray-500 mt-0.5">Available by phone or chat</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
