'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatStoreMoney } from '@/lib/currency';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';
import {
  ACCOUNT_RMB_STATUS_STEPS,
  accountOrderStatusIndex,
  accountOrderStatusTone,
  accountRmbStatusIndex,
  accountRmbStatusTone,
  deriveAccountOrderStatus,
  deriveAccountRmbStatus,
  visibleAccountOrderStatusSteps,
  type AccountOrderPackageSummary,
} from '@/lib/account-order-status';
import { SHIPPING_STATUS_LABELS, type ShippingPackageStatus } from '@/lib/shipping';

type ShopStatusOrder = {
  kind?: 'shop';
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_status: string;
  total: number;
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

type RmbStatusOrder = {
  kind?: 'rmb';
  id: string;
  exchange_number: string;
  phone?: string | null;
  status: string;
  payment_status?: string;
  amount_from: number;
  amount_to: number;
  rate: number;
  created_at: string;
};

type OrderStatusProps = {
  orders: ShopStatusOrder[];
  rmbOrders?: RmbStatusOrder[];
  loading: boolean;
  focusOrderNumber?: string | null;
};

export default function OrderStatus({
  orders,
  rmbOrders = [],
  loading,
  focusOrderNumber,
}: OrderStatusProps) {
  const ranked = useMemo(() => {
    const shopRows = orders.map((order) => {
      const packages = order.packages || [];
      const status = deriveAccountOrderStatus(
        order,
        packages,
        order.openShippingInvoiceId || null,
      );
      const needsShippingBill = packages.some(
        (pkg) => !pkg.freight_included && Boolean(pkg.final_usd_to_ghs || pkg.estimated_shipping_usd),
      );
      return {
        kind: 'shop' as const,
        key: order.order_number,
        date: order.created_at,
        order,
        status,
        needsShippingBill,
      };
    });

    const rmbRows = rmbOrders.map((exchange) => {
      const status = deriveAccountRmbStatus(exchange);
      return {
        kind: 'rmb' as const,
        key: exchange.exchange_number,
        date: exchange.created_at,
        exchange,
        status,
      };
    });

    return [...shopRows, ...rmbRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [orders, rmbOrders]);

  const initialExpanded =
    focusOrderNumber || ranked[0]?.key || null;
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
        <p className="mt-2 font-semibold text-slate-700">Nothing in progress</p>
        <p className="mt-1 text-sm text-slate-500">
          Active shop imports and Buy RMB requests show here. Finished ones move to Past orders.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/shop"
            className="inline-flex rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white"
          >
            Go to shop
          </Link>
          <Link
            href="/exchange"
            className="inline-flex rounded-xl border border-brand-primary px-5 py-2.5 text-sm font-bold text-brand-primary"
          >
            Buy RMB
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">Order status</h2>
        <p className="mt-1 text-sm text-slate-500">
          The only place for live progress on shop imports and Buy RMB. Names match what staff see
          on the dashboard. Finished orders move to Past orders.
        </p>
      </div>

      <div className="space-y-4">
        {ranked.map((row) => {
          const isOpen = expanded === row.key;

          if (row.kind === 'rmb') {
            const { exchange, status } = row;
            const currentIndex = accountRmbStatusIndex(status.key);
            const tone = accountRmbStatusTone(status.key);
            const steps =
              status.key === 'expired'
                ? [
                    {
                      key: 'expired' as const,
                      title: 'Expired',
                      description: 'This Buy RMB rate lock expired.',
                    },
                  ]
                : ACCOUNT_RMB_STATUS_STEPS;

            return (
              <section
                key={`rmb-${exchange.id}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) => (current === row.key ? null : row.key))
                  }
                  className="flex w-full flex-col gap-3 px-4 py-4 text-left hover:bg-slate-50 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-accent">
                      Buy RMB
                    </p>
                    <p className="break-all font-bold text-slate-900 sm:truncate">
                      {exchange.exchange_number}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {Number(exchange.amount_to).toFixed(2)} RMB for{' '}
                      {formatStoreMoney(Number(exchange.amount_from))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:block sm:text-right">
                    <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-xs font-bold ${tone.badge}`}>
                      Now at {status.title}
                    </span>
                    <p className="w-full text-xs font-semibold text-slate-400 sm:mt-1 sm:w-auto">
                      {isOpen ? 'Hide timeline' : 'Show timeline'}
                    </p>
                  </div>
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-100 px-5 py-5">
                    <div className={`rounded-xl px-4 py-3 ${tone.panel}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${tone.label}`}>
                        Now at
                      </p>
                      <p className={`font-bold ${tone.title}`}>{status.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{status.description}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{status.nextHint}</p>
                    </div>

                    <ol className="mt-5 space-y-3">
                      {steps.map((step) => {
                        const idx = accountRmbStatusIndex(step.key as any);
                        const done = currentIndex >= 0 && idx >= 0 && idx < currentIndex;
                        const active = step.key === status.key;
                        const stepTone = accountRmbStatusTone(step.key as any);
                        return (
                          <li key={step.key} className="flex gap-3">
                            <div
                              className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                                active
                                  ? stepTone.dot
                                  : done
                                    ? 'bg-slate-500'
                                    : 'bg-slate-200'
                              }`}
                            />
                            <div>
                              <p
                                className={`text-sm font-semibold ${
                                  active ? stepTone.title : 'text-slate-800'
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

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Link
                        href={
                          exchange.phone
                            ? `/exchange/${encodeURIComponent(exchange.exchange_number)}?phone=${encodeURIComponent(exchange.phone)}`
                            : `/exchange/${encodeURIComponent(exchange.exchange_number)}`
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white"
                      >
                        {status.key === 'awaiting_payment' || status.key === 'payment_sent'
                          ? 'Open Buy RMB invoice'
                          : 'View Buy RMB'}
                      </Link>
                      <Link
                        href="/account?tab=documents"
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                      >
                        Invoices and receipts
                      </Link>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          }

          const { order, status, needsShippingBill } = row;
          const steps = visibleAccountOrderStatusSteps(
            status.key,
            status.packageCount > 0 || status.key === 'needs_packing',
            needsShippingBill,
          );
          const currentIndex = accountOrderStatusIndex(status.key);
          const tone = accountOrderStatusTone(status.key);
          const email = order.email || '';
          const packages = order.packages || [];

          return (
            <section
              key={`shop-${order.id}`}
              id={`order-status-${order.order_number}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) => (current === row.key ? null : row.key))
                }
                className="flex w-full flex-col gap-3 px-4 py-4 text-left hover:bg-slate-50 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Shop import
                  </p>
                  <p className="break-all font-bold text-slate-900 sm:truncate">{order.order_number}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500 sm:line-clamp-1">
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
                <div className="flex flex-wrap items-center justify-between gap-2 sm:block sm:text-right">
                  <p className="text-sm font-bold text-brand-primary">
                    {formatStoreMoney(order.total)}
                  </p>
                  <span
                    className={`inline-flex max-w-full rounded-full px-3 py-1 text-xs font-bold ${tone.badge}`}
                  >
                    Now at {status.title}
                  </span>
                  <p className="w-full text-xs font-semibold text-slate-400 sm:mt-1 sm:w-auto">
                    {isOpen ? 'Hide timeline' : 'Show timeline'}
                  </p>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-slate-100 px-4 py-5 sm:px-5">
                  <div className={`rounded-xl px-4 py-3 ${tone.panel}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${tone.label}`}>
                      Now at
                    </p>
                    <p className={`font-bold ${tone.title}`}>{status.title}</p>
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
                      const stepTone = accountOrderStatusTone(step.key);
                      return (
                        <li key={step.key} className="flex gap-3">
                          <div
                            className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                              active
                                ? stepTone.dot
                                : done
                                  ? 'bg-slate-500'
                                  : 'bg-slate-200'
                            }`}
                          />
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold ${
                                active ? stepTone.title : 'text-slate-800'
                              }`}
                            >
                              {step.title}
                            </p>
                            <p className="text-xs text-slate-500 sm:text-sm">{step.description}</p>
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
                            className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2"
                          >
                            <span className="min-w-0 font-semibold text-slate-800">
                              {pkg.package_name}{' '}
                              <span className="break-all font-mono text-[10px] text-slate-400">
                                {pkg.tracking_id}
                              </span>
                            </span>
                            <span className="w-fit rounded-full bg-white px-2 py-1 text-xs font-semibold text-orange-800">
                              {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus] ||
                                pkg.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {['awaiting_payment', 'payment_sent'].includes(status.key) ? (
                      <Link
                        href={`/order/${encodeURIComponent(order.order_number)}?email=${encodeURIComponent(email)}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white sm:w-auto"
                      >
                        Open invoice / pay
                      </Link>
                    ) : null}
                    {status.packageCount > 0 ? (
                      <Link
                        href="/account?tab=shipments"
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-primary px-4 py-2.5 text-sm font-bold text-brand-primary"
                      >
                        Open My Shipments
                      </Link>
                    ) : null}
                    {status.openShippingInvoiceId ? (
                      <Link
                        href={`/account?tab=documents&document=${encodeURIComponent(status.openShippingInvoiceId)}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-primary px-4 py-2.5 text-sm font-bold text-brand-primary"
                      >
                        Shipping bill
                      </Link>
                    ) : null}
                    {['ready_for_you', 'release_goods', 'arrived_in_ghana'].includes(status.key) ? (
                      <Link
                        href="/account?tab=deliveries"
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                      >
                        Deliveries
                      </Link>
                    ) : null}
                    <Link
                      href={`/order/${encodeURIComponent(order.order_number)}?email=${encodeURIComponent(email)}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
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
