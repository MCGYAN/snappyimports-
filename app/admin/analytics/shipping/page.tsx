'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { downloadCsv } from '@/lib/csv-download';
import {
  SHIPPING_STATUS,
  SHIPPING_STATUS_LABELS,
  shippingClassShortLabel,
  type ShippingPackageStatus,
} from '@/lib/shipping';

type PackageRow = {
  id: string;
  tracking_id: string | null;
  carrier_reference: string | null;
  package_name: string | null;
  goods_class: string | null;
  cbm: number | null;
  status: string | null;
  shipping_payment_status: string | null;
  estimated_shipping_usd: number | null;
  estimated_shipping_ghs: number | null;
  final_shipping_ghs: number | null;
  freight_included: boolean | null;
  customer_email: string | null;
  customer_name: string | null;
  warehouse_received_at: string | null;
  effective_received_at: string | null;
  loaded_at: string | null;
  estimated_arrival_at: string | null;
  arrived_at: string | null;
  shipping_paid_at: string | null;
  created_at: string | null;
};

type Summary = {
  packages: number;
  received: number;
  in_transit: number;
  arrived: number;
  ready: number;
  paid: number;
  cbm_total: number;
  freight_usd: number;
  freight_ghs: number;
};

const PAGE_SIZE = 50;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthsAgoIsoDate(months: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
}

