'use client';

import { downloadCsv } from '@/lib/csv-download';
import {
  SHIPPING_STATUS,
  SHIPPING_STATUS_LABELS,
  shippingClassShortLabel,
  type ShippingPackageStatus,
} from '@/lib/shipping';
import {
  AnalyticsShell,
  AnalyticsToolbar,
  DataTable,
  Journey,
  Pill,
  StatCard,
  StatGrid,
  formatDay,
  formatMoney,
  rangeFileLabel,
  useAnalyticsData,
  type Column,
} from '@/components/admin/analytics/AnalyticsKit';

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
};

function statusLabel(status: string | null) {
  if (!status) return '';
  return SHIPPING_STATUS_LABELS[status as ShippingPackageStatus] || status;
}

function statusTone(status: string | null): 'slate' | 'green' | 'amber' | 'blue' {
  if (status === 'ready' || status === 'delivered') return 'green';
  if (status === 'arrived' || status === 'clearing') return 'amber';
  if (status === 'loaded' || status === 'in_transit') return 'blue';
  return 'slate';
}

function paymentText(row: PackageRow) {
  if (row.freight_included) return 'Included in product';
  if (row.shipping_payment_status === 'paid') return 'Paid';
  return row.shipping_payment_status ? row.shipping_payment_status.replace(/_/g, ' ') : 'Not billed';
}

export default function ShippingAnalyticsPage() {
  const { query, data, rows, total, loading, exporting, error, setError, fetchAllForExport } =
    useAnalyticsData<PackageRow>({
      endpoint: '/api/admin/analytics/shipping',
      filterParam: 'status',
      rowsKey: 'packages',
    });

  const summary = data?.summary || {};

  const handleExport = async () => {
    try {
      const { rows: all, capped } = await fetchAllForExport();
      if (!all.length) {
        alert('No packages match these filters.');
        return;
      }
      downloadCsv(`shipping-packages-${rangeFileLabel(query)}.csv`, [
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
          'Payment',
          'Freight USD',
          'Freight GHS',
        ],
        ...all.map((row) => [
          row.tracking_id || '',
          row.carrier_reference || '',
          row.package_name || '',
          row.customer_name || '',
          row.customer_email || '',
          formatDay(row.effective_received_at || row.warehouse_received_at),
          formatDay(row.loaded_at),
          formatDay(row.estimated_arrival_at),
          formatDay(row.arrived_at),
          row.cbm != null ? Number(row.cbm).toFixed(3) : '',
          shippingClassShortLabel(row.goods_class) || '',
          statusLabel(row.status),
          paymentText(row),
          row.estimated_shipping_usd != null ? Number(row.estimated_shipping_usd).toFixed(2) : '',
          row.final_shipping_ghs != null || row.estimated_shipping_ghs != null
            ? Number(row.final_shipping_ghs ?? row.estimated_shipping_ghs).toFixed(2)
            : '',
        ]),
      ]);
      if (capped) alert('Export limited to the first 5,000 packages. Narrow the dates to download the rest.');
    } catch (err: any) {
      setError(err.message || 'Could not export.');
    }
  };

  const columns: Column<PackageRow>[] = [
    {
      key: 'package',
      header: 'Package',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.package_name || 'Package'}</p>
          <p className="font-mono text-[11px] text-slate-500">{row.tracking_id}</p>
          {row.carrier_reference ? <p className="text-xs text-slate-500">Carrier {row.carrier_reference}</p> : null}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="min-w-[10rem]">
          <p className="font-medium text-slate-900">{row.customer_name || 'Customer'}</p>
          <p className="text-xs text-slate-500">{row.customer_email}</p>
        </div>
      ),
    },
    {
      key: 'journey',
      header: 'Journey',
      render: (row) => (
        <Journey
          steps={[
            { label: 'Received', at: row.effective_received_at || row.warehouse_received_at },
            { label: 'Loaded', at: row.loaded_at },
            { label: 'Arrived', at: row.arrived_at },
          ]}
        />
      ),
    },
    {
      key: 'cbm',
      header: 'CBM',
      render: (row) => (
        <div>
          <p className="text-slate-800">{row.cbm != null ? Number(row.cbm).toFixed(3) : ''}</p>
          <p className="text-xs text-slate-500">{shippingClassShortLabel(row.goods_class)}</p>
        </div>
      ),
    },
    {
      key: 'freight',
      header: 'Freight',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">
            {row.freight_included
              ? 'Included'
              : row.final_shipping_ghs != null
                ? formatMoney(row.final_shipping_ghs)
                : row.estimated_shipping_usd != null
                  ? formatMoney(row.estimated_shipping_usd, 'USD')
                  : ''}
          </p>
          <p className="text-xs capitalize text-slate-500">{paymentText(row)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Pill tone={statusTone(row.status)}>{statusLabel(row.status)}</Pill>,
    },
  ];

  return (
    <AnalyticsShell
      title="Shipping"
      description="Every warehouse package by date received. Search by tracking, customer or contents, then export the list."
    >
      <AnalyticsToolbar
        query={query}
        searchPlaceholder="Search tracking, carrier ID, customer or contents like shoes"
        filters={
          <select
            value={query.filter}
            onChange={(e) => query.setFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700"
            aria-label="Status"
          >
            <option value="all">All statuses</option>
            {SHIPPING_STATUS.map((value) => (
              <option key={value} value={value}>
                {SHIPPING_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        }
        onExport={() => void handleExport()}
        exporting={exporting}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <StatGrid>
        <StatCard
          label="Packages"
          value={Number(summary.packages || 0).toLocaleString()}
          hint={`${Number(summary.cbm_total || 0).toFixed(3)} CBM total`}
        />
        <StatCard
          label="In transit"
          value={Number(summary.in_transit || 0).toLocaleString()}
          hint={`${Number(summary.received || 0).toLocaleString()} still at warehouse`}
        />
        <StatCard
          label="Arrived or ready"
          value={(Number(summary.arrived || 0) + Number(summary.ready || 0)).toLocaleString()}
          hint={`${Number(summary.paid || 0).toLocaleString()} paid or included`}
        />
        <StatCard
          label="Freight"
          value={formatMoney(summary.freight_ghs)}
          hint={`${formatMoney(summary.freight_usd, 'USD')} estimate`}
        />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        total={total}
        page={query.page}
        onPage={query.setPage}
        emptyText="No packages in this range. Try another month or clear the search."
      />
    </AnalyticsShell>
  );
}
