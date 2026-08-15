'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  formatGhs,
  formatUsd,
  SHIPPING_STATUS_LABELS,
  type ShippingPackageStatus,
} from '@/lib/shipping';

function packageContents(pkg: any) {
  return (pkg.shipping_package_items || [])
    .map(
      (entry: any) =>
        `${entry.order_items?.product_name || 'Item'} × ${entry.quantity}${
          entry.order_items?.orders?.order_number
            ? ` (${entry.order_items.orders.order_number})`
            : ''
        }`,
    )
    .join(', ');
}

export default function OrderShippingDesk({ order }: { order: any }) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `/api/shipping/packages?orderId=${encodeURIComponent(order.id)}`,
        {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        },
      );
      const data = await response.json();
      if (response.ok) setPackages(data.packages || []);
      setLoading(false);
    };
    void load();
  }, [order.id]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-brand-primary">Shipping packages</h2>
          <p className="mt-1 text-xs text-slate-500">
            Read-only summary. Build boxes in Packages and manage travel in Shipping.
          </p>
        </div>
        <Link
          href="/admin/packages"
          className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white"
        >
          Open Packages
        </Link>
      </div>

      <div className="space-y-3 p-4">
        {loading ? <p className="text-sm text-slate-500">Loading packages…</p> : null}
        {!loading && packages.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-slate-700">Nothing packed yet</p>
            <p className="mt-1 text-xs text-slate-500">
              This paid order appears in Packages under Needs packing.
            </p>
          </div>
        ) : null}

        {packages.map((pkg) => (
          <div key={pkg.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{pkg.package_name}</p>
                <p className="font-mono text-[10px] text-slate-400">{pkg.tracking_id}</p>
              </div>
              <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-800">
                {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus]}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Inside: {packageContents(pkg) || 'No contents recorded'}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>{Number(pkg.cbm).toFixed(3)} CBM</span>
              <span>
                {pkg.freight_included
                  ? 'Freight included'
                  : pkg.final_shipping_ghs != null
                    ? `Final ${formatGhs(pkg.final_shipping_ghs)}`
                    : `Estimate ${formatUsd(pkg.estimated_shipping_usd)}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
