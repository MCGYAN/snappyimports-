'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { downloadCsv } from '@/lib/csv-download';
import { SHIPPING_STATUS_LABELS, type ShippingPackageStatus } from '@/lib/shipping';
import {
  AnalyticsShell,
  ChipGroup,
  Pill,
  StatCard,
  StatGrid,
  authHeaders,
  formatDay,
  formatMoney,
} from '@/components/admin/analytics/AnalyticsKit';

const PAGE_SIZE = 25;

type InsightRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_guest: boolean;
  shop_orders: number;
  shop_ghs: number;
  rmb_orders: number;
  rmb_ghs: number;
  rmb_total: number;
  has_foreign_rmb: boolean;
  shipping_bills_paid: number;
  shipping_ghs: number;
  packages: number;
  packages_in_transit: number;
  packages_ready: number;
  bill_due: boolean;
  first_paid_at: string | null;
  last_paid_at: string | null;
  total_ghs: number;
  services_count: number;
  paid_transactions: number;
  is_vip: boolean;
  is_multi: boolean;
  is_cross_sell: boolean;
  is_at_risk: boolean;
  is_new: boolean;
};

type TimelineEvent = {
  service: 'shop' | 'rmb' | 'shipping';
  paid: boolean;
  ghs: number;
  rmb: number;
  foreign_paid: boolean;
  at: string | null;
  bill_due: boolean;
  package_status: string | null;
  ref: string | null;
  entity_id: string;
};

const SERVICE_META = {
  shop: { label: 'Shop', icon: 'ri-shopping-bag-3-line', bar: 'bg-brand-accent', dot: 'text-brand-accent' },
  rmb: { label: 'Buy RMB', icon: 'ri-exchange-cny-line', bar: 'bg-sky-500', dot: 'text-sky-600' },
  shipping: { label: 'Shipping', icon: 'ri-ship-2-line', bar: 'bg-brand-primary', dot: 'text-brand-primary' },
} as const;

