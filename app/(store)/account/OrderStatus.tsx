'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatStoreMoney } from '@/lib/currency';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';
import {
  accountOrderStatusIndex,
  deriveAccountOrderStatus,
  visibleAccountOrderStatusSteps,
  type AccountOrderPackageSummary,
} from '@/lib/account-order-status';
import { SHIPPING_STATUS_LABELS, type ShippingPackageStatus } from '@/lib/shipping';

type OrderStatusOrder = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_status: string;
  total: number;
  currency?: string;
  created_at: string;
  metadata?: Record<string, any> | null;
  order_items?: Array<{
    id: string;
    product_name: string;
    variant_name?: string | null;
    quantity: number;
    unit_price: number;
  }>;
  packages?: AccountOrderPackageSummary[];
  openShippingInvoiceId?: string | null;
};

type OrderStatusProps = {
  orders: OrderStatusOrder[];
  loading: boolean;
  focusOrderNumber?: string | null;
};

export default function OrderStatus({ orders, loading, focusOrderNumber }: OrderStatusProps) {
  const ranked = useMemo(() => {
    const withStatus = orders.map((order) => {
      const packages = order.packages || [];
      const status = deriveAccountOrderStatus(
        order,
        packages,
        order.openShippingInvoiceId || null,
      );
      const needsShippingBill = packages.some(
        (pkg) => !pkg.freight_included && Boolean(pkg.final_usd_to_ghs || pkg.estimated_shipping_usd),
      );
      return { order, status, needsShippingBill };
    });

    withStatus.sort((a, b) => {
      const aDone = a.status.key === 'delivered' || a.status.key === 'cancelled' ? 1 : 0;
      const bDone = b.status.key === 'delivered' || b.status.key === 'cancelled' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime();
    });
    return withStatus;
  }, [orders]);

  const initialExpanded =
    focusOrderNumber ||
    ranked.find((row) => row.status.key !== 'delivered' && row.status.key !== 'cancelled')?.order
      .order_number ||
    ranked[0]?.order.order_number ||
    null;

  const [expanded, setExpanded] = useState<string | null>(initialExpanded);

  useEffect(() => {
    if (focusOrderNumber) setExpanded(focusOrderNumber);
  }, [focusOrderNumber]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading order status…</p>;
  }

  if (!ranked.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
        <i className="ri-map-pin-line text-3xl text-slate-300" />
        <p className="mt-2 font-semibold text-slate-700">No shop orders yet</p>
        <p className="mt-1 text-sm text-slate-500">
          When you place an import order, live progress will show here.
        </p>
        <Link
          href="/shop"
          className="mt-4 inline-flex rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white"
        >
          Go to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">Order status</h2>
        <p className="mt-1 text-sm text-slate-500">
          The live progress for each import, using the same names staff use on the dashboard.
          Package CBM and freight stay under My Shipments.
        </p>
      </div>

      <div className="space-y-4">
        {ranked.map(({ order, status, needsShippingBill }) => {
          const isOpen = expanded === order.order_number;
          const steps = visibleAccountOrderStatusSteps(
            status.key,
            status.packageCount > 0 || status.key === 'needs_packing',
            needsShippingBill,
          );
          const currentIndex = accountOrderStatusIndex(status.key);
          const email = order.email || '';
          const packages = order.packages || [];

          return (
            <section
              key={order.id}
              id={`order-status-${order.order_number}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) =>
                    current === order.order_number ? null : order.order_number,
                  )
                }
                className="flex w-full flex-wrap items-start justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {new Date(order.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="truncate font-bold text-slate-900">{order.order_number}</p>
                  <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                    {(order.order_items || [])
                      .map(
                        (item) =>
                          `${item.product_name}${
                            cleanVariantDisplayLabel(item.variant_name)
                              ? ` (${cleanVariantDisplayLabel(item.variant_name)})`
                              : ''
                          } × ${item.quantity}`,
                      )
                      .join(', ') || 'Shop order'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-primary">
                    {formatStoreMoney(order.total)}
                  </p>
                  <span className="mt-1 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800">
                    Now at {status.title}
                  </span>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    {isOpen ? 'Hide timeline' : 'Show timeline'}
                  </p>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-slate-100 px-5 py-5">
                  <div className="rounded-xl bg-brand-light/50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-brand-accent">
                      Now at
                    </p>
                    <p className="font-bold text-brand-primary">{status.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{status.description}</p>
                    {status.nextHint ? (
                      <p className="mt-2 text-sm font-semibold text-slate-800">{status.nextHint}</p>
                    ) : null}
                  </div>

                  <ol className="mt-5 space-y-3">
                    {steps.map((step) => {
                      const idx = accountOrderStatusIndex(step.key);
                      const done = currentIndex >= 0 && idx >= 0 && idx < currentIndex;
                      const active = step.key === status.key;
                      return (
                        <li key={step.key} className="flex gap-3">
                          <div
                            className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                              active
                                ? 'bg-brand-accent ring-4 ring-brand-accent/20'
                                : done
                                  ? 'bg-brand-primary'
                                  : 'bg-slate-200'
                            }`}
                          />
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                active ? 'text-brand-accent' : 'text-slate-800'
                              }`}
                            >
                              {step.title}
                            </p>
                            <p className="text-xs text-slate-500">{step.description}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  {packages.length > 0 ? (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Linked packages
                      </p>
                      <ul className="mt-2 space-y-2">
                        {packages.map((pkg) => (
                          <li
                            key={pkg.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span className="font-semibold text-slate-800">
                              {pkg.package_name}{' '}
                              <span className="font-mono text-[10px] text-slate-400">
                                {pkg.tracking_id}
                              </span>
                            </span>
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-orange-800">
                              {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus] ||
                                pkg.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {['awaiting_payment', 'payment_sent'].includes(status.key) ? (
                      <Link
                        href={`/order/${encodeURIComponent(order.order_number)}?email=${encodeURIComponent(email)}`}
                        className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white"
                      >
                        Open invoice / pay
                      </Link>
                    ) : null}
                    {status.packageCount > 0 ? (
                      <Link
                        href="/account?tab=shipments"
                        className="rounded-xl border border-brand-primary px-4 py-2.5 text-sm font-bold text-brand-primary"
                      >
                        Open My Shipments
                      </Link>
                    ) : null}
                    {status.openShippingInvoiceId ? (
                      <Link
                        href={`/account?tab=documents&document=${encodeURIComponent(status.openShippingInvoiceId)}`}
                        className="rounded-xl border border-brand-primary px-4 py-2.5 text-sm font-bold text-brand-primary"
                      >
                        Shipping bill
                      </Link>
                    ) : null}
                    {['ready_for_you', 'release_goods', 'arrived_in_ghana'].includes(status.key) ? (
                      <Link
                        href="/account?tab=deliveries"
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                      >
                        Deliveries
                      </Link>
                    ) : null}
                    <Link
                      href={`/order/${encodeURIComponent(order.order_number)}?email=${encodeURIComponent(email)}`}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                    >
                      Order page
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
