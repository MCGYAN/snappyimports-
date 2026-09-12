'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ShippingOperationsDesk from '@/components/admin/ShippingOperationsDesk';
import WarehouseFreightDesk from '@/components/admin/WarehouseFreightDesk';
import { supabase } from '@/lib/supabase';
import {
  hasAdminModule,
  normalizeAdminPermissions,
  type AdminPermissions,
} from '@/lib/admin-permissions';

type PackagesTab = 'shop' | 'freight';

export default function AdminPackagesClient() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<AdminPermissions>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setReady(true);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, admin_permissions')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setRole(profile?.role || null);
      setPermissions(normalizeAdminPermissions(profile?.admin_permissions));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canShop = hasAdminModule(role, permissions, 'orders');
  const canFreight = hasAdminModule(role, permissions, 'warehouse');

  const requested = searchParams.get('tab') === 'freight' ? 'freight' : 'shop';
  const activeTab: PackagesTab = useMemo(() => {
    if (requested === 'freight' && canFreight) return 'freight';
    if (requested === 'shop' && canShop) return 'shop';
    if (canShop) return 'shop';
    if (canFreight) return 'freight';
    return 'shop';
  }, [requested, canShop, canFreight]);

  if (!ready) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading packages…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Packages</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Shop packing for website orders, and freight intake for China warehouse shipping marks.
            Both continue in Shipping.
          </p>
        </div>
        <Link
          href="/admin/shipping"
          className="rounded-xl border border-brand-primary/20 bg-white px-4 py-2.5 text-sm font-bold text-brand-primary"
        >
          Open Shipping
        </Link>
      </div>

      {canShop || canFreight ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {canShop ? (
            <Link
              href="/admin/packages?tab=shop"
              className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                activeTab === 'shop'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Shop packing
            </Link>
          ) : null}
          {canFreight ? (
            <Link
              href="/admin/packages?tab=freight"
              className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                activeTab === 'freight'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Freight intake
            </Link>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'shop' && canShop ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {[
              ['1', 'Choose a customer', 'See unpacked items from all their paid orders.'],
              ['2', 'Build the box', 'Split quantities and combine the items that physically fit.'],
              ['3', 'Measure and save', 'Enter dimensions or CBM. Snappy creates the SHP number.'],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-2xl border border-slate-200 bg-white p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                  {number}
                </span>
                <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </section>
          <ShippingOperationsDesk mode="packages" />
        </>
      ) : null}

      {activeTab === 'freight' && canFreight ? <WarehouseFreightDesk /> : null}

      {!canShop && !canFreight ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your staff account needs Orders or China Warehouse access to use Packages.
        </p>
      ) : null}
    </div>
  );
}