function formatRmb(amount: number) {
  return `¥${(Number(amount) || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'C'
  );
}

function servicesUsed(row: InsightRow) {
  return (['shop', 'rmb', 'shipping'] as const).filter((service) =>
    service === 'shop' ? row.shop_orders > 0 : service === 'rmb' ? row.rmb_orders > 0 : row.shipping_bills_paid > 0,
  );
}

function ValueBar({ row }: { row: InsightRow }) {
  const total = Number(row.shop_ghs) + Number(row.rmb_ghs) + Number(row.shipping_ghs);
  if (total <= 0) return <div className="h-1.5 rounded-full bg-slate-100" />;
  const parts = [
    { key: 'shop', value: Number(row.shop_ghs) },
    { key: 'rmb', value: Number(row.rmb_ghs) },
    { key: 'shipping', value: Number(row.shipping_ghs) },
  ] as const;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
      {parts.map((part) =>
        part.value > 0 ? (
          <span
            key={part.key}
            className={SERVICE_META[part.key].bar}
            style={{ width: `${(part.value / total) * 100}%` }}
            title={`${SERVICE_META[part.key].label}: ${formatMoney(part.value)}`}
          />
        ) : null,
      )}
    </div>
  );
}

function RowTags({ row }: { row: InsightRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.is_vip ? <Pill tone="amber">VIP</Pill> : null}
      {row.is_new ? <Pill tone="blue">New</Pill> : null}
      {row.is_at_risk ? <Pill tone="slate">At risk</Pill> : null}
      {row.bill_due ? <Pill tone="amber">Shipping bill due</Pill> : null}
      {row.packages_ready > 0 ? <Pill tone="green">{row.packages_ready} ready for pickup</Pill> : null}
      {row.packages_in_transit > 0 ? <Pill tone="blue">{row.packages_in_transit} in transit</Pill> : null}
    </div>
  );
}

function eventLink(event: TimelineEvent) {
  if (event.service === 'shop') return `/admin/orders/${event.entity_id}`;
  if (event.service === 'rmb' && event.ref) return `/admin/exchange/${encodeURIComponent(event.ref)}`;
  return '/admin/shipping';
}

function eventTitle(event: TimelineEvent) {
  if (event.service === 'shop') return `Shop order ${event.ref || ''}`;
  if (event.service === 'rmb') return `RMB order ${event.ref || ''}`;
  return `Package ${event.ref || ''}`;
}

function eventDetail(event: TimelineEvent) {
  if (event.service === 'shop') return `Paid ${formatMoney(event.ghs)}`;
  if (event.service === 'rmb') {
    return event.foreign_paid ? `${formatRmb(event.rmb)} bought` : `${formatRmb(event.rmb)} for ${formatMoney(event.ghs)}`;
  }
  const status = event.package_status
    ? SHIPPING_STATUS_LABELS[event.package_status as ShippingPackageStatus] || event.package_status
    : 'Package';
  if (event.paid) return `${status}. Shipping paid ${formatMoney(event.ghs)}`;
  if (event.bill_due) return `${status}. Shipping bill due`;
  return status;
}

function CustomerDrawer({ customer, onClose }: { customer: InsightRow; onClose: () => void }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError('');
    (async () => {
      try {
        const res = await fetch(`/api/admin/customer-insights/timeline?key=${encodeURIComponent(customer.id)}`, {
          headers: await authHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load timeline.');
        if (!cancelled) setEvents(json.events || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load timeline.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tiles = [
    { service: 'shop' as const, value: formatMoney(customer.shop_ghs), hint: `${customer.shop_orders} paid order${customer.shop_orders === 1 ? '' : 's'}` },
    {
      service: 'rmb' as const,
      value: formatRmb(customer.rmb_total),
      hint: `${customer.rmb_orders} order${customer.rmb_orders === 1 ? '' : 's'}${customer.rmb_ghs > 0 ? `. ${formatMoney(customer.rmb_ghs)}` : ''}`,
    },
    {
      service: 'shipping' as const,
      value: formatMoney(customer.shipping_ghs),
      hint: `${customer.packages} package${customer.packages === 1 ? '' : 's'}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
              {initials(customer.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-900">{customer.name}</p>
              <p className="truncate text-xs text-slate-500">{customer.email}</p>
              {customer.phone ? <p className="text-xs text-slate-500">{customer.phone}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lifetime paid value</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{formatMoney(customer.total_ghs)}</p>
            <div className="mt-3">
              <ValueBar row={customer} />
            </div>
            <div className="mt-3">
              <RowTags row={customer} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {tiles.map((tile) => (
              <div key={tile.service} className="rounded-xl border border-slate-200 p-3">
                <p className={`flex items-center gap-1 text-[11px] font-semibold ${SERVICE_META[tile.service].dot}`}>
                  <i className={SERVICE_META[tile.service].icon} />
                  {SERVICE_META[tile.service].label}
                </p>
                <p className="mt-1 truncate text-sm font-bold text-slate-900">{tile.value}</p>
                <p className="truncate text-[11px] text-slate-500">{tile.hint}</p>
              </div>
            ))}
          </div>

          {customer.has_foreign_rmb ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Some RMB orders were paid in other currencies. They are counted in RMB bought, not in the cedi total.
            </p>
          ) : null}

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Timeline</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {!events && !error ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : null}
            {events && events.length === 0 ? <p className="text-sm text-slate-400">No activity yet.</p> : null}
            {events && events.length > 0 ? (
              <ol className="relative space-y-1 border-l border-slate-200 pl-4">
                {events.map((event) => (
                  <li key={`${event.service}-${event.entity_id}`} className="relative">
                    <span className="absolute -left-[21px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-300" />
                    <Link
                      href={eventLink(event)}
                      className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
                          <i className={`${SERVICE_META[event.service].icon} ${SERVICE_META[event.service].dot}`} />
                          {eventTitle(event)}
                        </p>
                        <p className="text-xs text-slate-500">{eventDetail(event)}</p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-slate-400">{formatDay(event.at)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function CustomerInsightsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [service, setService] = useState('all');
  const [sort, setSort] = useState('value');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<InsightRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const buildParams = useCallback(
    (extra: Record<string, string>) => {
      const params = new URLSearchParams({ segment, service, sort, ...extra });
      if (debouncedSearch) params.set('q', debouncedSearch);
      return params;
    },
    [debouncedSearch, segment, service, sort],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(
          `/api/admin/customer-insights?${buildParams({ page: String(page), pageSize: String(PAGE_SIZE) })}`,
          { headers: await authHeaders() },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load customer insights.');
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load customer insights.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParams, page]);

  const rows: InsightRow[] = data?.rows || [];
  const total = Number(data?.total) || 0;
  const summary = data?.summary || {};
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const count = (key: string) => Number(summary[key] || 0);

  const segments = [
    { value: 'all', label: `All ${count('customers')}` },
    { value: 'vip', label: `VIP ${count('vip')}` },
    { value: 'multi', label: `Multi-service ${count('multi')}` },
    { value: 'cross_sell', label: 'Cross-sell' },
    { value: 'new', label: `New ${count('new')}` },
    { value: 'at_risk', label: `At risk ${count('at_risk')}` },
    { value: 'bill_due', label: `Bill due ${count('bill_due')}` },
  ];

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetch(`/api/admin/customer-insights?${buildParams({ export: '1' })}`, {
        headers: await authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not export.');
      const all: InsightRow[] = json.rows || [];
      if (!all.length) {
        alert('No customers match these filters.');
        return;
      }
      downloadCsv(`customer-insights-${new Date().toISOString().slice(0, 10)}.csv`, [
        [
          'Name',
          'Email',
          'Phone',
          'Account',
          'Services used',
          'Lifetime paid (GHS)',
          'Shop orders',
          'Shop paid (GHS)',
          'RMB orders',
          'RMB bought',
          'RMB paid (GHS)',
          'Shipping bills paid',
          'Shipping paid (GHS)',
          'Packages',
          'In transit',
          'Ready for pickup',
          'Shipping bill due',
          'First paid',
          'Last paid',
          'Segments',
        ],
        ...all.map((row) => [
          row.name,
          row.email || '',
          row.phone || '',
          row.is_guest ? 'Guest' : 'Account',
          servicesUsed(row).map((s) => SERVICE_META[s].label).join(', '),
          Number(row.total_ghs).toFixed(2),
          row.shop_orders,
          Number(row.shop_ghs).toFixed(2),
          row.rmb_orders,
          Number(row.rmb_total).toFixed(2),
          Number(row.rmb_ghs).toFixed(2),
          row.shipping_bills_paid,
          Number(row.shipping_ghs).toFixed(2),
          row.packages,
          row.packages_in_transit,
          row.packages_ready,
          row.bill_due ? 'Yes' : 'No',
          formatDay(row.first_paid_at),
          formatDay(row.last_paid_at),
          [
            row.is_vip && 'VIP',
            row.is_multi && 'Multi-service',
            row.is_new && 'New',
            row.is_at_risk && 'At risk',
          ]
            .filter(Boolean)
            .join(', '),
        ]),
      ]);
      if (json.export_capped) alert('Export limited to the first 5,000 customers.');
    } catch (err: any) {
      setError(err.message || 'Could not export.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnalyticsShell
      eyebrow="Customers"
      title="Customer Insights"
      description="Everyone who has paid for a shop order, Buy RMB or a shipping bill, with their value across all three services."
      aside={
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-accent disabled:opacity-50"
        >
          <i className="ri-file-excel-2-line" />
          {exporting ? 'Preparing…' : 'Export spreadsheet'}
        </button>
      }
    >
      <StatGrid>
        <StatCard
          label="Paying customers"
          value={count('customers').toLocaleString()}
          hint={`Shop ${count('shop')}. RMB ${count('rmb')}. Shipping ${count('shipping')}`}
        />
        <StatCard label="Lifetime paid value" value={formatMoney(summary.total_ghs)} />
        <StatCard label="Average per customer" value={formatMoney(summary.avg_ghs)} />
        <StatCard
          label="Multi-service"
          value={count('multi').toLocaleString()}
          hint={`${count('vip')} VIP from ${formatMoney(summary.vip_threshold || 10000)}`}
        />
      </StatGrid>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-accent focus:outline-none"
            />
          </div>
          <select
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700"
            aria-label="Service"
          >
            <option value="all">All services</option>
            <option value="shop">Shop</option>
            <option value="rmb">Buy RMB</option>
            <option value="shipping">Shipping</option>
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700"
            aria-label="Sort"
          >
            <option value="value">Highest value</option>
            <option value="recent">Most recent</option>
            <option value="activity">Most transactions</option>
          </select>
        </div>
        <ChipGroup
          options={segments}
          value={segment}
          onChange={(value) => {
            setSegment(value);
            setPage(1);
          }}
        />
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`divide-y divide-slate-100 ${loading ? 'opacity-50' : ''}`}>
          {loading && rows.length === 0
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))
            : null}
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-14 text-center text-sm text-slate-500">
              <i className="ri-user-search-line mb-2 block text-3xl text-slate-300" />
              No paying customers match these filters.
            </div>
          ) : null}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="grid w-full gap-4 p-4 text-left transition-colors hover:bg-slate-50/70 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-sm font-bold text-brand-primary">
                  {initials(row.name)}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-semibold text-slate-900">
                    {row.name}
                    {row.is_guest ? <span className="text-[10px] font-medium text-slate-400">Guest</span> : null}
                  </p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                    {row.email ? <span className="truncate">{row.email}</span> : null}
                    {row.phone ? <span>{row.phone}</span> : null}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {servicesUsed(row).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      <i className={`${SERVICE_META[s].icon} ${SERVICE_META[s].dot}`} />
                      {SERVICE_META[s].label}
                    </span>
                  ))}
                </div>
                <RowTags row={row} />
              </div>

              <div>
                <p className="text-lg font-bold text-slate-900">{formatMoney(row.total_ghs)}</p>
                <div className="mt-1.5 w-full max-w-[12rem]">
                  <ValueBar row={row} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {row.paid_transactions} paid transaction{row.paid_transactions === 1 ? '' : 's'}
                </p>
              </div>

              <div className="text-xs text-slate-500 md:text-right">
                <p>Last paid</p>
                <p className="font-medium text-slate-800">{formatDay(row.last_paid_at)}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            {(['shop', 'rmb', 'shipping'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${SERVICE_META[s].bar}`} />
                {SERVICE_META[s].label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-40"
              aria-label="Previous page"
            >
              <i className="ri-arrow-left-s-line" />
            </button>
            <span className="text-slate-500">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-40"
              aria-label="Next page"
            >
              <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        </div>
      </section>

      {selected ? <CustomerDrawer customer={selected} onClose={() => setSelected(null)} /> : null}
    </AnalyticsShell>
  );
}
