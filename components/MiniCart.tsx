'use client';

import Link from 'next/link';
import { useEffect } from 'react';
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

  // Lock body scroll when cart is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      ></div>

      <div className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-md flex-col border-l border-white/40 liquid-glass shadow-2xl slide-in-right">
        <div className="flex items-center justify-between border-b border-white/40 p-6 liquid-glass-well">
          <h2 className="text-xl font-extrabold text-brand-foreground tracking-tight">
            Your basket <span className="text-brand-accent ml-1">({cart.reduce((sum, i) => sum + i.quantity, 0)})</span>
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-full transition-all cursor-pointer shadow-sm border border-transparent hover:border-gray-200 hover:scale-105"
          >
            <X className="w-6 h-6 text-gray-500 hover:text-brand-accent transition-colors" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 flex items-center justify-center bg-gray-50 rounded-full mb-6 shadow-inner border border-gray-100">
              <ShoppingCart className="w-12 h-12 text-gray-300" />
            </div>
            <h3 className="text-2xl font-bold text-brand-foreground mb-2 tracking-tight">Your basket is empty</h3>
            <p className="text-gray-500 mb-8 font-medium">Looks like you haven't added anything yet.</p>
            <Link
              href="/shop"
              onClick={onClose}
              className="btn-primary cursor-pointer whitespace-nowrap rounded-full bg-brand-primary px-8 py-3.5 font-bold text-white hover:bg-brand-accent"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={`${item.id}-${item.variant}`} className="group flex space-x-4 rounded-2xl liquid-glass-card p-4 transition-all">
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-white">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-contain object-center p-1.5"
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-bold text-brand-foreground mb-1 line-clamp-2 leading-snug">{item.name}</h3>
                      {item.variant && (
                        <p className="text-xs text-brand-primary mb-2 font-semibold bg-brand-light inline-block px-2 py-1 rounded-md w-fit">
                          {cleanVariantDisplayLabel(item.variant)}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-2">
                        <span className="text-lg font-black text-brand-primary tracking-tight">
                          {formatStoreMoney(item.price)}
                        </span>

                        <div className="flex items-center border border-gray-200 rounded-full bg-gray-50 overflow-hidden shadow-sm">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white hover:text-brand-accent transition-colors cursor-pointer"
                          >
                            {item.quantity <= (item.moq || 1) ? (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            ) : (
                              <Minus className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                          <span className="w-8 text-center font-bold text-brand-foreground text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white hover:text-brand-accent transition-colors cursor-pointer"
                            disabled={item.quantity >= item.maxStock}
                          >
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                      {item.quantity >= item.maxStock && (
                        <p className="text-[10px] text-brand-accent font-bold mt-1.5 uppercase tracking-wider">Max stock reached</p>
                      )}
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id, item.variant)}
                      aria-label="Remove item"
                      className="w-9 h-9 flex items-center justify-center hover:bg-red-50 active:bg-red-50 rounded-full transition-colors flex-shrink-0 cursor-pointer self-start opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <X className="w-5 h-5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/40 p-6 liquid-glass-well backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Subtotal</span>
                <span className="text-2xl font-black text-brand-foreground tracking-tight">{formatStoreMoney(subtotal)}</span>
              </div>

              <p className="text-xs text-gray-400 mb-6 font-medium">
                Free pickup. Doorstep delivery quoted after your order.
              </p>

              <div className="space-y-3">
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="btn-primary block w-full cursor-pointer whitespace-nowrap rounded-full bg-brand-primary py-4 text-center text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-accent"
                >
                  Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="btn-secondary block w-full cursor-pointer whitespace-nowrap rounded-full bg-gray-50 py-4 text-center text-sm font-bold uppercase tracking-wide text-brand-foreground hover:bg-gray-100 hover:text-brand-accent"
                >
                  View basket
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
