'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  daysUntil,
  formatGhs,
  formatUsd,
  SHIPPING_STATUS_LABELS,
  type ShippingPackageStatus,
} from '@/lib/shipping';

export default function MyShipments() {
  const [data, setData] = useState<any>({ packages: [], board: null });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return setLoading(false);
      await fetch('/api/orders/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      }).catch(() => null);
      const response = await fetch('/api/account/portal', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok) setData(result);
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const totals = useMemo(() => {
    const packages = data.packages || [];
    return {
      all: packages.length,
      moving: packages.filter((pkg: any) => ['loaded', 'in_transit'].includes(pkg.status)).length,
      arrived: packages.filter((pkg: any) =>
        ['arrived', 'clearing', 'ready'].includes(pkg.status),
      ).length,
      delivered: packages.filter((pkg: any) => pkg.status === 'delivered').length,
    };
  }, [data.packages]);

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Loading shipments…</p>;

  const board = data.board;
  const packages = data.packages || [];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">My shipments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Package sizes, shipping estimates and Ghana arrival progress.
        </p>
      </div>

      {board ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid sm:grid-cols-[10rem_1fr]">
            <div className="bg-orange-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
                USD to GHS estimate
              </p>
              <p className="mt-1 text-2xl font-black text-brand-primary">
                GH¢{Number(board.usd_to_ghs).toFixed(2)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
              {[
                ['Normal', board.normal_usd_per_cbm],
                ['Sensitive', board.sensitive_usd_per_cbm],
                ['Heavy', board.heavy_usd_per_cbm],
                ['Bulk', board.bulk_usd_per_cbm],
              ].map(([label, rate]) => (
                <div key={String(label)} className="bg-white p-4">
                  <p className="font-black text-slate-900">${Number(rate).toFixed(0)}</p>
                  <p className="text-xs text-slate-500">{String(label)} / CBM</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total packages', totals.all],
          ['In transit', totals.moving],
          ['In Ghana', totals.arrived],
          ['Delivered', totals.delivered],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 p-3">
            <p className="text-xl font-black text-brand-primary">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <i className="ri-ship-2-line text-3xl text-slate-300" />
          <p className="mt-2 font-semibold text-slate-700">No measured packages yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Packages appear here after our China warehouse records the CBM.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="hidden grid-cols-[1.5fr_.7fr_.9fr_.9fr_.6fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 md:grid">
            <span>Package</span>
            <span>CBM</span>
            <span>Shipping</span>
            <span>Arrival</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-slate-100">
            {packages.map((pkg: any) => {
              const days = daysUntil(pkg.estimated_arrival_at, now);
              const email = pkg.orders?.email || '';
              const orderNumber = pkg.orders?.order_number || '';
              return (
                <Link
                  key={pkg.id}
                  href={`/order/${encodeURIComponent(orderNumber)}/shipping?email=${encodeURIComponent(email)}`}
                  className="grid gap-3 p-4 transition hover:bg-slate-50 md:grid-cols-[1.5fr_.7fr_.9fr_.9fr_.6fr] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{pkg.package_name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{pkg.tracking_id}</p>
                  </div>
                  <div>
                    <span className="mr-2 text-xs text-slate-400 md:hidden">Size</span>
                    <strong>{Number(pkg.cbm).toFixed(3)}</strong>
                  </div>
                  <div>
                    <span className="mr-2 text-xs text-slate-400 md:hidden">Shipping</span>
                    <strong className="text-brand-primary">
                      {pkg.freight_included
                        ? 'Included'
                        : pkg.final_shipping_ghs != null
                          ? formatGhs(pkg.final_shipping_ghs)
                          : formatUsd(pkg.estimated_shipping_usd)}
                    </strong>
                  </div>
                  <div>
                    <span className="mr-2 text-xs text-slate-400 md:hidden">Arrival</span>
                    {['arrived', 'clearing', 'ready', 'delivered'].includes(pkg.status)
                      ? 'In Ghana'
                      : days == null
                        ? 'Not loaded'
                        : `${days} day${days === 1 ? '' : 's'} left`}
                  </div>
                  <div>
                    <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800">
                      {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus]}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
