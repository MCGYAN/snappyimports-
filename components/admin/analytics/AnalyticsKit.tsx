'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { canAccessAdminPath } from '@/lib/admin-permissions';
import {
  ANALYTICS_MAX_MONTHS,
  ANALYTICS_PAGE_SIZE,
  RANGE_PRESETS,
  daysAgoIsoDay,
  isoDay,
  validateAnalyticsRange,
} from '@/lib/analytics-range';

export function formatDay(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMoney(amount: number | null | undefined, currency = 'GHS') {
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
      Number(amount) || 0,
    );
  } catch {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in again.');
  return { Authorization: `Bearer ${session.access_token}` };
}

/* ------------------------------------------------------------------ tabs */

const TABS = [
  { path: '/admin/analytics', label: 'Shop orders', icon: 'ri-shopping-bag-3-line' },
  { path: '/admin/analytics/rmb', label: 'Buy RMB', icon: 'ri-exchange-cny-line' },
  { path: '/admin/analytics/shipping', label: 'Shipping', icon: 'ri-ship-2-line' },
];

function AnalyticsTabs() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('role, admin_permissions')
        .eq('id', session.user.id)
        .single();
      if (cancelled) return;
      setAllowed(
        TABS.filter((tab) => canAccessAdminPath(data?.role, data?.admin_permissions, tab.path)).map(
          (tab) => tab.path,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = allowed ? TABS.filter((tab) => allowed.includes(tab.path)) : TABS;

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
      {visible.map((tab) => {
        const active = pathname === tab.path;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              active ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className={`${tab.icon} text-base`} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AnalyticsShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Analytics</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
          </div>
          <AnalyticsTabs />
        </header>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- toolbar */

export type ChipOption = { value: string; label: string };

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === option.value
              ? 'border-brand-primary bg-brand-primary text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsToolbar({
  query,
  searchPlaceholder,
  filters,
  onExport,
  exporting,
}: {
  query: AnalyticsQueryState;
  searchPlaceholder: string;
  filters?: ReactNode;
  onExport: () => void;
  exporting: boolean;
}) {
  const [preset, setPreset] = useState('30d');

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ChipGroup
          options={[...RANGE_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'custom', label: 'Custom' }]}
          value={preset}
          onChange={(id) => {
            setPreset(id);
            const found = RANGE_PRESETS.find((p) => p.id === id);
            if (found) query.setRange(found.range());
          }}
        />
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={query.from}
            max={query.to}
            onChange={(e) => {
              setPreset('custom');
              query.setRange({ from: e.target.value, to: query.to });
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-700"
            aria-label="Start date"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={query.to}
            min={query.from}
            onChange={(e) => {
              setPreset('custom');
              query.setRange({ from: query.from, to: e.target.value });
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-700"
            aria-label="End date"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query.search}
            onChange={(e) => query.setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-accent focus:outline-none"
          />
        </div>
        {filters}
        <button
          type="button"
          onClick={onExport}
          disabled={exporting || Boolean(query.rangeError)}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-accent disabled:opacity-50"
        >
          <i className="ri-file-excel-2-line" />
          {exporting ? 'Preparing…' : 'Export spreadsheet'}
        </button>
      </div>

      {query.rangeError ? (
        <p className="text-xs font-medium text-red-600">{query.rangeError}</p>
      ) : (
        <p className="text-xs text-slate-400">
          Up to {ANALYTICS_MAX_MONTHS} months per view or download. Export includes everything that matches your filters.
        </p>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- stats */

export function StatGrid({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</section>;
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ----------------------------------------------------------------- table */

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  total,
  page,
  onPage,
  emptyText,
}: {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  total: number;
  page: number;
  onPage: (page: number) => void;
  emptyText: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / ANALYTICS_PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * ANALYTICS_PAGE_SIZE + 1;
  const last = Math.min(total, page * ANALYTICS_PAGE_SIZE);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 font-semibold ${column.className || ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-50' : ''}>
            {loading && rows.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-t border-slate-100">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-4">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-slate-500">
                  <i className="ri-inbox-line mb-2 block text-3xl text-slate-300" />
                  {emptyText}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 align-top transition-colors hover:bg-slate-50/60">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 ${column.className || ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
        <p className="text-slate-500">
          {total === 0 ? 'No results' : `Showing ${first} to ${last} of ${total.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
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
            onClick={() => onPage(page + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
            aria-label="Next page"
          >
            <i className="ri-arrow-right-s-line" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** Ordered, paid, packaged style journey for a row. */
export function Journey({ steps }: { steps: { label: string; at: string | null | undefined }[] }) {
  return (
    <ol className="space-y-1">
      {steps.map((step) => (
        <li key={step.label} className="flex items-center gap-2 text-xs">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${step.at ? 'bg-brand-accent' : 'bg-slate-300'}`} />
          <span className="w-16 text-slate-500">{step.label}</span>
          <span className={step.at ? 'font-medium text-slate-800' : 'text-slate-400'}>
            {step.at ? formatDay(step.at) : 'Not yet'}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Pill({ tone = 'slate', children }: { tone?: 'slate' | 'green' | 'amber' | 'blue'; children: ReactNode }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-sky-50 text-sky-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ data */

export type AnalyticsQueryState = {
  from: string;
  to: string;
  search: string;
  filter: string;
  page: number;
  rangeError: string | null;
  setRange: (range: { from: string; to: string }) => void;
  setSearch: (value: string) => void;
  setFilter: (value: string) => void;
  setPage: (value: number) => void;
};

export function useAnalyticsData<T>({
  endpoint,
  filterParam,
  rowsKey = 'rows',
}: {
  endpoint: string;
  filterParam: 'stage' | 'status';
  rowsKey?: string;
}) {
  const [from, setFrom] = useState(() => daysAgoIsoDay(29));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilterValue] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const rangeError = validateAnalyticsRange(from, to);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const buildParams = useCallback(
    (extra: Record<string, string>) => {
      const params = new URLSearchParams({ from, to, [filterParam]: filter, ...extra });
      if (debouncedSearch) params.set('q', debouncedSearch);
      return params;
    },
    [debouncedSearch, filter, filterParam, from, to],
  );

  useEffect(() => {
    if (rangeError) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(
          `${endpoint}?${buildParams({ page: String(page), pageSize: String(ANALYTICS_PAGE_SIZE) })}`,
          { headers: await authHeaders() },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load analytics.');
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParams, endpoint, page, rangeError, reloadKey]);

  const fetchAllForExport = useCallback(async (): Promise<{ rows: T[]; capped: boolean }> => {
    setExporting(true);
    try {
      const res = await fetch(`${endpoint}?${buildParams({ export: '1' })}`, { headers: await authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not export.');
      return { rows: (json[rowsKey] || []) as T[], capped: Boolean(json.export_capped) };
    } finally {
      setExporting(false);
    }
  }, [buildParams, endpoint, rowsKey]);

  const query: AnalyticsQueryState = useMemo(
    () => ({
      from,
      to,
      search,
      filter,
      page,
      rangeError,
      setRange: (range) => {
        setFrom(range.from);
        setTo(range.to);
        setPage(1);
      },
      setSearch: setSearchValue,
      setFilter: (value) => {
        setFilterValue(value);
        setPage(1);
      },
      setPage,
    }),
    [filter, from, page, rangeError, search, to],
  );

  return {
    query,
    data,
    rows: ((data?.[rowsKey] as T[]) || []) as T[],
    total: Number(data?.total) || 0,
    loading,
    exporting,
    error,
    setError,
    reload: () => setReloadKey((k) => k + 1),
    fetchAllForExport,
  };
}

export function rangeFileLabel(query: AnalyticsQueryState) {
  return `${query.from}_to_${query.to}`;
}
