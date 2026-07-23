'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ProductSalesStats from './ProductSalesStats';
import {
  deriveFulfillmentStage,
  FULFILLMENT_STAGES,
  type FulfillmentStage,
} from '@/lib/order-journey';

interface Order {
  id: string;
  order_number: string;
  email: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  shipping_method: string;
  created_at: string;
  phone?: string;
  shipping_address?: any;
  metadata?: any;
  profiles?: {
    full_name: string;
    email: string;
  };
  order_items?: {
    quantity: number;
    product_name?: string;
  }[];
}

interface OrderStats {
  label: string;
  count: number;
  status: string;
}

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderViewTab, setOrderViewTab] = useState<'paid' | 'open'>('paid');
  const [sendingPaymentLink, setSendingPaymentLink] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats[]>([
    { label: 'All paid', count: 0, status: 'all' },
    { label: 'Payment confirmed', count: 0, status: 'paid' },
    { label: 'Sourcing', count: 0, status: 'sourcing' },
    { label: 'To Ghana', count: 0, status: 'en_route_ghana' },
    { label: 'In Ghana', count: 0, status: 'in_ghana' },
    { label: 'Ready', count: 0, status: 'ready' },
    { label: 'Delivered', count: 0, status: 'delivered' },
  ]);
  const [abandonedCount, setAbandonedCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [needsConfirmCount, setNeedsConfirmCount] = useState(0);
  const [showProductStats, setShowProductStats] = useState(false);
  const [productFilter, setProductFilter] = useState('all');
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Fetch orders with related data
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          email,
          total,
          status,
          payment_status,
          payment_method,
          shipping_method,
          created_at,
          phone,
          shipping_address,
          metadata,
          order_items (
            quantity,
            product_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(ordersData || []);

      // Extract unique product names for filter
      const productNames = new Set<string>();
      ordersData?.forEach(o => {
        o.order_items?.forEach((item: any) => {
          if (item.product_name) productNames.add(item.product_name);
        });
      });
      setAvailableProducts(Array.from(productNames).sort());

      // Paid vs still open (awaiting transfer / awaiting your confirmation)
      const confirmedOrders = ordersData?.filter(o => o.payment_status === 'paid') || [];
      const abandonedOrders = ordersData?.filter(o => o.payment_status !== 'paid') || [];
      
      setConfirmedCount(confirmedOrders.length);
      setAbandonedCount(abandonedOrders.length);
      setNeedsConfirmCount(
        abandonedOrders.filter(o => o.payment_status === 'awaiting_confirmation').length
      );

      // Calculate stats from import journey milestones (paid orders)
      const journeyOf = (o: Order) => deriveFulfillmentStage(o);
      const stats = [
        { label: 'All paid', count: confirmedOrders.length, status: 'all' },
        {
          label: 'Payment confirmed',
          count: confirmedOrders.filter((o) => journeyOf(o) === 'paid').length,
          status: 'paid',
        },
        {
          label: 'Sourcing',
          count: confirmedOrders.filter((o) => journeyOf(o) === 'sourcing').length,
          status: 'sourcing',
        },
        {
          label: 'To Ghana',
          count: confirmedOrders.filter((o) => journeyOf(o) === 'en_route_ghana').length,
          status: 'en_route_ghana',
        },
        {
          label: 'In Ghana',
          count: confirmedOrders.filter((o) => journeyOf(o) === 'in_ghana').length,
          status: 'in_ghana',
        },
        {
          label: 'Ready',
          count: confirmedOrders.filter((o) => journeyOf(o) === 'ready').length,
          status: 'ready',
        },
        {
          label: 'Delivered',
          count: confirmedOrders.filter((o) => journeyOf(o) === 'delivered').length,
          status: 'delivered',
        },
      ];
      setOrderStats(stats);

    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const journeyColors: Record<string, string> = {
    awaiting_payment: 'bg-gray-100 text-gray-700 border-gray-200',
    payment_sent: 'bg-amber-100 text-amber-700 border-amber-200',
    paid: 'bg-green-100 text-green-700 border-green-200',
    sourcing: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
    en_route_ghana: 'bg-sky-100 text-sky-800 border-sky-200',
    in_ghana: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    delivered: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
  };

  const formatJourney = (order: Order) => {
    const stage = deriveFulfillmentStage(order);
    return (
      FULFILLMENT_STAGES.find((s) => s.key === stage)?.title ||
      stage.replace(/_/g, ' ')
    );
  };

  const getCustomerName = (order: Order) => {
    // Try shipping address names first (most reliable — entered at checkout)
    if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      const first = order.shipping_address.firstName?.trim() || '';
      const last = order.shipping_address.lastName?.trim() || '';
      return `${first} ${last}`.trim();
    }
    if (order.shipping_address?.full_name) return order.shipping_address.full_name;
    // Try metadata names
    if (order.metadata?.first_name || order.metadata?.last_name) {
      const first = order.metadata.first_name?.trim() || '';
      const last = order.metadata.last_name?.trim() || '';
      return `${first} ${last}`.trim();
    }
    if (order.profiles?.full_name) return order.profiles.full_name;
    if (order.email) {
      const name = order.email.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'Guest';
  };

  const getCustomerEmail = (order: Order) => {
    return order.email || order.profiles?.email || 'N/A';
  };

  const getCustomerAvatar = (order: Order) => {
    const name = getCustomerName(order);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getItemCount = (order: Order) => {
    if (!order.order_items) return 0;
    return order.order_items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    } else {
      setSelectedOrders([...selectedOrders, orderId]);
    }
  };

  const handleBulkAction = async (action: string, newStatus?: string) => {
    if (newStatus) {
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .in('id', selectedOrders);

        if (error) throw error;



        // Send Notifications with auth token
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;
        
        const updatedOrders = orders.filter(o => selectedOrders.includes(o.id));
        updatedOrders.forEach(order => {
          fetch('/api/notifications', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            body: JSON.stringify({
              type: 'order_updated',
              payload: { order, status: newStatus }
            })
          }).catch(err => console.error('Notification error', err));
        });

        await fetchOrders();
        setSelectedOrders([]);
        alert(`${selectedOrders.length} orders updated to ${newStatus}`);
      } catch (error) {
        console.error('Error updating orders:', error);
        alert('Failed to update orders');
      }
    } else if (action === 'Export') {
      const ordersToExport = orders.filter(o => selectedOrders.includes(o.id));
      const csvContent = `Order ID,Customer,Email,Date,Items,Total,Status,Payment\n${ordersToExport.map(o =>
        `${o.order_number || o.id},${getCustomerName(o)},${getCustomerEmail(o)},${formatDate(o.created_at)},${getItemCount(o)},${o.total},${o.status},${o.payment_method || 'N/A'}`
      ).join('\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selected-orders.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const handleExportAll = () => {
    const csvContent = `Order ID,Customer,Email,Date,Items,Total,Status,Payment\n${orders.map(o =>
      `${o.order_number || o.id},${getCustomerName(o)},${getCustomerEmail(o)},${formatDate(o.created_at)},${getItemCount(o)},${o.total},${o.status},${o.payment_method || 'N/A'}`
    ).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-orders.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handlePrintInvoice = (orderId: string) => {
    window.open(`/admin/orders/${orderId}?print=true`, '_blank');
  };

  const handleResendPaymentLink = async (order: Order) => {
    setSendingPaymentLink(order.id);
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment_link',
          payload: order
        })
      });
      
      if (!response.ok) throw new Error('Failed to send');
      
      alert(`Payment link sent to ${order.phone || order.email}`);
    } catch (error) {
      console.error('Error sending payment link:', error);
      alert('Failed to send payment link');
    } finally {
      setSendingPaymentLink(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const customerName = getCustomerName(order).toLowerCase();
    const customerEmail = getCustomerEmail(order).toLowerCase();
    const orderId = (order.order_number || order.id).toLowerCase();

    // First filter by view tab (paid vs open)
    const isConfirmed = order.payment_status === 'paid';
    const matchesViewTab = orderViewTab === 'paid' ? isConfirmed : !isConfirmed;

    const matchesSearch = orderId.includes(searchQuery.toLowerCase()) ||
      customerName.includes(searchQuery.toLowerCase()) ||
      customerEmail.includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      deriveFulfillmentStage(order) === (statusFilter as FulfillmentStage) ||
      order.status === statusFilter;
    const matchesProduct = productFilter === 'all' || 
      order.order_items?.some((item: any) => item.product_name === productFilter);
    return matchesViewTab && matchesSearch && matchesStatus && matchesProduct;
  }).sort((a, b) => {
    // On the open tab, transfers waiting for admin confirmation come first
    if (orderViewTab !== 'open') return 0;
    const aNeeds = a.payment_status === 'awaiting_confirmation' ? 0 : 1;
    const bNeeds = b.payment_status === 'awaiting_confirmation' ? 0 : 1;
    return aNeeds - bNeeds;
  });

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-primary md:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-slate-600 md:text-base">Manage and track all customer orders</p>
        </div>
        <div className="flex w-full items-center gap-3 md:w-auto">
          <button
            onClick={() => setShowProductStats(true)}
            className="admin-btn-secondary flex flex-1 items-center justify-center px-5 py-3 shadow-sm md:flex-none"
          >
            <i className="ri-bar-chart-groupped-line mr-2"></i>
            Stats
          </button>
          <button
            onClick={handleExportAll}
            className="admin-btn-primary flex flex-1 items-center justify-center px-5 py-3 shadow-sm md:flex-none"
          >
            <i className="ri-download-line mr-2"></i>
            Export
          </button>
        </div>
      </div>

      {/* View Tabs: Paid orders vs Open orders */}
      <div className="flex border-b border-white/50">
        <button
          onClick={() => { setOrderViewTab('paid'); setStatusFilter('all'); }}
          className={`cursor-pointer px-4 py-3 text-sm font-semibold transition-colors md:px-6 ${
            orderViewTab === 'paid' ? 'admin-tab-active' : 'admin-tab-idle'
          }`}
        >
          <i className="ri-check-double-line mr-2"></i>
          Paid orders ({confirmedCount})
        </button>
        <button
          onClick={() => { setOrderViewTab('open'); setStatusFilter('all'); }}
          className={`cursor-pointer px-4 py-3 text-sm font-semibold transition-colors md:px-6 ${
            orderViewTab === 'open'
              ? 'border-b-2 border-brand-accent font-semibold text-brand-accent'
              : 'admin-tab-idle'
          }`}
        >
          <i className="ri-time-line mr-2"></i>
          Open orders ({abandonedCount})
          {needsConfirmCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
              {needsConfirmCount} to confirm
            </span>
          )}
        </button>
      </div>

      {orderViewTab === 'paid' && (
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-6">
        {orderStats.map((stat) => (
          <button
            key={stat.status}
            onClick={() => setStatusFilter(stat.status)}
            className={`cursor-pointer rounded-xl p-3 text-left transition-all md:p-4 ${
              statusFilter === stat.status ? 'admin-stat-pill-active' : 'admin-stat-pill'
            }`}
          >
            <p className="text-xl font-bold text-brand-primary md:text-2xl">{stat.count}</p>
            <p className="mt-0.5 text-xs text-slate-600 md:mt-1 md:text-sm">{stat.label}</p>
          </button>
        ))}
      </div>
      )}

      {orderViewTab === 'open' && needsConfirmCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start space-x-3">
            <i className="ri-alarm-warning-line mt-0.5 text-xl text-amber-600"></i>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {needsConfirmCount} customer{needsConfirmCount > 1 ? 's' : ''} said they paid. Check your bank or MoMo, then confirm.
              </p>
              <p className="mt-1 text-sm text-amber-700">
                These are at the top of the list. Open the order and tap Confirm payment.
              </p>
            </div>
          </div>
        </div>
      )}
      {orderViewTab === 'open' && needsConfirmCount === 0 && abandonedCount > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            <i className="ri-time-line mr-2 text-slate-400"></i>
            All open orders are waiting on the customer to pay. Nothing needs you right now.
          </p>
        </div>
      )}

      <div className="admin-card overflow-hidden">
        <div className="border-b border-white/50 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg w-5 h-5 flex items-center justify-center"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by order ID, customer name, or email..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent/25 focus:border-brand-accent text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-medium whitespace-nowrap cursor-pointer"
              >
                <i className="ri-filter-line mr-2"></i>
                Filters
              </button>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="min-w-0 flex-1 md:flex-none px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent/25 focus:border-brand-accent font-medium cursor-pointer"
              >
                <option value="all">All Products</option>
                {availableProducts.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="min-w-0 flex-1 md:flex-none px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent/25 focus:border-brand-accent font-medium cursor-pointer"
              >
                <option value="date">Sort by Date</option>
                <option value="total">Sort by Total</option>
                <option value="customer">Sort by Customer</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date Range</label>
                <input type="date" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                <select className="w-full px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer">
                  <option>All Methods</option>
                  <option>Moolre</option>
                  <option>Mobile Money</option>
                  <option>Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Shipping Method</label>
                <select className="w-full px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer">
                  <option>All Methods</option>
                  <option>Standard</option>
                  <option>Express</option>
                  <option>Store Pickup</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {selectedOrders.length > 0 && (
          <div className="p-4 bg-brand-primary/5 border-b border-brand-primary/20 flex items-center justify-between">
            <p className="text-brand-primary font-semibold">
              {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('Mark as Processing', 'processing')}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-accent text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                Mark Processing
              </button>
              <button
                onClick={() => handleBulkAction('Mark as Packaged', 'shipped')}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-accent text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                Mark Packaged
              </button>
              <button
                onClick={() => handleBulkAction('Export')}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-download-line mr-2"></i>
                Export
              </button>
            </div>
          </div>
        )}

        {/* Mobile: card list. No sideways scrolling to reach actions. */}
        <div className="md:hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <i className="ri-loader-4-line animate-spin text-3xl text-brand-primary"></i>
              <p className="mt-2">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <i className="ri-inbox-line text-4xl text-gray-300"></i>
              <p className="mt-2">No orders found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const needsConfirm =
                  orderViewTab === 'open' && order.payment_status === 'awaiting_confirmation';
                return (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className={`block p-4 active:bg-gray-50 ${needsConfirm ? 'bg-amber-50/70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-brand-primary">
                            {order.order_number || order.id.substring(0, 8)}
                          </p>
                          <p className="truncate text-sm text-gray-600">{getCustomerName(order)}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold text-gray-900">GH¢{order.total?.toFixed(2) || '0.00'}</p>
                          <span
                            className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              journeyColors[deriveFulfillmentStage(order)] ||
                              'border-gray-200 bg-gray-100 text-gray-700'
                            }`}
                          >
                            {formatJourney(order)}
                          </span>
                        </div>
                      </div>
                      {orderViewTab === 'open' && (
                        needsConfirm ? (
                          <span className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white">
                            <i className="ri-hand-coin-line"></i>
                            Customer paid. Tap to confirm
                          </span>
                        ) : (
                          <p className={`mt-2 text-xs ${order.payment_status === 'failed' ? 'text-red-600' : 'text-slate-500'}`}>
                            {order.payment_status === 'failed' ? 'Payment failed' : 'Waiting on customer to pay'}
                          </p>
                        )
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-4 px-6">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-accent/25 cursor-pointer"
                  />
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Order ID</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Customer</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Items</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Total</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Payment</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <i className="ri-loader-4-line animate-spin text-3xl text-brand-primary"></i>
                    <p className="mt-2">Loading orders...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <i className="ri-inbox-line text-4xl text-gray-300"></i>
                    <p className="mt-2">No orders found</p>
                    <p className="text-sm">Orders will appear here when customers place them</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`border-b border-gray-100 transition-colors ${
                      orderViewTab === 'open' && order.payment_status === 'awaiting_confirmation'
                        ? 'bg-amber-50/70 hover:bg-amber-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-accent/25 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <Link href={`/admin/orders/${order.id}`} className="text-brand-primary hover:text-brand-accent font-semibold whitespace-nowrap cursor-pointer">
                        {order.order_number || order.id.substring(0, 8)}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 flex items-center justify-center bg-gray-200 text-gray-700 rounded-full font-semibold text-sm">
                          {getCustomerAvatar(order)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 whitespace-nowrap">{getCustomerName(order)}</p>
                          <p className="text-sm text-gray-500">{getCustomerEmail(order)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700 text-sm whitespace-nowrap">{formatDate(order.created_at)}</td>
                    <td className="py-4 px-4 text-gray-700">{getItemCount(order)}</td>
                    <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">GH¢{order.total?.toFixed(2) || '0.00'}</td>
                    <td className="py-4 px-4 text-sm whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-gray-700">{order.payment_method || 'N/A'}</span>
                        {orderViewTab === 'open' && (
                          order.payment_status === 'awaiting_confirmation' ? (
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-600"
                            >
                              <i className="ri-hand-coin-line"></i>
                              Confirm payment
                            </Link>
                          ) : (
                            <span className={`text-xs mt-1 ${order.payment_status === 'failed' ? 'text-red-600' : 'text-slate-500'}`}>
                              {order.payment_status === 'failed' ? 'Payment failed' : 'Waiting on customer'}
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                          journeyColors[deriveFulfillmentStage(order)] ||
                          'border-gray-200 bg-gray-100 text-gray-700'
                        }`}
                      >
                        {formatJourney(order)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-brand-accent hover:bg-brand-primary/5 rounded-lg transition-colors cursor-pointer"
                          title="View Order"
                        >
                          <i className="ri-eye-line text-lg w-4 h-4 flex items-center justify-center"></i>
                        </Link>
                        {orderViewTab === 'open' && order.payment_status !== 'paid' && (
                          <button
                            onClick={() => handleResendPaymentLink(order)}
                            disabled={sendingPaymentLink === order.id}
                            className="w-8 h-8 flex items-center justify-center text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Resend Payment Link"
                          >
                            {sendingPaymentLink === order.id ? (
                              <i className="ri-loader-4-line text-lg w-4 h-4 flex items-center justify-center animate-spin"></i>
                            ) : (
                              <i className="ri-send-plane-line text-lg w-4 h-4 flex items-center justify-center"></i>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintInvoice(order.id)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-brand-accent hover:bg-brand-primary/5 rounded-lg transition-colors cursor-pointer"
                          title="Print Invoice"
                        >
                          <i className="ri-printer-line text-lg w-4 h-4 flex items-center justify-center"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > 0 && (
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <p className="text-gray-600">Showing {filteredOrders.length} of {orders.length} orders</p>
          </div>
        )}
      </div>

      <ProductSalesStats isOpen={showProductStats} onClose={() => setShowProductStats(false)} />
    </div>
  );
}
