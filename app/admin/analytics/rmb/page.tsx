'use client';

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
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

type RmbRow = {
  id: string;
  exchange_number: string;
  customer_name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  rate: number;
  amount_from: number;
  currency_from: string | null;
  amount_to: number;
  currency_to: string | null;
  status: string;
  created_at: string;
  payment_sent_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
};

const STAGES = [
  { value: 'all', label: 'All paid' },
  { value: 'confirmed', label: 'Awaiting RMB delivery' },
  { value: 'completed', label: 'Completed' },
];

function formatRmb(amount: number | null | undefined) {
  return `¥${(Number(amount) || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
}

export default function RmbAnalyticsPage() {
  const { query, data, rows, total, loading, exporting, error, setError, fetchAllForExport } =
    useAnalyticsData<RmbRow>({ endpoint: '/api/admin/analytics/rmb', filterParam: 'stage' });

  const summary = data?.summary || {};
  const byCurrency: { currency: string; orders: number; amount_from: number; amount_to: number }[] =
    data?.by_currency || [];
  const daily = (data?.daily || []).map((d: any) => ({
    label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    rmb: Number(d.rmb) || 0,
  }));

  const handleExport = async () => {
    try {
      const { rows: all, capped } = await fetchAllForExport();
      if (!all.length) {
        alert('No paid RMB orders match these filters.');
        return;
      }
      downloadCsv(`rmb-orders-${rangeFileLabel(query)}.csv`, [
        [
          'Exchange number',
          'Customer name',
          'Business',
          'Email',
          'Phone',
          'Country',
          'Amount paid',
          'Currency',
          'RMB',
          'Rate',
          'Date ordered',
          'Payment sent',
          'Date paid',
          'Date completed',
          'Status',
        ],
        ...all.map((row) => [
          row.exchange_number,
          row.customer_name,
          row.business_name || '',
          row.email || '',
          row.phone || '',
          row.country_code || '',
          Number(row.amount_from || 0).toFixed(2),
          row.currency_from || 'GHS',
          Number(row.amount_to || 0).toFixed(2),
          row.rate,
          formatDay(row.created_at),
          formatDay(row.payment_sent_at),
          formatDay(row.paid_at),
          formatDay(row.completed_at),
          row.status === 'completed' ? 'Completed' : 'Awaiting RMB delivery',
        ]),
      ]);
      if (capped) alert('Export limited to the first 5,000 orders. Narrow the dates to download the rest.');
    } catch (err: any) {
      setError(err.message || 'Could not export.');
    }
  };

  const columns: Column<RmbRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.exchange_number}</p>
          <p className="text-xs text-slate-500">{row.country_code || 'GH'}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="min-w-[10rem]">
          <p className="font-medium text-slate-900">{row.customer_name}</p>
          {row.business_name ? <p className="text-xs text-slate-500">{row.business_name}</p> : null}
          <p className="text-xs text-slate-500">{row.email || row.phone}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Exchange',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{formatRmb(row.amount_to)}</p>
          <p className="text-xs text-slate-500">
            {formatMoney(row.amount_from, row.currency_from || 'GHS')} at {row.rate}
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
            { label: 'Delivered', at: row.completed_at },
          ]}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.status === 'completed' ? <Pill tone="green">Completed</Pill> : <Pill tone="amber">Awaiting RMB delivery</Pill>,
    },
  ];

  return (
    <AnalyticsShell
      title="Buy RMB"
      description="Paid RMB orders with customer, amounts, rate and every key date. Unpaid requests are left out."
    >
      <AnalyticsToolbar
        query={query}
        searchPlaceholder="Search exchange number, customer, business, email or phone"
        filters={<ChipGroup options={STAGES} value={query.filter} onChange={query.setFilter} />}
        onExport={() => void handleExport()}
        exporting={exporting}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <StatGrid>
        <StatCard label="RMB sent" value={formatRmb(summary.rmb_total)} hint="Paid orders in range" />
        <StatCard label="Paid orders" value={Number(summary.orders || 0).toLocaleString()} />
        <StatCard label="Customers" value={Number(summary.customers || 0).toLocaleString()} />
        <StatCard
          label="Awaiting delivery"
          value={Number(summary.awaiting_delivery || 0).toLocaleString()}
          hint={`${Number(summary.completed || 0).toLocaleString()} completed`}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="RMB volume by payment date">
            <ChartContainer className="h-56 w-full min-w-0">
              <BarChart data={daily.length ? daily : [{ label: '', rmb: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  formatter={(value) => [formatRmb(Number(value)), 'RMB']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="rmb" fill="#0B1F3A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Panel>
        </div>
        <Panel title="Money received">
          {byCurrency.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No paid RMB orders in this range.</p>
          ) : (
            <ul className="space-y-3">
              {byCurrency.map((row) => (
                <li key={row.currency} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{row.currency}</p>
                    <p className="text-xs text-slate-500">
                      {row.orders} order{Number(row.orders) === 1 ? '' : 's'}. {formatRmb(row.amount_to)}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900">{formatMoney(row.amount_from, row.currency)}</span>
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
        emptyText="No paid RMB orders in this range."
      />
    </AnalyticsShell>
  );
}