function formatMoney(amount: number, currency: 'GHS' | 'USD') {
  return new Intl.NumberFormat(currency === 'GHS' ? 'en-GH' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in again.');
  return { Authorization: `Bearer ${session.access_token}` };
}

export default function ShippingAnalyticsPage() {
  const [fromDate, setFromDate] = useState(() => monthsAgoIsoDate(1));
  const [toDate, setToDate] = useState(() => todayIsoDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    packages: 0,
    received: 0,
    in_transit: 0,
    arrived: 0,
    ready: 0,
    paid: 0,
    cbm_total: 0,
    freight_usd: 0,
    freight_ghs: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const headers = await authHeaders();
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        status,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (appliedSearch) params.set('q', appliedSearch);

      const res = await fetch(`/api/admin/analytics/shipping?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load shipping analytics.');

      setPackages(Array.isArray(data.packages) ? data.packages : []);
      setTotal(Number(data.total) || 0);
      setSummary({
        packages: Number(data.summary?.packages) || 0,
        received: Number(data.summary?.received) || 0,
        in_transit: Number(data.summary?.in_transit) || 0,
        arrived: Number(data.summary?.arrived) || 0,
        ready: Number(data.summary?.ready) || 0,
        paid: Number(data.summary?.paid) || 0,
        cbm_total: Number(data.summary?.cbm_total) || 0,
        freight_usd: Number(data.summary?.freight_usd) || 0,
        freight_ghs: Number(data.summary?.freight_ghs) || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Could not load shipping analytics.');
      setPackages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, fromDate, page, status, toDate]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const rangeLabel = useMemo(() => `${fromDate}_to_${toDate}`, [fromDate, toDate]);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(searchTerm.trim());
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError('');
      const headers = await authHeaders();
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        status,
        export: '1',
      });
      if (appliedSearch) params.set('q', appliedSearch);

      const res = await fetch(`/api/admin/analytics/shipping?${params}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not export shipping packages.');

      const rows: PackageRow[] = Array.isArray(data.packages) ? data.packages : [];
      if (!rows.length) {
        alert('No packages in this range to export.');
        return;
      }

      downloadCsv(`shipping-packages-${rangeLabel}.csv`, [
        [
          'Tracking ID',
          'Carrier tracking',
          'Package',
          'Customer name',
          'Customer email',
          'Date received',
          'Loaded at',
          'ETA',
          'Arrived at',
          'CBM',
          'Goods class',
          'Status',
          'Payment status',
          'Freight USD',
          'Freight GHS',
          'Freight included',
        ],
        ...rows.map((row) => [
          row.tracking_id || '',
          row.carrier_reference || '',
          row.package_name || '',
          row.customer_name || '',
          row.customer_email || '',
          formatDate(row.effective_received_at || row.warehouse_received_at),
          formatDate(row.loaded_at),
          formatDate(row.estimated_arrival_at),
          formatDate(row.arrived_at),
          row.cbm != null ? Number(row.cbm).toFixed(3) : '',
          shippingClassShortLabel(row.goods_class) || row.goods_class || '',
          row.status
            ? SHIPPING_STATUS_LABELS[row.status as ShippingPackageStatus] || row.status
            : '',
          row.freight_included
            ? 'Included in product'
            : row.shipping_payment_status || '',
          row.estimated_shipping_usd != null
            ? Number(row.estimated_shipping_usd).toFixed(2)
            : '',
          row.final_shipping_ghs != null || row.estimated_shipping_ghs != null
            ? Number(row.final_shipping_ghs ?? row.estimated_shipping_ghs).toFixed(2)
            : '',
          row.freight_included ? 'Yes' : 'No',
        ]),
      ]);

      if (data.export_capped) {
        alert(
          'Export limited to the first 5,000 matching packages. Narrow the date range or search to download the rest.',
        );
      }
    } catch (err: any) {
      setError(err.message || 'Could not export shipping packages.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Shipping Analytics</h1>
            <p className="mt-1 text-sm text-gray-600 md:mt-2 md:text-base">
              Search packages by tracking, customer, or contents. Filter by received date and
              download a spreadsheet for the selected range (max 10 months).
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void fetchRows()}
              className="rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || loading}
              className="flex items-center justify-center whitespace-nowrap rounded-lg border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400 disabled:opacity-60"
            >
              <i className="ri-download-line mr-2"></i>
              {exporting ? 'Exporting…' : 'Export list'}
            </button>
            <Link
              href="/admin/analytics"
              className="whitespace-nowrap rounded-lg bg-brand-primary px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-brand-accent"
            >
              Shop analytics
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-gray-700">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            Status
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2 pr-8"
            >
              <option value="all">All statuses</option>
              {SHIPPING_STATUS.map((value) => (
                <option key={value} value={value}>
                  {SHIPPING_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 md:col-span-2 lg:col-span-2">
            Search
            <div className="mt-1 flex gap-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
                placeholder="Tracking, customer, shoes…"
                className="w-full rounded-lg border-2 border-gray-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={applySearch}
                className="rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white hover:bg-brand-accent"
              >
                Search
              </button>
            </div>
          </label>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">Packages in range</p>
            <p className="text-3xl font-bold text-gray-900">{summary.packages}</p>
            <p className="mt-2 text-sm text-gray-500">{summary.cbm_total.toFixed(3)} CBM total</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">In transit</p>
            <p className="text-3xl font-bold text-gray-900">{summary.in_transit}</p>
            <p className="mt-2 text-sm text-gray-500">{summary.received} still at warehouse</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">Arrived / ready</p>
            <p className="text-3xl font-bold text-gray-900">{summary.arrived + summary.ready}</p>
            <p className="mt-2 text-sm text-gray-500">{summary.paid} paid or freight included</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-1 text-sm text-gray-600">Freight in range</p>
            <p className="text-2xl font-bold text-gray-900">{formatMoney(summary.freight_ghs, 'GHS')}</p>
            <p className="mt-2 text-sm text-gray-500">{formatMoney(summary.freight_usd, 'USD')} estimate</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="font-semibold text-gray-900">
              {loading ? 'Loading packages…' : `${total} package${total === 1 ? '' : 's'} found`}
            </h2>
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">CBM</th>
                  <th className="px-4 py-3">Freight</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {!loading && packages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      No packages in this date range. Try a wider month range or clear search.
                    </td>
                  </tr>
                ) : null}
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-gray-900">{pkg.package_name || 'Package'}</p>
                      <p className="font-mono text-[11px] text-gray-500">{pkg.tracking_id}</p>
                      {pkg.carrier_reference ? (
                        <p className="text-xs text-gray-500">Carrier: {pkg.carrier_reference}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-gray-900">{pkg.customer_name || 'Customer'}</p>
                      <p className="text-xs text-gray-500">{pkg.customer_email || '—'}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">
                      {formatDate(pkg.effective_received_at || pkg.warehouse_received_at)}
                      {pkg.loaded_at ? (
                        <p className="text-xs text-gray-500">Loaded {formatDate(pkg.loaded_at)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">
                      {pkg.cbm != null ? Number(pkg.cbm).toFixed(3) : '—'}
                      {shippingClassShortLabel(pkg.goods_class) ? (
                        <p className="text-xs text-gray-500">
                          {shippingClassShortLabel(pkg.goods_class)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">
                      {pkg.freight_included ? (
                        <span className="text-xs font-semibold text-brand-primary">Included</span>
                      ) : pkg.final_shipping_ghs != null ? (
                        formatMoney(Number(pkg.final_shipping_ghs), 'GHS')
                      ) : pkg.estimated_shipping_usd != null ? (
                        <>
                          {formatMoney(Number(pkg.estimated_shipping_usd), 'USD')}
                          <p className="text-xs text-gray-500">Estimate</p>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-700">
                      {pkg.status
                        ? SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus] || pkg.status
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
