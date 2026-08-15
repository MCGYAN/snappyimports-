'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  daysUntil,
  formatGhs,
  formatUsd,
  SHIPPING_CLASS_LABELS,
  SHIPPING_STATUS_LABELS,
  type ShippingGoodsClass,
  type ShippingPackageStatus,
  type ShippingRateBoard,
} from '@/lib/shipping';
import { ArrowLeft, Box, CalendarDays, CheckCircle2, Ship } from 'lucide-react';

function dateLabel(value?: string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ShippingDetailsClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderNumber = decodeURIComponent(String(params.orderNumber || ''));
  const emailFromUrl = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromUrl);
  const [packages, setPackages] = useState<any[]>([]);
  const [board, setBoard] = useState<ShippingRateBoard | null>(null);
  const [loading, setLoading] = useState(Boolean(emailFromUrl));
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (mail: string, quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/shipping/packages?order=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(
          mail.trim(),
        )}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load shipping details.');
      setPackages(data.packages || []);
      setBoard(data.board || null);
      setUnlocked(true);
    } catch (err) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : 'Could not load shipping details.');
        setUnlocked(false);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (orderNumber && emailFromUrl) void load(emailFromUrl);
  }, [emailFromUrl, load, orderNumber]);

  useEffect(() => {
    if (!unlocked || !email) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void load(email, true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [email, load, unlocked]);

  const rates = useMemo(
    () =>
      board
        ? [
            ['Normal goods', board.normal_usd_per_cbm],
            ['Sensitive goods', board.sensitive_usd_per_cbm],
            ['Heavy goods', board.heavy_usd_per_cbm],
            ['Bulk goods', board.bulk_usd_per_cbm],
          ]
        : [],
    [board],
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href={`/order/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to order
        </Link>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
            China to Ghana
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-brand-primary">
            Shipping details
          </h1>
          <p className="mt-1 text-sm text-slate-500">{orderNumber}</p>
        </div>

        {!unlocked ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load(email);
            }}
            className="store-card mx-auto mt-8 max-w-md space-y-3 p-6"
          >
            <p className="text-sm text-slate-600">
              Enter the email used at checkout to view this shipment.
            </p>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Checkout email"
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Opening…' : 'View shipment'}
            </button>
          </form>
        ) : (
          <div className="mt-7 space-y-6">
            {board ? (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="grid md:grid-cols-[12rem_1fr]">
                  <div className="bg-orange-50 p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                      USD to GHS
                    </p>
                    <p className="mt-2 text-3xl font-black text-brand-primary">
                      GH¢{Number(board.usd_to_ghs).toFixed(2)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Current estimate only</p>
                  </div>
                  <div className="p-5">
                    <p className="font-bold text-brand-primary">Shipping rates per CBM</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {rates.map(([label, rate]) => (
                        <div key={String(label)} className="rounded-xl border border-slate-100 p-3">
                          <p className="text-xl font-black text-slate-900">
                            ${Number(rate).toFixed(0)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{String(label)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {board.notes ? (
                  <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                    {board.notes}
                  </p>
                ) : null}
              </section>
            ) : null}

            {packages.length === 0 ? (
              <section className="store-card py-12 text-center">
                <Box className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">Package details are not ready yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  We will add CBM and travel dates after the warehouse measures your goods.
                </p>
              </section>
            ) : (
              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-brand-primary">Your packages</h2>
                    <p className="text-sm text-slate-500">
                      {packages.length} package{packages.length === 1 ? '' : 's'} linked to this order
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {packages.map((pkg) => {
                    const status = pkg.status as ShippingPackageStatus;
                    const arrived = ['arrived', 'clearing', 'ready', 'delivered'].includes(status);
                    const days = daysUntil(pkg.estimated_arrival_at, now);
                    return (
                      <article
                        key={pkg.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand-primary">
                              <Box className="h-5 w-5" />
                            </span>
                            <div>
                              <h3 className="font-bold text-slate-900">{pkg.package_name}</h3>
                              <p className="mt-0.5 font-mono text-xs text-slate-400">
                                {pkg.tracking_id}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              arrived
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {SHIPPING_STATUS_LABELS[status]}
                          </span>
                        </div>

                        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs text-slate-500">Package size</p>
                            <p className="mt-1 text-xl font-black text-brand-primary">
                              {Number(pkg.cbm).toFixed(3)} CBM
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {SHIPPING_CLASS_LABELS[pkg.goods_class as ShippingGoodsClass]}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Shipping calculation</p>
                            {pkg.freight_included ? (
                              <p className="mt-1 font-bold text-emerald-700">Freight included</p>
                            ) : (
                              <>
                                <p className="mt-1 font-bold text-slate-900">
                                  {Number(pkg.cbm).toFixed(3)} × {formatUsd(pkg.usd_per_cbm)}
                                </p>
                                <p className="text-sm font-black text-brand-primary">
                                  {formatUsd(pkg.estimated_shipping_usd)}
                                </p>
                              </>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">
                              {pkg.final_shipping_ghs != null ? 'Final cedis' : 'Cedi estimate'}
                            </p>
                            <p className="mt-1 text-xl font-black text-brand-primary">
                              {pkg.freight_included
                                ? 'Included'
                                : pkg.final_shipping_ghs != null
                                  ? formatGhs(pkg.final_shipping_ghs)
                                  : pkg.estimated_shipping_ghs != null
                                    ? formatGhs(pkg.estimated_shipping_ghs)
                                    : 'Pending rate'}
                            </p>
                            {!pkg.freight_included && pkg.final_shipping_ghs == null ? (
                              <p className="mt-1 text-xs text-slate-400">
                                Final amount uses the arrival-day dollar rate.
                              </p>
                            ) : null}
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Estimated arrival</p>
                            {arrived ? (
                              <div className="mt-1 flex items-center gap-2 font-bold text-emerald-700">
                                <CheckCircle2 className="h-5 w-5" /> Arrived in Ghana
                              </div>
                            ) : pkg.estimated_arrival_at ? (
                              <>
                                <p className="mt-1 text-xl font-black text-brand-primary">
                                  {days} day{days === 1 ? '' : 's'} left
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  Around {dateLabel(pkg.estimated_arrival_at)}
                                </p>
                              </>
                            ) : (
                              <p className="mt-1 font-semibold text-slate-500">Waiting to be loaded</p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-sm sm:grid-cols-3">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-slate-400" />
                            <span>
                              <span className="block text-xs text-slate-400">Warehouse received</span>
                              {dateLabel(pkg.warehouse_received_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-slate-400" />
                            <span>
                              <span className="block text-xs text-slate-400">Loaded / shipped</span>
                              {dateLabel(pkg.loaded_at)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-xs text-slate-400">Vessel / note</span>
                            {pkg.vessel || 'Not provided'}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <p className="text-center text-xs text-slate-500">
              Arrival dates are estimates and can change with vessel schedules and customs.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
