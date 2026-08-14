'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { downloadCsv } from '@/lib/csv-download';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount || 0);

type InsightCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  segment: 'vip' | 'returning' | 'new' | 'at-risk';
  totalSpent: number;
  orders: number;
  avgOrderValue: number;
  lifetimeValue: number;
  joinDate: string;
  lastOrder: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  engagementScore: number;
  isGuest: boolean;
};

function normalizeEmail(email: string | null | undefined) {
  return String(email || '')
    .toLowerCase()
    .trim();
}

function displayName(customer: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const combined =
    customer.full_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() ||
    '';
  return combined || customer.email || 'Customer';
}

export default function CustomerInsightsPage() {
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<InsightCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchCustomerData();
  }, []);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      setError('');

      const [{ data: customerRows, error: customerError }, { data: orders, error: orderError }] =
        await Promise.all([
          supabase
            .from('customers')
            .select(
              'id, email, phone, full_name, first_name, last_name, user_id, created_at, secondary_email',
            )
            .order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('id, user_id, email, total, created_at, status, shipping_address'),
        ]);

      if (customerError) throw customerError;
      if (orderError) throw orderError;

      const countableOrders = (orders || []).filter(
        (order) => String(order.status || '').toLowerCase() !== 'cancelled',
      );

      const aggregated: InsightCustomer[] = (customerRows || []).map((customer) => {
        const primaryEmail = normalizeEmail(customer.email);
        const secondaryEmail = normalizeEmail(customer.secondary_email);

        const userOrders = countableOrders.filter((order) => {
          if (customer.user_id && order.user_id === customer.user_id) return true;
          const orderEmail = normalizeEmail(order.email);
          if (!orderEmail) return false;
          return orderEmail === primaryEmail || (!!secondaryEmail && orderEmail === secondaryEmail);
        });

        const totalSpent = userOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        const orderCount = userOrders.length;
        const sortedOrders = [...userOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const lastOrderDate = sortedOrders[0]?.created_at || null;

        const daysSinceJoin =
          (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 3600 * 24);
        const daysSinceLastOrder = lastOrderDate
          ? (Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 3600 * 24)
          : daysSinceJoin;

        let segment: InsightCustomer['segment'] = 'new';
        if (totalSpent > 1000) segment = 'vip';
        else if (orderCount > 1) segment = 'returning';
        else if (orderCount > 0 && daysSinceLastOrder > 90) segment = 'at-risk';
        else if (daysSinceJoin < 30 && orderCount <= 1) segment = 'new';
        else if (orderCount > 0) segment = 'returning';
        else segment = 'new';

        let riskLevel: InsightCustomer['riskLevel'] = 'low';
        if (!lastOrderDate || daysSinceLastOrder > 120) riskLevel = 'high';
        else if (daysSinceLastOrder > 60) riskLevel = 'medium';

        let engagementScore = 40;
        if (segment === 'vip') engagementScore += 35;
        if (orderCount > 0) engagementScore += 15;
        if (orderCount > 1) engagementScore += 10;
        if (lastOrderDate && daysSinceLastOrder < 30) engagementScore += 20;
        if (riskLevel === 'high') engagementScore -= 25;

        const shipName = sortedOrders[0]?.shipping_address
          ? [
              (sortedOrders[0].shipping_address as any)?.firstName,
              (sortedOrders[0].shipping_address as any)?.lastName,
            ]
              .filter(Boolean)
              .join(' ')
              .trim()
          : '';

        const fromCustomer = displayName(customer);
        const name =
          fromCustomer && fromCustomer !== (customer.email || '')
            ? fromCustomer
            : shipName || fromCustomer;

        return {
          id: customer.id,
          name,
          email: customer.email || secondaryEmail || 'No email',
          phone: customer.phone || '-',
          segment,
          totalSpent,
          orders: orderCount,
          avgOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
          lifetimeValue: totalSpent,
          joinDate: customer.created_at,
          lastOrder: lastOrderDate,
          riskLevel,
          engagementScore: Math.min(100, Math.max(0, engagementScore)),
          isGuest: !customer.user_id,
        };
      });

      // Newest activity first
      aggregated.sort((a, b) => {
        const aTime = new Date(a.lastOrder || a.joinDate).getTime();
        const bTime = new Date(b.lastOrder || b.joinDate).getTime();
        return bTime - aTime;
      });

      setCustomers(aggregated);
    } catch (err: any) {
      console.error('Error fetching customer insights:', err);
      setError(err?.message || 'Could not load customer insights.');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalCLV = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);
    return {
      vip: customers.filter((c) => c.segment === 'vip').length,
      returning: customers.filter((c) => c.segment === 'returning').length,
      new: customers.filter((c) => c.segment === 'new').length,
      atRisk: customers.filter((c) => c.segment === 'at-risk').length,
      avgCLV: customers.length > 0 ? totalCLV / customers.length : 0,
    };
  }, [customers]);

  const filteredCustomers = customers.filter((customer) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      customer.name.toLowerCase().includes(q) || customer.email.toLowerCase().includes(q);
    const matchesSegment = selectedSegment === 'all' || customer.segment === selectedSegment;
    return matchesSearch && matchesSegment;
  });

  const getSegmentBadge = (segment: string) => {
    const badges: Record<string, string> = {
      vip: 'bg-brand-primary/10 text-brand-primary',
      returning: 'bg-brand-primary/10 text-brand-primary',
      new: 'bg-amber-100 text-amber-700',
      'at-risk': 'bg-red-100 text-red-700',
    };
    return badges[segment] || 'bg-gray-100 text-gray-700';
  };

  const getSegmentLabel = (segment: string) => {
    const labels: Record<string, string> = {
      vip: 'VIP Customer',
      returning: 'Returning',
      new: 'New Customer',
      'at-risk': 'At Risk',
    };
    return labels[segment] || segment;
  };

  const getRiskBadge = (risk: string) => {
    const badges: Record<string, string> = {
      low: 'bg-brand-primary/10 text-brand-primary',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-red-100 text-red-700',
    };
    return badges[risk] || 'bg-gray-100';
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Insights...</div>;
  }

  const handleExportList = () => {
    if (filteredCustomers.length === 0) {
      alert('No customers to export.');
      return;
    }
    const date = new Date().toISOString().split('T')[0];
    downloadCsv(`customer-insights-${date}.csv`, [
      [
        'Name',
        'Email',
        'Phone',
        'Segment',
        'Orders',
        'Total Spent',
        'Avg Order Value',
        'Lifetime Value',
        'Join Date',
        'Last Order',
        'Risk',
      ],
      ...filteredCustomers.map((c) => [
        c.name,
        c.email,
        c.phone,
        c.segment,
        c.orders,
        Number(c.totalSpent).toFixed(2),
        Number(c.avgOrderValue).toFixed(2),
        Number(c.lifetimeValue).toFixed(2),
        new Date(c.joinDate).toLocaleDateString('en-GB'),
        c.lastOrder ? new Date(c.lastOrder).toLocaleDateString('en-GB') : 'Never',
        c.riskLevel,
      ]),
    ]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Customer Insights</h1>
            <p className="mt-1 text-sm text-gray-600 md:mt-2 md:text-base">
              Built from every store customer and their real orders, including guest checkouts.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void fetchCustomerData()}
              className="rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExportList}
              className="flex items-center justify-center whitespace-nowrap rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400"
            >
              <i className="ri-download-line mr-2"></i>
              Export List
            </button>
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-lg bg-brand-primary px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-brand-accent"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">VIP Customers</p>
            <p className="text-3xl font-bold text-gray-900">{stats.vip}</p>
            <p className="mt-2 text-sm font-semibold text-brand-primary">Spent &gt; GH¢1,000</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">Returning Customers</p>
            <p className="text-3xl font-bold text-gray-900">{stats.returning}</p>
            <p className="mt-2 text-sm font-semibold text-brand-primary">More than 1 order</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">At Risk</p>
            <p className="text-3xl font-bold text-gray-900">{stats.atRisk}</p>
            <p className="mt-2 text-sm font-semibold text-red-700">Inactive &gt; 90 days</p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">Avg. Lifetime Value</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.avgCLV)}</p>
            <p className="mt-2 text-sm text-gray-500">Per customer</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div className="relative max-w-md flex-1">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-400"></i>
              <input
                type="text"
                placeholder="Search customers by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 py-3 pl-12 pr-4 text-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/25"
              />
            </div>

            <div className="flex flex-wrap gap-2 rounded-lg bg-gray-100 p-1">
              {[
                { value: 'all', label: 'All', count: customers.length },
                { value: 'vip', label: 'VIP', count: stats.vip },
                { value: 'returning', label: 'Returning', count: stats.returning },
                { value: 'new', label: 'New', count: stats.new },
                { value: 'at-risk', label: 'At Risk', count: stats.atRisk },
              ].map((segment) => (
                <button
                  key={segment.value}
                  type="button"
                  onClick={() => setSelectedSegment(segment.value)}
                  className={`flex-grow whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-grow-0 ${
                    selectedSegment === segment.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {segment.label} ({segment.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="rounded-xl bg-white py-12 text-center">
              <p className="text-gray-500">No customers found matching this criteria.</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-accent text-2xl font-bold text-white">
                      {customer.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{customer.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                        <span className="flex items-center">
                          <i className="ri-mail-line mr-1"></i>
                          {customer.email}
                        </span>
                        <span className="flex items-center">
                          <i className="ri-phone-line mr-1"></i>
                          {customer.phone}
                        </span>
                        {customer.isGuest ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Guest checkout
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex items-center space-x-2">
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${getSegmentBadge(customer.segment)}`}
                        >
                          {getSegmentLabel(customer.segment)}
                        </span>
                        <span
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${getRiskBadge(customer.riskLevel)}`}
                        >
                          {customer.riskLevel === 'low' && 'Low Risk'}
                          {customer.riskLevel === 'medium' && 'Medium Risk'}
                          {customer.riskLevel === 'high' && 'High Risk'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-1 text-sm text-gray-600">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(customer.totalSpent)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-1 text-sm text-gray-600">Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{customer.orders}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-1 text-sm text-gray-600">Avg. Order</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(customer.avgOrderValue)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-1 text-sm text-gray-600">Lifetime Value</p>
                    <p className="text-2xl font-bold text-brand-primary">
                      {formatCurrency(customer.lifetimeValue)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="mb-1 text-sm text-gray-600">Engagement</p>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 flex-1 rounded-full bg-gray-200">
                        <div
                          className={`h-2 rounded-full ${
                            customer.engagementScore >= 80
                              ? 'bg-brand-primary'
                              : customer.engagementScore >= 60
                                ? 'bg-brand-primary'
                                : customer.engagementScore >= 40
                                  ? 'bg-amber-600'
                                  : 'bg-red-600'
                          }`}
                          style={{ width: `${customer.engagementScore}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {customer.engagementScore}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
                    <span>
                      <span className="font-medium">Joined:</span>{' '}
                      {new Date(customer.joinDate).toLocaleDateString('en-GB')}
                    </span>
                    <span>
                      <span className="font-medium">Last Order:</span>{' '}
                      {customer.lastOrder
                        ? new Date(customer.lastOrder).toLocaleDateString('en-GB')
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
