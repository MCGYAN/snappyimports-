'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatStoreMoney } from '@/lib/currency';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';

type HistoryKind = 'shop' | 'rmb';

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

function formatStatusLabel(status: string) {
  if (status === 'shipped') return 'Packaged';
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default function OrderHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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

        const shopOrders: ShopOrder[] = (shopRes.data || []).map((order: any) => ({
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

        const rmbOrders: RmbOrder[] = (rmbRes.data || []).map((ex: any) => ({
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
        console.error('Error fetching order history:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  const getStatusColor = (status: string, kind: HistoryKind) => {
    if (kind === 'rmb') {
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-700';
        case 'confirmed':
          return 'bg-brand-light text-brand-primary';
        case 'payment_sent':
          return 'bg-yellow-100 text-yellow-700';
        case 'expired':
          return 'bg-red-100 text-red-700';
        default:
          return 'bg-gray-100 text-gray-700';
      }
    }

    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'shipped':
        return 'bg-brand-light text-brand-primary';
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleReorder = (order: ShopOrder) => {
    console.log('Reordering:', order);
    alert('Reorder feature coming soon!');
  };

  const handleDownloadInvoice = (order: ShopOrder) => {
    const email = encodeURIComponent(order.email || '');
    const num = encodeURIComponent(order.orderNumber || order.id);
    window.open(`/order/${num}?email=${email}`, '_blank');
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-brand-primary"></i>
        <p className="mt-2 text-gray-500">Loading orders...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-shopping-bag-line text-3xl text-gray-400"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500 mb-6">
          Shop orders and Buy RMB invoices show up here in one place.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/shop"
            className="inline-block bg-brand-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-[#0d2747] transition-colors"
          >
            Go to Shop
          </Link>
          <Link
            href="/exchange"
            className="inline-block border-2 border-gray-300 text-gray-900 px-6 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Buy RMB
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
        <div className="text-sm text-gray-600">
          Total: <span className="font-bold text-gray-900">{items.length}</span>
        </div>
      </div>

      <div className="space-y-6">
        {items.map((item) =>
          item.kind === 'shop' ? (
            <div key={`shop-${item.id}`} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">Type</p>
                      <p className="font-semibold text-brand-primary">Shop order</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">Order Number</p>
                      <p className="font-bold text-gray-900">{item.orderNumber}</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(item.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">Total</p>
                      <p className="font-bold text-brand-primary">{formatStoreMoney(item.total)}</p>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto">
                    <span
                      className={`inline-block px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusColor(item.status, 'shop')}`}
                    >
                      {formatStatusLabel(item.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-4 mb-4">
                  {item.items.map((line) => (
                    <div key={line.id} className="flex space-x-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        <img
                          src={line.image}
                          alt={line.name}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 mb-1">{line.name}</h4>
                        {line.variant ? (
                          <p className="text-sm font-semibold text-brand-primary">{line.variant}</p>
                        ) : null}
                        <p className="text-sm text-gray-600">Quantity: {line.quantity}</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">{formatStoreMoney(line.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <Link
                    href={`/order/${encodeURIComponent(item.orderNumber)}?email=${encodeURIComponent(item.email)}`}
                    className="flex-1 sm:flex-none text-center px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-[#0d2747] transition-colors whitespace-nowrap"
                  >
                    <i className="ri-map-pin-line mr-2"></i>
                    Track Order
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleReorder(item)}
                    className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-refresh-line mr-2"></i>
                    Reorder
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      item.paymentStatus === 'paid'
                        ? window.location.assign('/account?tab=documents')
                        : handleDownloadInvoice(item)
                    }
                    className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-file-list-3-line mr-2"></i>
                    {item.paymentStatus === 'paid' ? 'View receipt' : 'Invoice & pay'}
                  </button>
                  <Link
                    href="/contact"
                    className="flex-1 sm:flex-none text-center px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-customer-service-line mr-2"></i>
                    Get Help
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div key={`rmb-${item.id}`} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">Type</p>
                      <p className="font-semibold text-brand-accent">Buy RMB</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">Exchange number</p>
                      <p className="font-bold text-gray-900">{item.exchangeNumber}</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(item.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <p className="text-xs text-gray-600 mb-1">You pay</p>
                      <p className="font-bold text-brand-primary">{formatStoreMoney(item.amountFrom)}</p>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto">
                    <span
                      className={`inline-block px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusColor(item.status, 'rmb')}`}
                    >
                      {formatStatusLabel(item.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">
                  You get <span className="font-bold text-gray-900">{item.amountTo.toFixed(2)} RMB</span>
                  {' '}at rate {item.rate.toFixed(4)}.
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4 border-t border-gray-200">
                  <Link
                    href={
                      item.phone
                        ? `/exchange/${encodeURIComponent(item.exchangeNumber)}?phone=${encodeURIComponent(item.phone)}`
                        : `/exchange/${encodeURIComponent(item.exchangeNumber)}`
                    }
                    className="flex-1 sm:flex-none text-center px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold hover:bg-[#0d2747] transition-colors whitespace-nowrap"
                  >
                    <i className="ri-file-list-3-line mr-2"></i>
                    Open invoice
                  </Link>
                  <Link
                    href="/contact"
                    className="flex-1 sm:flex-none text-center px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    <i className="ri-customer-service-line mr-2"></i>
                    Get Help
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
