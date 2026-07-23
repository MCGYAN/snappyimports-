'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '@/context/CartContext';
import { formatStoreMoney } from '@/lib/currency';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';
import { X, ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';

interface MiniCartProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MiniCart({ isOpen, onClose }: MiniCartProps) {
  const { cart, removeFromCart, updateQuantity, subtotal } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Your basket">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close basket"
        onClick={onClose}
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl sm:border-l sm:border-gray-200">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-brand-primary">
            Your basket
            <span className="ml-1.5 text-brand-accent">({itemCount})</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50">
              <ShoppingCart className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-brand-primary">Your basket is empty</h3>
            <p className="mb-6 text-sm text-gray-500">Add something you like, then checkout here.</p>
            <Link
              href="/shop"
              onClick={onClose}
              className="rounded-xl bg-brand-primary px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-accent"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              <ul className="space-y-3">
                {cart.map((item) => (
                  <li
                    key={`${item.id}-${item.variant || 'default'}`}
                    className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-contain object-center p-1"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-brand-primary">
                            {item.name}
                          </h3>
                          {item.variant ? (
                            <p className="mt-1 text-xs font-medium text-gray-500">
                              {cleanVariantDisplayLabel(item.variant)}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id, item.variant)}
                          aria-label="Remove item"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-base font-bold text-brand-primary">
                          {formatStoreMoney(item.price)}
                        </span>
                        <div className="flex items-center overflow-hidden rounded-full border border-gray-200 bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1, item.variant)
                            }
                            className="flex h-8 w-8 items-center justify-center text-gray-600 transition-colors hover:bg-gray-50"
                            aria-label={
                              item.quantity <= (item.moq || 1) ? 'Remove item' : 'Decrease quantity'
                            }
                          >
                            {item.quantity <= (item.moq || 1) ? (
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            ) : (
                              <Minus className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-brand-primary">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1, item.variant)
                            }
                            disabled={item.quantity >= item.maxStock}
                            className="flex h-8 w-8 items-center justify-center text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {item.quantity >= item.maxStock ? (
                        <p className="mt-1 text-[11px] font-semibold text-brand-accent">
                          Max stock reached
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Subtotal
                </span>
                <span className="text-2xl font-extrabold text-brand-primary">
                  {formatStoreMoney(subtotal)}
                </span>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-gray-500">
                Free pickup. Doorstep delivery quoted after your order.
              </p>
              <div className="space-y-2.5">
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="block w-full rounded-xl bg-brand-primary py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-brand-accent"
                >
                  Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="block w-full rounded-xl border border-gray-200 bg-white py-3.5 text-center text-sm font-bold text-brand-primary transition-colors hover:border-brand-primary/30 hover:bg-gray-50"
                >
                  View basket
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
}
