'use client';

import { useState } from 'react';

import { AlertCircle, ChevronDown, ChevronUp, Tag, X } from 'lucide-react';

interface Coupon {
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
  minPurchase?: number;
  maxDiscount?: number;
  description: string;
}

interface AdvancedCouponSystemProps {
  subtotal: number;
  onApply: (coupon: Coupon) => void;
  onRemove: () => void;
  appliedCoupon: Coupon | null;
}

export default function AdvancedCouponSystem({ 
  subtotal, 
  onApply, 
  onRemove,
  appliedCoupon 
}: AdvancedCouponSystemProps) {
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [showAvailable, setShowAvailable] = useState(false);

  const availableCoupons: Coupon[] = [
    { 
      code: 'WELCOME10', 
      discount: 10, 
      type: 'percentage',
      minPurchase: 100,
      description: '10% off on orders over $100'
    },
    { 
      code: 'SAVE20', 
      discount: 20, 
      type: 'percentage',
      minPurchase: 200,
      maxDiscount: 50,
      description: '20% off (max $50) on orders over $200'
    },
    { 
      code: 'FREE50', 
      discount: 50, 
      type: 'fixed',
      minPurchase: 500,
      description: '$50 off on orders over $500'
    },
    { 
      code: 'NEWCUSTOMER', 
      discount: 15, 
      type: 'percentage',
      maxDiscount: 30,
      description: '15% off (max $30) for new customers'
    }
  ];

  const handleApply = () => {
    setError('');
    const coupon = availableCoupons.find(c => c.code.toLowerCase() === couponCode.toLowerCase());
    
    if (!coupon) {
      setError('Invalid coupon code');
      return;
    }

    if (coupon.minPurchase && subtotal < coupon.minPurchase) {
      setError(`Minimum purchase of $${coupon.minPurchase} required`);
      return;
    }

    onApply(coupon);
    setCouponCode('');
    setShowAvailable(false);
  };

  const handleQuickApply = (coupon: Coupon) => {
    if (coupon.minPurchase && subtotal < coupon.minPurchase) {
      setError(`Add $${(coupon.minPurchase - subtotal).toFixed(2)} more to use this coupon`);
      return;
    }
    setError('');
    onApply(coupon);
    setShowAvailable(false);
  };

  return (
    <div className="space-y-4">
      {!appliedCoupon ? (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Have a coupon code?
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="Enter code"
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent text-sm"
              />
              <button
                onClick={handleApply}
                className="bg-brand-primary hover:bg-[#0d2747] text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Apply
              </button>
            </div>
            {error && (
              <p className="text-sm text-red-600 mt-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {error}
              </p>
            )}
          </div>

          <button
            onClick={() => setShowAvailable(!showAvailable)}
            className="text-sm text-brand-primary hover:text-brand-accent font-medium flex items-center whitespace-nowrap cursor-pointer"
          >
            {showAvailable ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {showAvailable ? 'Hide' : 'View'} available coupons
          </button>

          {showAvailable && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              {availableCoupons.map((coupon) => {
                const isEligible = !coupon.minPurchase || subtotal >= coupon.minPurchase;
                const needed = coupon.minPurchase ? coupon.minPurchase - subtotal : 0;

                return (
                  <div
                    key={coupon.code}
                    className={`bg-white rounded-lg p-4 border-2 transition-all ${
                      isEligible
                        ? 'border-brand-accent/30 hover:border-brand-accent/60'
                        : 'border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="bg-brand-light text-brand-primary px-3 py-1 rounded-lg font-bold text-sm">
                          {coupon.code}
                        </span>
                        {!isEligible && (
                          <span className="text-xs text-gray-500">
                            Add ${needed.toFixed(2)} more
                          </span>
                        )}
                      </div>
                      {isEligible && (
                        <button
                          onClick={() => handleQuickApply(coupon)}
                          className="text-brand-primary hover:text-brand-accent font-semibold text-sm whitespace-nowrap cursor-pointer"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{coupon.description}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="bg-brand-light border-2 border-brand-accent/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Tag className="w-4 h-4 text-brand-primary" />
                <span className="font-bold text-brand-primary">{appliedCoupon.code}</span>
              </div>
              <p className="text-sm text-brand-primary/80">{appliedCoupon.description}</p>
            </div>
            <button
              onClick={onRemove}
              className="w-8 h-8 flex items-center justify-center text-brand-primary hover:text-brand-accent transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
