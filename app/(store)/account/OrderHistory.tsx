'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatStoreMoney } from '@/lib/currency';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';
import { isPastRmbOrder, isPastShopOrder } from '@/lib/account-order-status';

interface ShopOrder {
  kind: 'shop';
  id: string;
  orderNumber: string;
  email: string;
  date: string;
  status: string;
  paymentStatus: string;
  total: number;
  items: {
    id: string;
    name: string;
    image: string;
    quantity: number;
    price: number;
    variant?: string;
  }[];
}

interface RmbOrder {
  kind: 'rmb';
  id: string;
  exchangeNumber: string;
  phone: string;
  date: string;
  status: string;
  amountFrom: number;
  amountTo: number;
  rate: number;
}

type HistoryItem = ShopOrder | RmbOrder;

/** Archive only. No live status. Active tracking lives in Order status. */
export default function OrderHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        if (session.access_token) {
          try {
            await fetch('/api/orders/claim', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({}),
            });
          } catch {
            /* non-blocking */
          }
        }

        const [shopRes, rmbRes] = await Promise.all([
          supabase
            .from('orders')
            .select(`*, order_items (*)`)
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('exchange_orders')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
        ]);

        if (shopRes.error) throw shopRes.error;
        if (rmbRes.error) throw rmbRes.error;

        const shopOrders: ShopOrder[] = (shopRes.data || [])
          .filter((order: any) => isPastShopOrder(order))
          .map((order: any) => ({
            kind: 'shop' as const,
            id: order.id,
            orderNumber: order.order_number,
            email: order.email || session.user.email || '',
            date: order.created_at,
            status: order.status,
            paymentStatus: order.payment_status,
            total: order.total,
            items: (order.order_items || []).map((item: any) => ({
              id: item.id,
              name: item.product_name,
              image: item.metadata?.image || 'https://via.placeholder.com/150',
              quantity: item.quantity,
              price: item.unit_price,
              variant: cleanVariantDisplayLabel(item.variant_name) || undefined,
            })),
          }));

        const rmbOrders: RmbOrder[] = (rmbRes.data || [])
          .filter((ex: any) => isPastRmbOrder(ex))
          .map((ex: any) => ({
            kind: 'rmb' as const,
            id: ex.id,
            exchangeNumber: ex.exchange_number,
            phone: ex.phone || '',
            date: ex.created_at,
            status: ex.status,
            amountFrom: Number(ex.amount_from),
            amountTo: Number(ex.amount_to),
            rate: Number(ex.rate),
          }));

        const merged = [...shopOrders, ...rmbOrders].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        setItems(merged);
      } catch (err) {
        console.error('Error fetching past orders:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-brand-primary"></i>
        <p className="mt-2 text-gray-500">Loading past orders…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <i className="ri-archive-line text-3xl text-gray-400"></i>
        </div>
        <h3 className="mb-1 text-lg font-semibold text-gray-900">No past orders yet</h3>
        <p className="mb-6 text-gray-500">
          Finished and cancelled orders appear here. Live progress is only in{' '}
          <Link href="/account?tab=status" className="font-semibold text-brand-primary underline">
            Order status
          </Link>
          .
        </p>
        <Link
          href="/account?tab=status"
          className="inline-block rounded-lg bg-brand-primary px-6 py-2 font-medium text-white hover:bg-[#0d2747]"
        >
          Open Order status
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Past orders</h2>
        <div className="text-sm text-gray-600">
          Total: <span className="font-bold text-gray-900">{items.length}</span>
        </div>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Archive of finished shop and Buy RMB orders. No live status here. Track active work in{' '}
        <Link href="/account?tab=status" className="font-semibold text-brand-primary underline">
          Order status
        </Link>
        .
      </p>

      <div className="space-y-6">
        {items.map((item) =>
          item.kind === 'shop' ? (
            <div
              key={`shop-${item.id}`}
              className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white"
            >
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <div className="flex flex-col flex-wrap items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex w-full flex-col flex-wrap items-start gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">Type</p>
                      <p className="font-semibold text-brand-primary">Shop order</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">Order number</p>
                      <p className="font-bold text-gray-900">{item.orderNumber}</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(item.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">Total</p>
                      <p className="font-bold text-brand-primary">
                        {formatStoreMoney(item.total)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4 space-y-4">
                  {item.items.map((line) => (
                    <div key={line.id} className="flex space-x-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                        <img
                          src={line.image}
                          alt={line.name}
                          className="h-full w-full object-cover object-center"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="mb-1 font-semibold text-gray-900">{line.name}</h4>
                        {line.variant ? (
                          <p className="text-sm font-semibold text-brand-primary">{line.variant}</p>
                        ) : null}
                        <p className="text-sm text-gray-600">Quantity: {line.quantity}</p>
                        <p className="mt-1 text-sm font-bold text-gray-900">
                          {formatStoreMoney(line.price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col flex-wrap gap-3 border-t border-gray-200 pt-4 sm:flex-row">
                  <Link
                    href={`/order/${encodeURIComponent(item.orderNumber)}?email=${encodeURIComponent(item.email)}`}
                    className="flex-1 whitespace-nowrap rounded-lg border-2 border-gray-300 px-4 py-2 text-center font-semibold text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
                  >
                    View order
                  </Link>
                  <Link
                    href="/account?tab=documents"
                    className="flex-1 whitespace-nowrap rounded-lg border-2 border-gray-300 px-4 py-2 text-center font-semibold text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
                  >
                    Invoices and receipts
                  </Link>
                  <Link
                    href="/contact"
                    className="flex-1 whitespace-nowrap rounded-lg border-2 border-gray-300 px-4 py-2 text-center font-semibold text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
                  >
                    Get help
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={`rmb-${item.id}`}
              className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white"
            >
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <div className="flex flex-col flex-wrap items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex w-full flex-col flex-wrap items-start gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">Type</p>
                      <p className="font-semibold text-brand-accent">Buy RMB</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">Exchange number</p>
                      <p className="font-bold text-gray-900">{item.exchangeNumber}</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(item.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="mb-1 text-xs text-gray-600">You paid</p>
                      <p className="font-bold text-brand-primary">
                        {formatStoreMoney(item.amountFrom)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="mb-4 text-sm text-gray-700">
                  You got{' '}
                  <span className="font-bold text-gray-900">{item.amountTo.toFixed(2)} RMB</span> at
                  rate {item.rate.toFixed(4)}.
                </p>

                <div className="flex flex-col flex-wrap gap-3 border-t border-gray-200 pt-4 sm:flex-row">
                  <Link
                    href={
                      item.phone
                        ? `/exchange/${encodeURIComponent(item.exchangeNumber)}?phone=${encodeURIComponent(item.phone)}`
                        : `/exchange/${encodeURIComponent(item.exchangeNumber)}`
                    }
                    className="flex-1 whitespace-nowrap rounded-lg border-2 border-gray-300 px-4 py-2 text-center font-semibold text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
                  >
                    View details
                  </Link>
                  <Link
                    href="/contact"
                    className="flex-1 whitespace-nowrap rounded-lg border-2 border-gray-300 px-4 py-2 text-center font-semibold text-gray-900 transition-colors hover:bg-gray-50 sm:flex-none"
                  >
                    Get help
                  </Link>
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
