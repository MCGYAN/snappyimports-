'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  formatGhs,
  formatUsd,
  SHIPPING_CLASS_LABELS,
  SHIPPING_GOODS_CLASSES,
  SHIPPING_STATUS_LABELS,
  type ShippingGoodsClass,
  type ShippingPackageStatus,
} from '@/lib/shipping';

type Queue = 'measure' | 'load' | 'transit' | 'billing' | 'confirm' | 'ready';

function customerName(order: any) {
  return (
    [order?.shipping_address?.firstName, order?.shipping_address?.lastName]
      .filter(Boolean)
      .join(' ') ||
    order?.email ||
    'Customer'
  );
}

export default function ShippingOperationsDesk() {
  const [data, setData] = useState<any>({ orders: [], packages: [], board: null });
  const [queue, setQueue] = useState<Queue>('measure');
  const [selected, setSelected] = useState<string[]>([]);
  const [measurements, setMeasurements] = useState<Record<string, { cbm: string; goodsClass: ShippingGoodsClass }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vessel, setVessel] = useState('');
  const [loadedAt, setLoadedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [transitDays, setTransitDays] = useState('45');
  const [arrivalRate, setArrivalRate] = useState('');
  const [validDays, setValidDays] = useState('5');
  const [undoPackageIds, setUndoPackageIds] = useState<string[]>([]);

  const headers = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(sessionData.session?.access_token
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : {}),
    };
  };

  const load = async () => {
    const response = await fetch('/api/shipping/desk', { headers: await headers() });
    const result = await response.json();
    if (response.ok) {
      setData(result);
      setTransitDays(String(result.board?.default_transit_days || 45));
      setArrivalRate(String(result.board?.usd_to_ghs || ''));
      setValidDays(String(result.board?.invoice_valid_days || 5));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const packageByItem = useMemo(
    () => new Set((data.packages || []).map((pkg: any) => pkg.order_item_id).filter(Boolean)),
    [data.packages],
  );
  const measureRows = useMemo(
    () =>
      (data.orders || []).flatMap((order: any) =>
        (order.order_items || [])
          .filter((item: any) => !packageByItem.has(item.id))
          .map((item: any) => ({ order, item })),
      ),
    [data.orders, packageByItem],
  );
  const packageQueues = useMemo(() => {
    const packages = data.packages || [];
    return {
      load: packages.filter((pkg: any) => pkg.status === 'received'),
      transit: packages.filter((pkg: any) => ['loaded', 'in_transit'].includes(pkg.status)),
      billing: packages.filter(
        (pkg: any) =>
          ['arrived', 'clearing'].includes(pkg.status) &&
          !['awaiting_confirmation', 'paid'].includes(pkg.shipping_payment_status),
      ),
      confirm: packages.filter((pkg: any) => pkg.shipping_payment_status === 'awaiting_confirmation'),
      ready: packages.filter(
        (pkg: any) =>
          pkg.shipping_payment_status === 'paid' ||
          (pkg.freight_included &&
            ['arrived', 'clearing', 'ready', 'delivered'].includes(pkg.status)),
      ),
    } as Record<Exclude<Queue, 'measure'>, any[]>;
  }, [data.packages]);

  const counts: Record<Queue, number> = {
    measure: measureRows.length,
    load: packageQueues.load.length,
    transit: packageQueues.transit.length,
    billing: packageQueues.billing.length,
    confirm: packageQueues.confirm.length,
    ready: packageQueues.ready.length,
  };
  const rows = queue === 'measure' ? [] : packageQueues[queue];

  const measure = async (orderId: string, itemId: string) => {
    const entry = measurements[itemId] || { cbm: '', goodsClass: 'normal' as const };
    if (!(Number(entry.cbm) > 0)) return alert('Enter a valid CBM.');
    setBusy(true);
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        action: 'measure',
        orderId,
        orderItemId: itemId,
        cbm: Number(entry.cbm),
        goodsClass: entry.goodsClass,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return alert(result.error || 'Could not save package.');
    await load();
  };

  const runBatch = async (action: 'mark_in_transit' | 'lock_arrival' | 'confirm_shipping_payment') => {
    if (!selected.length) return;
    let prompt = `Update ${selected.length} package${selected.length === 1 ? '' : 's'}?`;
    if (action === 'lock_arrival') {
      const totalUsd = rows
        .filter((pkg: any) => selected.includes(pkg.id) && !pkg.freight_included)
        .reduce((sum: number, pkg: any) => sum + Number(pkg.estimated_shipping_usd || 0), 0);
      prompt = `Lock ${selected.length} shipping bill${selected.length === 1 ? '' : 's'} at GH¢${Number(arrivalRate).toFixed(2)} per USD? The selected freight total is ${formatUsd(totalUsd)}.`;
    }
    if (action === 'confirm_shipping_payment') {
      const total = rows
        .filter((pkg: any) => selected.includes(pkg.id))
        .reduce((sum: number, pkg: any) => sum + Number(pkg.final_shipping_ghs || 0), 0);
      prompt = `Confirm ${selected.length} shipping payment${selected.length === 1 ? '' : 's'} totalling ${formatGhs(total)}? Check the bank or MoMo account first.`;
    }
    if (!confirm(prompt)) return;
    setBusy(true);
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        action,
        packageIds: selected,
        vessel,
        loadedAt,
        transitDays: Number(transitDays),
        finalUsdToGhs: Number(arrivalRate),
        validDays: Number(validDays),
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return alert(result.error || 'Could not update packages.');
    if (action === 'confirm_shipping_payment' && result.confirmed > 0) {
      setUndoPackageIds([...selected]);
      window.setTimeout(() => setUndoPackageIds([]), 120_000);
    }
    setSelected([]);
    await load();
    if (action === 'confirm_shipping_payment') {
      window.setTimeout(async () => {
        void fetch('/api/cron/receipt-outbox', { method: 'POST', headers: await headers() });
      }, 125_000);
    }
  };

  const undoShippingPayments = async () => {
    if (!undoPackageIds.length) return;
    setBusy(true);
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ action: 'undo_shipping_payment', packageIds: undoPackageIds }),
    });
    setBusy(false);
    setUndoPackageIds([]);
    if (!response.ok) return alert('The undo window has closed.');
    await load();
  };

  const toggleAll = () => {
    const ids = rows.map((row: any) => row.id);
    setSelected(selected.length === ids.length ? [] : ids);
  };

  const queueLabels: { key: Queue; label: string }[] = [
    { key: 'measure', label: 'Needs measuring' },
    { key: 'load', label: 'Ready to ship' },
    { key: 'transit', label: 'In transit' },
    { key: 'billing', label: 'Ghana bills' },
    { key: 'confirm', label: 'Payment check' },
    { key: 'ready', label: 'Paid and ready' },
  ];

  if (loading) return <p className="rounded-2xl bg-white p-6 text-slate-500">Loading shipping work…</p>;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-bold text-brand-primary">Shipping work queue</p>
            <p className="mt-1 text-xs text-slate-500">
              Process routine packages here. Open an order only when something is unusual.
            </p>
          </div>
          <p className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
            {Object.values(counts).reduce((sum, count) => sum + count, 0)} records
          </p>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {queueLabels.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setQueue(tab.key);
                setSelected([]);
              }}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${
                queue === tab.key
                  ? 'bg-brand-primary text-white'
                  : 'border border-slate-200 text-slate-600'
              }`}
            >
              {tab.label} {counts[tab.key]}
            </button>
          ))}
        </div>
      </div>

      {undoPackageIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            Shipping payment confirmed. The receipt email waits 2 minutes.
          </p>
          <button
            type="button"
            onClick={() => void undoShippingPayments()}
            disabled={busy}
            className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800"
          >
            Undo confirmation
          </button>
        </div>
      ) : null}

      {queue === 'measure' ? (
        <div className="divide-y divide-slate-100">
          {measureRows.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">Nothing needs measuring.</p>
          ) : (
            measureRows.map(({ order, item }: any) => {
              const current = measurements[item.id] || { cbm: '', goodsClass: 'normal' };
              const importType = item.metadata?.import_type || item.products?.metadata?.import_type;
              return (
                <div
                  key={item.id}
                  className="grid gap-3 p-4 md:grid-cols-[1.4fr_.8fr_.7fr_auto] md:items-end"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {order.order_number}. {customerName(order)}
                    </p>
                    {['cif_tema', 'ddp'].includes(importType) ? (
                      <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Freight included. Track only.
                      </span>
                    ) : null}
                  </div>
                  <label className="text-xs font-semibold text-slate-600">
                    Goods class
                    <select
                      value={current.goodsClass}
                      onChange={(event) =>
                        setMeasurements((values) => ({
                          ...values,
                          [item.id]: {
                            ...current,
                            goodsClass: event.target.value as ShippingGoodsClass,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    >
                      {SHIPPING_GOODS_CLASSES.filter((key) => key !== 'custom').map((key) => (
                        <option key={key} value={key}>{SHIPPING_CLASS_LABELS[key]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Total CBM
                    <input
                      value={current.cbm}
                      onChange={(event) =>
                        setMeasurements((values) => ({
                          ...values,
                          [item.id]: { ...current, cbm: event.target.value },
                        }))
                      }
                      inputMode="decimal"
                      placeholder="0.300"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void measure(order.id, item.id)}
                    className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Save package
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          {selected.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3 border-b border-brand-primary/10 bg-brand-light/40 p-4">
              <p className="self-center text-sm font-bold text-brand-primary">{selected.length} selected</p>
              {queue === 'load' ? (
                <>
                  <label className="text-xs font-semibold text-slate-600">
                    Vessel or container
                    <input value={vessel} onChange={(event) => setVessel(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Loaded
                    <input type="datetime-local" value={loadedAt} onChange={(event) => setLoadedAt(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Days
                    <input value={transitDays} onChange={(event) => setTransitDays(event.target.value)} className="mt-1 block w-20 rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <button onClick={() => void runBatch('mark_in_transit')} disabled={busy} className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white">
                    Mark in transit
                  </button>
                </>
              ) : queue === 'transit' || queue === 'billing' ? (
                <>
                  <label className="text-xs font-semibold text-slate-600">
                    Final USD to GHS
                    <input value={arrivalRate} onChange={(event) => setArrivalRate(event.target.value)} className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Valid days
                    <input value={validDays} onChange={(event) => setValidDays(event.target.value)} className="mt-1 block w-20 rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <button onClick={() => void runBatch('lock_arrival')} disabled={busy} className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white">
                    Arrived and lock bills
                  </button>
                </>
              ) : queue === 'confirm' ? (
                <button onClick={() => void runBatch('confirm_shipping_payment')} disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white">
                  Confirm selected payments
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="p-3"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={toggleAll} /></th>
                  <th className="p-3">Package</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">CBM</th>
                  <th className="p-3">Freight</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Vessel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-400">Nothing in this queue.</td></tr>
                ) : rows.map((pkg: any) => (
                  <tr key={pkg.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(pkg.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(pkg.id)
                              ? current.filter((id) => id !== pkg.id)
                              : [...current, pkg.id],
                          )
                        }
                      />
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-900">{pkg.package_name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{pkg.tracking_id}</p>
                    </td>
                    <td className="p-3">
                      <p>{customerName(pkg.orders)}</p>
                      <p className="text-xs text-slate-400">{pkg.orders?.order_number}</p>
                    </td>
                    <td className="p-3 font-semibold">{Number(pkg.cbm).toFixed(3)}</td>
                    <td className="p-3 font-semibold text-brand-primary">
                      {pkg.freight_included
                        ? 'Included'
                        : pkg.final_shipping_ghs != null
                          ? formatGhs(pkg.final_shipping_ghs)
                          : formatUsd(pkg.estimated_shipping_usd)}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800">
                        {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus]}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{pkg.vessel || 'Not set'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
