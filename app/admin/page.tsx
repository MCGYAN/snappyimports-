'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import ChartContainer from '@/components/admin/ChartContainer';
import { BRAND_ACCENT, type AdminStatTone } from '@/lib/brand';

type StatItem = {
  title: string;
  value: string;
  change: string;
  trend: string;
  icon: string;
  tone: AdminStatTone;
};

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState('7days'); // logic not implemented for this demo, just UI
  const [loading, setLoading] = useState(true);

  // Real Stats
  const [stats, setStats] = useState<StatItem[]>([
    {
      title: 'Total Revenue',
      value: '$ 0.00',
      change: '0%',
      trend: 'up',
      icon: 'ri-money-dollar-circle-line',
      tone: 'accent',
    },
    {
      title: 'Orders',
      value: '0',
      change: '0%',
      trend: 'up',
      icon: 'ri-shopping-bag-line',
      tone: 'primary',
    },
    {
      title: 'Customers',
      value: '0',
      change: '0%',
      trend: 'up',
      icon: 'ri-group-line',
      tone: 'accent',
    },
    {
      title: 'Avg Order Value',
      value: '$ 0.00',
      change: '0%',
      trend: 'up',
      icon: 'ri-line-chart-line',
      tone: 'primary',
    },
  ]);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setDashboardError(null);
      try {
        // 1. Fetch ALL Orders for count & customers
        const { data: allOrdersData, error: ordersError } = await supabase
          .from('orders')
          .select('total, status, payment_status, created_at, email');

        if (ordersError) {
          const errMsg = ordersError.message || ordersError.code || 'Failed to load orders';
          setDashboardError(errMsg);
          return;
        }

        // Only count PAID orders for revenue & avg order value
        const paidOrders = allOrdersData?.filter(o => o.payment_status === 'paid') || [];
        const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalOrders = allOrdersData?.length || 0;
        const paidOrderCount = paidOrders.length;
        const avgOrderValue = paidOrderCount > 0 ? totalRevenue / paidOrderCount : 0;

        // 2. Fetch Customers Count (approximation using orders unique emails if we don't have user metrics access)
        // Since we can't query auth.users directly from client, we'll estimate active customers via orders or just keep it 0 if we can't.
        // Actually, best to just show "Orders" or "Recent Signups" if we had a public profiles table.
        // We'll use unique emails from orders as a proxy for "Customers"
        const uniqueCustomers = new Set(allOrdersData?.map(o => o.email)).size;


        // Process Chart Data (Last 7 Days) - only count PAID orders as revenue
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
        });

        const chartMap = last7Days.reduce((acc: any, date) => {
          acc[date] = 0;
          return acc;
        }, {});

        paidOrders.forEach(order => {
          try {
            const date = new Date(order.created_at).toISOString().split('T')[0];
            if (chartMap[date] !== undefined) {
              chartMap[date] += (order.total || 0);
            }
          } catch {
            // skip bad dates
          }
        });

        const processedChartData = Object.keys(chartMap).map(date => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: chartMap[date]
        }));
        setChartData(processedChartData);

        setStats([
          {
            title: 'Total Revenue',
            value: `$ ${totalRevenue.toFixed(2)}`,
            change: '+0%',
            trend: 'up',
            icon: 'ri-money-dollar-circle-line',
            tone: 'accent',
          },
          {
            title: 'Orders',
            value: totalOrders.toString(),
            change: '+0%',
            trend: 'up',
            icon: 'ri-shopping-bag-line',
            tone: 'primary',
          },
          {
            title: 'Customers (Active)',
            value: uniqueCustomers.toString(),
            change: '+0%',
            trend: 'up',
            icon: 'ri-group-line',
            tone: 'accent',
          },
          {
            title: 'Avg Order Value',
            value: `$ ${avgOrderValue.toFixed(2)}`,
            change: '+0%',
            trend: 'up',
            icon: 'ri-line-chart-line',
            tone: 'primary',
          },
        ]);

        // 3. Fetch Recent Orders (only paid orders)
        const { data: recentOrdersData } = await supabase
          .from('orders')
          .select('id, order_number, user_id, email, created_at, total, status, shipping_address')
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentOrdersData) {
          const formattedRecent = recentOrdersData.map((o: any) => {
            const addr = o.shipping_address || {};
            const customerName = (addr.firstName && addr.lastName)
              ? `${addr.firstName.trim()} ${addr.lastName.trim()}`
              : addr.full_name || addr.firstName || (o.email && o.email.split('@')[0]) || 'Customer';
            return {
              id: o.id,
              displayId: o.order_number,
              customer: customerName,
              email: o.email,
              date: new Date(o.created_at).toLocaleDateString(),
              total: o.total,
              status: o.status,
              items: 1
            };
          });
          setRecentOrders(formattedRecent);
        }

        // 4. Fetch Low Stock Products
        const { data: lowStockData } = await supabase
          .from('products')
          .select('name, quantity')
          .lt('quantity', 10)
          .limit(5);

        if (lowStockData) {
          setLowStockProducts(lowStockData.map((p: any) => ({
            name: p.name,
            stock: p.quantity,
            status: p.quantity === 0 ? 'critical' : 'low'
          })));
        }

        // 5. Fetch Top Products (Approximation: High Price or just Random for now, 
        // real top selling requires aggregation on order_items which is complex for client-side)
        // real top selling requires aggregation on order_items which is complex for client-side)
        const { data: productData } = await supabase.from('products').select('*, product_images(url)').limit(4);
        if (productData) {
          setTopProducts(productData.map((p: any) => ({
            id: p.slug, // Use slug for link
            name: p.name,
            image: p.product_images?.[0]?.url || 'https://via.placeholder.com/200',
            sales: 0, // Mocked for now
            revenue: 0, // Mocked for now
            stock: p.quantity
          })));
        }

      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null && 'message' in error
              ? String((error as { message?: unknown }).message)
              : 'Failed to load dashboard data.';
        setDashboardError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const statusColors: Record<string, string> = {
    pending: 'bg-brand-accent/15 text-brand-accent',
    processing: 'bg-brand-primary/10 text-brand-primary',
    shipped: 'bg-brand-primary/15 text-brand-primary',
    delivered: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const quickActions = [
    {
      title: 'Add Product',
      icon: 'ri-add-line',
      tone: 'accent' as AdminStatTone,
      link: '/admin/products/new',
    },
    {
      title: 'Open POS',
      icon: 'ri-computer-line',
      tone: 'primary' as AdminStatTone,
      link: '/admin/pos',
    },
    {
      title: 'Manage Orders',
      icon: 'ri-file-list-line',
      tone: 'accent' as AdminStatTone,
      link: '/admin/orders',
    },
  ];

  if (loading) {
    return <div className="p-8 text-center text-brand-primary/60">Loading Dashboard...</div>;
  }

  if (dashboardError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="admin-card w-full max-w-md p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <i className="ri-error-warning-line text-2xl" />
          </div>
          <h2 className="mb-2 font-heading text-lg font-semibold text-brand-primary">Error loading dashboard</h2>
          <p className="mb-4 text-sm text-slate-600">{dashboardError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-accent"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
        <div className="mb-5 md:mb-8">
          <h1 className="font-heading text-2xl font-bold text-brand-primary md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 md:text-base">Welcome back! Here&apos;s what&apos;s happening with your store.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:mb-8 md:gap-6 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.title} className="admin-card">
              <div className="mb-2 flex items-center justify-between md:mb-4">
                <div className={stat.tone === 'accent' ? 'admin-stat-icon-accent' : 'admin-stat-icon-primary'}>
                  <i className={`${stat.icon} text-2xl`} />
                </div>
                <span className="text-[11px] font-semibold text-brand-accent md:text-sm">
                  {stat.change}
                </span>
              </div>
              <h3 className="mb-0.5 font-heading text-lg font-bold leading-tight text-brand-primary md:mb-1 md:text-2xl">{stat.value}</h3>
              <p className="text-[11px] leading-snug text-slate-600 md:text-sm">{stat.title}</p>
            </div>
          ))}
        </div>

        {/* Revenue Chart & Quick Actions */}
        <div className="mb-5 grid gap-4 md:mb-8 md:gap-6 lg:grid-cols-3">
          <div className="admin-card lg:col-span-2">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between md:mb-4">
              <h2 className="font-heading text-lg font-bold text-brand-primary md:text-xl">Revenue Trend</h2>
              <select
                className="store-input w-full py-2 text-sm sm:w-auto"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
            <ChartContainer>
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND_ACCENT} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={BRAND_ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(11,31,58,0.06)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={8} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(value) => `$${value}`} width={42} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(11,31,58,0.08)', backdropFilter: 'blur(12px)' }}
                  formatter={(value) => [`$${(value as number)?.toFixed(2) ?? '0.00'}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke={BRAND_ACCENT} strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ChartContainer>
          </div>

          <div className="admin-card">
            <h2 className="mb-3 font-heading text-lg font-bold text-brand-primary md:mb-4 md:text-xl">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-2 md:space-y-3 md:gap-0">
              {quickActions.map((action) => (
                <Link key={action.link} href={action.link} className="admin-quick-action group min-h-[44px]">
                  <div className="flex min-w-0 items-center font-medium">
                    <span className={`mr-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors md:mr-3 ${action.tone === 'accent' ? 'bg-brand-accent/10 text-brand-accent group-hover:bg-brand-accent group-hover:text-white' : 'bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary group-hover:text-white'}`}>
                      <i className={action.icon} />
                    </span>
                    <span className="truncate text-sm md:text-base">{action.title}</span>
                  </div>
                  <i className="ri-arrow-right-s-line shrink-0 text-brand-accent md:hidden" />
                  <i className="ri-arrow-right-line hidden shrink-0 text-brand-accent md:inline" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:mb-8 md:gap-6 lg:grid-cols-3">
          <div className="admin-card overflow-hidden lg:col-span-2">
            <div className="mb-4 flex items-center justify-between md:mb-6">
              <h2 className="font-heading text-lg font-bold text-brand-primary md:text-xl">Recent Orders</h2>
              <Link href="/admin/orders" className="admin-link text-xs whitespace-nowrap md:text-sm">
                View All <i className="ri-arrow-right-line ml-0.5 md:ml-1" />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">No recent orders.</p>
            ) : (
              <>
                {/* Mobile — compact cards */}
                <div className="space-y-2.5 md:hidden">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="block rounded-xl liquid-glass-well p-3 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-brand-primary">{order.displayId}</p>
                          <p className="mt-0.5 truncate text-xs font-medium text-slate-700">{order.customer}</p>
                          <p className="text-[11px] text-slate-500">{order.date}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-brand-primary">$ {order.total.toFixed(2)}</p>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[order.status] || 'bg-slate-100 text-slate-700'}`}>
                            {order.status === 'shipped' ? 'Packaged' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Desktop — table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead className="border-b border-white/50 bg-brand-primary/[0.04]">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-brand-primary">Order ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-brand-primary">Customer</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-brand-primary">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-brand-primary">Total</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-brand-primary">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="border-b border-white/40 transition-colors hover:bg-brand-primary/[0.03]">
                          <td className="px-4 py-4">
                            <Link href={`/admin/orders/${order.id}`} className="admin-link whitespace-nowrap font-medium">
                              {order.displayId}
                            </Link>
                          </td>
                          <td className="px-4 py-4">
                            <p className="whitespace-nowrap font-medium text-brand-primary">{order.customer}</p>
                            <p className="text-sm text-slate-500">{order.email}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-slate-700">{order.date}</td>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold text-brand-primary">$ {order.total.toFixed(2)}</td>
                          <td className="px-4 py-4">
                            <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${statusColors[order.status] || 'bg-slate-100 text-slate-700'}`}>
                              {order.status === 'shipped' ? 'Packaged' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4 md:space-y-6">
            <div className="admin-card">
              <h2 className="mb-3 font-heading text-lg font-bold text-brand-primary md:mb-4 md:text-xl">Low Stock Alert</h2>
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-slate-500">Inventory looks good!</p>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {lowStockProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 rounded-xl liquid-glass-well p-2.5 md:p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-brand-primary md:text-sm">{product.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600 md:text-xs">Stock: {product.stock}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold md:text-xs ${product.status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-brand-accent/15 text-brand-accent'}`}>
                        {product.status === 'critical' ? 'Critical' : 'Low'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/admin/products?filter=low-stock" className="admin-link mt-3 block text-center text-xs whitespace-nowrap md:mt-4 md:text-sm">
                View All Products <i className="ri-arrow-right-line ml-0.5 md:ml-1" />
              </Link>
            </div>
          </div>
        </div>

        <div className="admin-card overflow-hidden">
          <div className="mb-4 flex items-center justify-between md:mb-6">
            <h2 className="font-heading text-lg font-bold text-brand-primary md:text-xl">Products</h2>
            <Link href="/admin/products" className="admin-link text-xs whitespace-nowrap md:text-sm">
              View All <i className="ri-arrow-right-line ml-0.5 md:ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
            {topProducts.map((product) => (
              <div key={product.id} className="admin-product-tile liquid-glass-card overflow-hidden transition-shadow hover:shadow-[0_12px_32px_rgba(11,31,58,0.08)] md:p-4">
                <div className="mb-2 aspect-square overflow-hidden rounded-lg liquid-glass-well md:mb-3">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                </div>
                <h3 className="line-clamp-2 text-[11px] font-semibold leading-snug text-brand-primary md:mb-2 md:text-base">{product.name}</h3>
                <div className="mt-2 flex items-center justify-between gap-1 border-t border-white/50 pt-2 md:mt-3 md:pt-3">
                  <span className="text-[10px] text-slate-600 md:text-sm">Stock: {product.stock}</span>
                  <Link href={`/admin/products/${product.id}`} className="admin-link text-[10px] font-semibold whitespace-nowrap md:text-sm">
                    Edit <i className="ri-arrow-right-line ml-0.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
}
