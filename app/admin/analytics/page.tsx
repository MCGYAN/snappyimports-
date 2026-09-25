'use client';

import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import ChartContainer from '@/components/admin/ChartContainer';
import { downloadCsv } from '@/lib/csv-download';
import {
  AnalyticsShell,
  AnalyticsToolbar,
  ChipGroup,
  DataTable,
  Journey,
  Panel,
  Pill,
  StatCard,
  StatGrid,
  formatDay,
  formatMoney,
  rangeFileLabel,
  useAnalyticsData,
  type Column,
} from '@/components/admin/analytics/AnalyticsKit';

type ShopRow = {
  id: string;
  order_number: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  items_summary: string | null;
  item_count: number;
  total: number;
  currency: string | null;
  payment_method: string | null;
  created_at: string;
  paid_at: string | null;
  packaged_at: string | null;
  package_tracking: string | null;
};

const STAGES = [
  { value: 'all', label: 'All paid' },
  { value: 'awaiting_packaging', label: 'Awaiting packaging' },
  { value: 'packaged', label: 'Packaged' },
];

function paymentLabel(value: string | null) {
  const raw = String(value || '').replace(/_/g, ' ').trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Payment';
}

export default function ShopAnalyticsPage() {
  const { query, data, rows, total, loading, exporting, error, setError, fetchAllForExport } =
    useAnalyticsData<ShopRow>({ endpoint: '/api/admin/analytics/shop', filterParam: 'stage' });

  const summary = data?.summary || {};
  const daily = (data?.daily || []).map((d: any) => ({
    label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    revenue: Number(d.revenue) || 0,
    orders: Number(d.orders) || 0,
  }));
  const topProducts: { name: string; units: number; revenue: number }[] = data?.top_products || [];

  const handleExport = async () => {
    try {
      const { rows: all, capped } = await fetchAllForExport();
      if (!all.length) {
        alert('No paid orders match these filters.');
        return;
      }
      downloadCsv(`shop-orders-${rangeFileLabel(query)}.csv`, [
        [
          'Order number',
          'Customer name',
          'Email',
          'Phone',
          'Items',
          'Item count',
          'Total',
          'Currency',
          'Payment method',
          'Date ordered',
          'Date paid',
          'Date packaged',
          'Package tracking',
          'Stage',
        ],
        ...all.map((row) => [
          row.order_number,
          row.customer_name,
          row.email || '',
          row.phone || '',
          row.items_summary || '',
          row.item_count,
          Number(row.total || 0).toFixed(2),
          row.currency || 'GHS',
          paymentLabel(row.payment_method),
          formatDay(row.created_at),
          formatDay(row.paid_at),
          formatDay(row.packaged_at),
          row.package_tracking || '',
          row.packaged_at ? 'Packaged. Continues in Shipping analytics' : 'Awaiting packaging',
        ]),
      ]);
      if (capped) alert('Export limited to the first 5,000 orders. Narrow the dates to download the rest.');
    } catch (err: any) {
      setError(err.message || 'Could not export.');
    }
  };

  const columns: Column<ShopRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (row) => (
        <div>
          <Link href={`/admin/orders/${row.id}`} className="font-semibold text-slate-900 hover:text-brand-accent">
            {row.order_number}
          </Link>
          <p className="text-xs text-slate-500">{paymentLabel(row.payment_method)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="min-w-[10rem]">
          <p className="font-medium text-slate-900">{row.customer_name}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
          {row.phone ? <p className="text-xs text-slate-500">{row.phone}</p> : null}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <div className="max-w-[16rem]">
          <p className="line-clamp-2 text-slate-700" title={row.items_summary || ''}>
            {row.items_summary || 'No items'}
          </p>
          <p className="text-xs text-slate-500">
            {row.item_count} unit{row.item_count === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    {
      key: 'journey',
      header: 'Journey',
      render: (row) => (
        <Journey
          steps={[
            { label: 'Ordered', at: row.created_at },
            { label: 'Paid', at: row.paid_at },
            { label: 'Packaged', at: row.packaged_at },
          ]}
        />
      ),
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-right',
      render: (row) => (
        <span className="font-semibold text-slate-900">{formatMoney(row.total, row.currency || 'GHS')}</span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (row) =>
        row.packaged_at ? (
          <div>
            <Pill tone="green">Packaged</Pill>
            {row.package_tracking ? (
              <Link
                href="/admin/analytics/shipping"
                className="mt-1 block font-mono text-[11px] text-slate-500 hover:text-brand-accent"
              >
                {row.package_tracking}
              </Link>
            ) : null}
          </div>
        ) : (
          <Pill tone="amber">Awaiting packaging</Pill>
        ),
    },
  ];

  return (
    <AnalyticsShell
      title="Shop orders"
      description="Paid website orders from payment to packaging. Once packaged, each order continues in Shipping analytics."
    >
      <AnalyticsToolbar
        query={query}
        searchPlaceholder="Search order number, customer, phone, product or package"
        filters={<ChipGroup options={STAGES} value={query.filter} onChange={query.setFilter} />}
        onExport={() => void handleExport()}
        exporting={exporting}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <StatGrid>
        <StatCard label="Revenue" value={formatMoney(summary.revenue)} hint="Paid orders in range" />
        <StatCard
          label="Paid orders"
          value={Number(summary.orders || 0).toLocaleString()}
          hint={`${Number(summary.items || 0).toLocaleString()} units sold`}
        />
        <StatCard label="Average order" value={formatMoney(summary.aov)} />
        <StatCard
          label="Awaiting packaging"
          value={Number(summary.awaiting_packaging || 0).toLocaleString()}
          hint={`${Number(summary.packaged || 0).toLocaleString()} already packaged`}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Revenue by payment date">
            <ChartContainer className="h-56 w-full min-w-0">
              <AreaChart data={daily.length ? daily : [{ label: '', revenue: 0 }]}>
                <defs>
                  <linearGradient id="shopRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F26B1D" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F26B1D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value)), 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#F26B1D" strokeWidth={2} fill="url(#shopRevenue)" />
              </AreaChart>
            </ChartContainer>
          </Panel>
        </div>
        <Panel title="Top products">
          {topProducts.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No product sales in this range.</p>
          ) : (
            <ul className="space-y-3">
              {topProducts.map((product, index) => (
                <li key={`${product.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.units} sold</p>
                    </div>
                  </div>
                  <span className="whitespace-nowrap font-semibold text-slate-900">{formatMoney(product.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        total={total}
        page={query.page}
        onPage={query.setPage}
        emptyText="No paid orders in this range. Unpaid orders appear here once payment is confirmed."
      />
    </AnalyticsShell>
  );
}
