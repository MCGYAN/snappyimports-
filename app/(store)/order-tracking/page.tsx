'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PackageSearch } from 'lucide-react';

function FindMyOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlOrder = searchParams.get('order') || '';
  const urlEmail = searchParams.get('email') || '';

  const [orderNumber, setOrderNumber] = useState(urlOrder);
  const [email, setEmail] = useState(urlEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openOrder = useCallback(
    async (orderNum: string, mail: string) => {
      const cleanedOrder = orderNum.trim();
      const cleanedEmail = mail.trim();
      if (!cleanedOrder) {
        setError('Enter your order number.');
        return;
      }
      if (!cleanedEmail) {
        setError('Enter the email you used at checkout.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const res = await fetch(
          `/api/orders/lookup?order=${encodeURIComponent(cleanedOrder)}&email=${encodeURIComponent(cleanedEmail)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Order not found. Check your order number and email.');
          return;
        }

        // Full hub: unpaid invoice + pay, or paid import journey
        router.push(
          `/order/${encodeURIComponent(cleanedOrder)}?email=${encodeURIComponent(cleanedEmail)}`,
        );
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (urlOrder && urlEmail) {
      openOrder(urlOrder, urlEmail);
    }
  }, [urlOrder, urlEmail, openOrder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    openOrder(orderNumber, email);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#eef2f7]">
      <div className="mx-auto max-w-lg px-4 py-12 sm:py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary text-white">
            <PackageSearch className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">
            No account needed
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-brand-primary sm:text-4xl">
            Find my order
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Enter your order number and checkout email. See payment status, re-download your
            invoice, or follow your China to Ghana import journey.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="store-card space-y-5 p-6 sm:p-8">
          <div>
            <label htmlFor="find-order-number" className="mb-2 block text-sm font-semibold text-brand-primary">
              Order number
            </label>
            <input
              id="find-order-number"
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              autoComplete="off"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base focus:border-brand-accent focus:outline-none"
              placeholder="e.g. ORD-1784…"
              required
            />
          </div>

          <div>
            <label htmlFor="find-order-email" className="mb-2 block text-sm font-semibold text-brand-primary">
              Email used at checkout
            </label>
            <input
              id="find-order-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base focus:border-brand-accent focus:outline-none"
              placeholder="you@example.com"
              required
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-accent disabled:opacity-60"
          >
            {loading ? 'Opening…' : 'Open my order'}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center text-sm text-slate-600">
          <p>
            Looking up a <span className="font-semibold text-brand-primary">Buy RMB</span> transfer?{' '}
            <Link href="/exchange/lookup" className="font-semibold text-brand-accent hover:underline">
              Find RMB invoice
            </Link>
          </p>
          <p className="text-xs text-slate-500">
            Order number is on your invoice, confirmation email, or checkout success screen.
          </p>
          <Link href="/" className="inline-block font-medium text-slate-500 hover:text-brand-primary">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-4xl text-brand-primary" />
        </div>
      }
    >
      <FindMyOrderContent />
    </Suspense>
  );
}
