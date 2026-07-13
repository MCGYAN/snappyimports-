'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutSteps from '@/components/CheckoutSteps';
import OrderSummary from '@/components/OrderSummary';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { executeRecaptcha } from '@/lib/recaptcha';
import { ShoppingCart, ArrowLeft, UserCircle } from 'lucide-react';
import {
  INVOICE_PAYMENT_THRESHOLD,
  resolveCheckoutPaymentChannel,
} from '@/lib/payment-routing';

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const router = useRouter();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [shippingData, setShippingData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    region: ''
  });

  // The 16 regions of Ghana
  const regionOptions = [
    'Greater Accra',
    'Ashanti',
    'Western',
    'Western North',
    'Central',
    'Eastern',
    'Volta',
    'Oti',
    'Northern',
    'Savannah',
    'North East',
    'Upper East',
    'Upper West',
    'Bono',
    'Bono East',
    'Ahafo'
  ];

  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'moolre' | 'invoice'>('moolre');
  const [errors, setErrors] = useState<any>({});

  // Check auth and cart
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setShippingData(prev => ({ ...prev, email: session.user.email || '' }));
      }
    }
    checkUser();

    const timer = setTimeout(() => {
      if (cart.length === 0 && !isLoading) {
        // optional empty cart redirect
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, router, isLoading]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const subtotal = cartSubtotal;
  const shippingCost = 0;
  const tax = 0;
  const total = subtotal + shippingCost + tax;

  useEffect(() => {
    setPaymentMethod(resolveCheckoutPaymentChannel(total));
  }, [total]);

  const validateShipping = () => {
    const newErrors: any = {};
    if (!shippingData.firstName) newErrors.firstName = 'First name is required';
    if (!shippingData.lastName) newErrors.lastName = 'Last name is required';
    if (!shippingData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(shippingData.email)) newErrors.email = 'Invalid email';
    if (!shippingData.phone) newErrors.phone = 'Phone is required';
    if (!shippingData.address) newErrors.address = 'Address is required';
    if (!shippingData.city) newErrors.city = 'City is required';
    if (!shippingData.region) newErrors.region = 'Region is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinueToDelivery = () => {
    if (validateShipping()) {
      setCurrentStep(2);
    }
  };

  const handleContinueToPayment = async () => {
    await handlePlaceOrder();
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setIsLoading(true);
    const channel = resolveCheckoutPaymentChannel(total);

    let recaptchaToken = '';
    const hasRecaptcha = typeof process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY === 'string' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length > 0;
    if (hasRecaptcha) {
      const token = await executeRecaptcha('checkout');
      recaptchaToken = token || '';
    }

    try {
      const placeRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recaptchaToken: recaptchaToken || '',
          shippingData,
          deliveryMethod,
          paymentMethod: channel,
          cart: cart.map((item: { id: string; name: string; variant?: string; variantId?: string; quantity: number; price: number; image?: string; slug?: string }) => ({
            id: item.id,
            name: item.name,
            variant: item.variant,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
            slug: item.slug
          })),
          userId: user?.id ?? null
        })
      });

      const placeData = await placeRes.json();
      if (!placeRes.ok) {
        throw new Error(placeData.error || 'Failed to place order');
      }
      if (!placeData.success || !placeData.order || !placeData.orderNumber) {
        throw new Error('Invalid response from server');
      }

      const orderNumber = placeData.orderNumber as string;
      const paymentChannel = (placeData.paymentChannel || channel) as 'moolre' | 'invoice';

      if (paymentChannel === 'invoice') {
        clearCart();
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'order_created', payload: placeData.order }),
        }).catch(() => {});
        router.push(
          `/order/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(shippingData.email)}`,
        );
        return;
      }

      try {
        const paymentRes = await fetch('/api/payment/moolre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderNumber,
            amount: total,
            customerEmail: shippingData.email
          })
        });

        const paymentResult = await paymentRes.json();

        if (!paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment initialization failed');
        }

        clearCart();
        window.location.href = paymentResult.url;
        return;
      } catch (paymentErr: any) {
        console.error('Payment Error:', paymentErr);
        alert('Failed to initialize payment: ' + paymentErr.message);
        setIsLoading(false);
        return;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert('Failed to place order: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (cart.length === 0 && !isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 py-20">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <ShoppingCart className="w-10 h-10 text-gray-300" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">Add some items to start the checkout process.</p>
          <Link href="/shop" className="inline-block bg-brand-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#0d2747] transition-colors">
            Return to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/cart" className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center whitespace-nowrap">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Cart
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        {user && (
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-light px-4 py-2 text-sm font-medium text-brand-primary">
            <UserCircle className="h-4 w-4" />
            Checking out as {user.email}
          </p>
        )}

        <CheckoutSteps currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2">
            {currentStep === 1 && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Shipping Information</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          autoComplete="given-name"
                          value={shippingData.firstName}
                          onChange={(e) => setShippingData({ ...shippingData, firstName: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent ${errors.firstName ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="John"
                        />
                        {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          autoComplete="family-name"
                          value={shippingData.lastName}
                          onChange={(e) => setShippingData({ ...shippingData, lastName: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent ${errors.lastName ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="Doe"
                        />
                        {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={shippingData.email}
                        readOnly={!!user} // Make read-only if logged in (optional, but safer)
                        onChange={(e) => setShippingData({ ...shippingData, email: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent ${errors.email ? 'border-red-500' : 'border-gray-300'
                          } ${user ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        placeholder="you@example.com"
                      />
                      {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={shippingData.phone}
                        onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent ${errors.phone ? 'border-red-500' : 'border-gray-300'
                          }`}
                        placeholder="024 123 4567"
                      />
                      {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        autoComplete="street-address"
                        value={shippingData.address}
                        onChange={(e) => setShippingData({ ...shippingData, address: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent ${errors.address ? 'border-red-500' : 'border-gray-300'
                          }`}
                        placeholder="House number and street name"
                      />
                      {errors.address && <p className="text-sm text-red-600 mt-1">{errors.address}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          autoComplete="address-level2"
                          value={shippingData.city}
                          onChange={(e) => setShippingData({ ...shippingData, city: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent ${errors.city ? 'border-red-500' : 'border-gray-300'
                            }`}
                          placeholder="City"
                        />
                        {errors.city && <p className="text-sm text-red-600 mt-1">{errors.city}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Region *
                        </label>
                        <select
                          value={shippingData.region}
                          onChange={(e) => setShippingData({ ...shippingData, region: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent bg-white ${errors.region ? 'border-red-500' : 'border-gray-300'
                            }`}
                        >
                          <option value="">Select Region</option>
                          {regionOptions.map((region) => (
                            <option key={region} value={region}>{region}</option>
                          ))}
                        </select>
                        {errors.region && <p className="text-sm text-red-600 mt-1">{errors.region}</p>}
                      </div>
                    </div>

                    {user && (
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveAddress}
                          onChange={(e) => setSaveAddress(e.target.checked)}
                          className="w-5 h-5 text-brand-primary rounded border-gray-300 focus:ring-brand-accent"
                        />
                        <span className="text-sm text-gray-700">Save this address for future orders</span>
                      </label>
                    )}
                  </div>

                  <button
                    onClick={handleContinueToDelivery}
                    className="w-full mt-6 bg-brand-primary hover:bg-[#0d2747] text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Continue to Delivery
                  </button>
                </div>


              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Delivery Method</h2>
                  <div className="space-y-4">
                    <div className="rounded-xl border border-brand-accent/25 bg-brand-accent/10 px-4 py-3 text-sm text-brand-primary">
                      {paymentMethod === 'invoice' ? (
                        <>
                          Cart total is GH¢{total.toFixed(2)} (at or above GH¢{INVOICE_PAYMENT_THRESHOLD.toFixed(0)}).
                          You will get a downloadable invoice with bank details. Pay by transfer, then tap “I’ve paid”.
                        </>
                      ) : (
                        <>
                          Cart total is under GH¢{INVOICE_PAYMENT_THRESHOLD.toFixed(0)}. Fast checkout with Mobile Money.
                        </>
                      )}
                    </div>
                    <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'pickup' ? 'border-brand-primary bg-brand-light' : 'border-gray-300 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center space-x-4">
                        <input
                          type="radio"
                          name="delivery"
                          value="pickup"
                          checked={deliveryMethod === 'pickup'}
                          onChange={(e) => setDeliveryMethod(e.target.value)}
                          className="w-5 h-5 text-brand-primary"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">Store Pickup</p>
                          <p className="text-sm text-gray-600">Pick up from our store. Ready in 24 hours.</p>
                        </div>
                      </div>
                      <p className="font-bold text-brand-primary">FREE</p>
                    </label>

                    <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'doorstep' ? 'border-brand-primary bg-brand-light' : 'border-gray-300 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center space-x-4">
                        <input
                          type="radio"
                          name="delivery"
                          value="doorstep"
                          checked={deliveryMethod === 'doorstep'}
                          onChange={(e) => setDeliveryMethod(e.target.value)}
                          className="w-5 h-5 text-brand-primary"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">Doorstep Delivery</p>
                          <p className="text-sm text-gray-600">We will contact you with the delivery cost</p>
                        </div>
                      </div>
                      <p className="font-semibold text-amber-600 text-sm">At a Cost</p>
                    </label>

                    {/* Comprehensive delivery options - to be re-enabled later
                    <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'accra' ? 'border-brand-primary bg-brand-light' : 'border-gray-300 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center space-x-4">
                        <input type="radio" name="delivery" value="accra" checked={deliveryMethod === 'accra'} onChange={(e) => setDeliveryMethod(e.target.value)} className="w-5 h-5 text-brand-primary" />
                        <div>
                          <p className="font-semibold text-gray-900">Metro delivery</p>
                          <p className="text-sm text-gray-600">Delivery within metro area</p>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900">GH¢40.00</p>
                    </label>
                    <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${deliveryMethod === 'outside-accra' ? 'border-brand-primary bg-brand-light' : 'border-gray-300 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center space-x-4">
                        <input type="radio" name="delivery" value="outside-accra" checked={deliveryMethod === 'outside-accra'} onChange={(e) => setDeliveryMethod(e.target.value)} className="w-5 h-5 text-brand-primary" />
                        <div>
                          <p className="font-semibold text-gray-900">Regional delivery</p>
                          <p className="text-sm text-gray-600">Delivery outside metro (rates vary)</p>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900">GH¢30.00</p>
                    </label>
                    */}
                  </div>

                  <div className="flex flex-col-reverse md:flex-row gap-4 mt-6">
                    <button
                      onClick={() => setCurrentStep(1)}
                      disabled={isLoading}
                      className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinueToPayment}
                      disabled={isLoading}
                      className="flex-1 bg-brand-primary hover:bg-[#0d2747] text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-70 flex items-center justify-center"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : paymentMethod === 'invoice' ? (
                        `Get invoice for GH¢${total.toFixed(2)}`
                      ) : (
                        `Pay GH¢${total.toFixed(2)} with Mobile Money`
                      )}
                    </button>
                  </div>
                </div>


              </>
            )}

            {/* Step 3 removed - payment now initiates directly from step 2 */}
          </div>

          <div className="lg:col-span-1">
            <OrderSummary
              items={cart}
              subtotal={subtotal}
              shipping={shippingCost}
              tax={tax}
              total={total}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
