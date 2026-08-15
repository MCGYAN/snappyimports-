'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  calculateShipping,
  formatGhs,
  formatUsd,
  rateForClass,
  SHIPPING_CLASS_LABELS,
  SHIPPING_GOODS_CLASSES,
  SHIPPING_STATUS,
  SHIPPING_STATUS_LABELS,
  type ShippingGoodsClass,
  type ShippingPackageStatus,
  type ShippingRateBoard,
} from '@/lib/shipping';

type Props = {
  order: any;
};

const emptyForm = {
  packageId: '',
  orderItemId: '',
  packageName: '',
  goodsClass: 'normal' as ShippingGoodsClass,
  customUsdPerCbm: '',
  quantity: '1',
  cbm: '',
  lengthM: '',
  widthM: '',
  heightM: '',
  freightIncluded: false,
  status: 'received' as ShippingPackageStatus,
  warehouseReceivedAt: '',
  loadedAt: '',
  estimatedArrivalAt: '',
  transitDays: '45',
  vessel: '',
  finalUsdToGhs: '',
  arrivedAt: '',
  notes: '',
};

function localInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function OrderShippingDesk({ order }: Props) {
  const [packages, setPackages] = useState<any[]>([]);
  const [board, setBoard] = useState<ShippingRateBoard | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  };

  const load = async () => {
    setLoading(true);
    const headers = await authHeaders();
    const response = await fetch(
      `/api/shipping/packages?orderId=${encodeURIComponent(order.id)}`,
      { headers },
    );
    const data = await response.json();
    if (response.ok) {
      setPackages(data.packages || []);
      setBoard(data.board || null);
      setForm((current) => ({
        ...current,
        transitDays: String(data.board?.default_transit_days || 45),
      }));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const selectedItem = order.order_items?.find((item: any) => item.id === form.orderItemId);
  const selectedImportType = String(
    selectedItem?.metadata?.import_type || selectedItem?.products?.metadata?.import_type || '',
  );
  const classRate =
    form.goodsClass === 'custom'
      ? Number(form.customUsdPerCbm) || 0
      : board
        ? rateForClass(board, form.goodsClass)
        : 0;
  const preview = useMemo(
    () =>
      calculateShipping(
        Number(form.cbm) || 0,
        form.freightIncluded ? 0 : classRate,
        board?.usd_to_ghs,
      ),
    [board?.usd_to_ghs, classRate, form.cbm, form.freightIncluded],
  );

  const chooseItem = (id: string) => {
    const item = order.order_items?.find((row: any) => row.id === id);
    const importType = String(item?.metadata?.import_type || item?.products?.metadata?.import_type || '');
    setForm((current) => ({
      ...current,
      orderItemId: id,
      packageName: item?.product_name || current.packageName,
      quantity: String(item?.quantity || 1),
      freightIncluded: importType === 'cif_tema' || importType === 'ddp',
    }));
  };

  const editPackage = (pkg: any) => {
    setForm({
      packageId: pkg.id,
      orderItemId: pkg.order_item_id || '',
      packageName: pkg.package_name || '',
      goodsClass: pkg.goods_class || 'normal',
      customUsdPerCbm: pkg.goods_class === 'custom' ? String(pkg.usd_per_cbm || '') : '',
      quantity: String(pkg.quantity || 1),
      cbm: String(pkg.cbm || ''),
      lengthM: String(pkg.length_m || ''),
      widthM: String(pkg.width_m || ''),
      heightM: String(pkg.height_m || ''),
      freightIncluded: Boolean(pkg.freight_included),
      status: pkg.status || 'received',
      warehouseReceivedAt: localInput(pkg.warehouse_received_at),
      loadedAt: localInput(pkg.loaded_at),
      estimatedArrivalAt: localInput(pkg.estimated_arrival_at),
      transitDays: String(board?.default_transit_days || 45),
      vessel: pkg.vessel || '',
      finalUsdToGhs: String(pkg.final_usd_to_ghs || ''),
      arrivedAt: localInput(pkg.arrived_at),
      notes: pkg.notes || '',
    });
    setShowForm(true);
    setError('');
  };

  const reset = () => {
    setForm({ ...emptyForm, transitDays: String(board?.default_transit_days || 45) });
    setShowForm(false);
    setError('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/shipping/packages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId: order.id,
          ...form,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save shipment.');
      await load();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save shipment.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this package record?')) return;
    const headers = await authHeaders();
    const response = await fetch(`/api/shipping/packages?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (response.ok) await load();
  };

  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-accent';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-bold text-brand-primary">Shipping packages</h2>
          <p className="mt-1 text-xs text-slate-500">CBM, freight estimate and Ghana arrival.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) reset();
            else setShowForm(true);
          }}
          disabled={order.payment_status !== 'paid'}
          className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          {showForm ? 'Close' : 'Add package'}
        </button>
      </div>

      <div className="space-y-3 p-4">
        {order.payment_status !== 'paid' ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Confirm product payment before adding shipping packages.
          </p>
        ) : null}

        {!board ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Link href="/admin/shipping" className="font-bold text-brand-primary underline">
              Set shipping rates
            </Link>{' '}
            before creating a package.
          </p>
        ) : null}

        {loading ? <p className="text-sm text-slate-500">Loading packages…</p> : null}

        {!loading && packages.length === 0 && !showForm ? (
          <p className="py-3 text-center text-sm text-slate-400">No package measured yet.</p>
        ) : null}

        {packages.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => editPackage(pkg)}
            className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-primary/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{pkg.package_name}</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{pkg.tracking_id}</p>
              </div>
              <span className="rounded-full bg-brand-light px-2 py-1 text-[10px] font-semibold text-brand-primary">
                {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus]}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-600">
              <span>{Number(pkg.cbm).toFixed(3)} CBM</span>
              <span className="font-bold text-brand-primary">
                {pkg.freight_included
                  ? 'Freight included'
                  : formatUsd(Number(pkg.estimated_shipping_usd))}
              </span>
            </div>
          </button>
        ))}

        {showForm ? (
          <form onSubmit={save} className="space-y-3 border-t border-slate-100 pt-4">
            <label className="block text-xs font-semibold text-slate-700">
              Order item
              <select
                value={form.orderItemId}
                onChange={(event) => chooseItem(event.target.value)}
                className={inputClass}
              >
                <option value="">Custom package</option>
                {(order.order_items || []).map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.product_name} × {item.quantity}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Package name
              <input
                value={form.packageName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, packageName: event.target.value }))
                }
                className={inputClass}
                required
              />
            </label>

            {selectedImportType === 'cif_tema' || selectedImportType === 'ddp' ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                This item is {selectedImportType === 'cif_tema' ? 'CIF Tema' : 'DDP'}. Freight is
                already included, but CBM and travel dates will still be tracked.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Goods class
                <select
                  value={form.goodsClass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      goodsClass: event.target.value as ShippingGoodsClass,
                    }))
                  }
                  className={inputClass}
                  disabled={form.freightIncluded}
                >
                  {SHIPPING_GOODS_CLASSES.map((key) => (
                    <option key={key} value={key}>
                      {SHIPPING_CLASS_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Total CBM
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={form.cbm}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, cbm: event.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </label>
            </div>

            <details className="rounded-xl border border-slate-100 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-brand-primary">
                Calculate CBM from dimensions
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ['lengthM', 'Length (m)'],
                  ['widthM', 'Width (m)'],
                  ['heightM', 'Height (m)'],
                  ['quantity', 'Packages'],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold text-slate-600">
                    {label}
                    <input
                      type="number"
                      min={key === 'quantity' ? '1' : '0.0001'}
                      step={key === 'quantity' ? '1' : '0.0001'}
                      value={form[key as keyof typeof form] as string}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                If all three dimensions are entered, the system replaces Total CBM with length ×
                width × height × packages.
              </p>
            </details>

            {form.goodsClass === 'custom' && !form.freightIncluded ? (
              <label className="block text-xs font-semibold text-slate-700">
                Custom USD per CBM
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.customUsdPerCbm}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customUsdPerCbm: event.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </label>
            ) : null}

            <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={form.freightIncluded}
                onChange={(event) =>
                  setForm((current) => ({ ...current, freightIncluded: event.target.checked }))
                }
                className="mt-0.5"
              />
              <span>
                <strong>Freight already included</strong>
                <span className="block text-slate-500">Use for CIF Tema or DDP. No CBM fee is added.</span>
              </span>
            </label>

            <div className="rounded-xl bg-brand-light/60 px-3 py-2.5 text-xs text-brand-primary">
              <div className="flex justify-between">
                <span>Rate</span>
                <strong>{form.freightIncluded ? 'Included' : `${formatUsd(classRate)} / CBM`}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Freight estimate</span>
                <strong>{form.freightIncluded ? '$0.00' : formatUsd(preview.shippingUsd)}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Cedis today</span>
                <strong>
                  {form.freightIncluded
                    ? 'Included'
                    : preview.shippingGhs == null
                      ? 'Rate not set'
                      : formatGhs(preview.shippingGhs)}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Warehouse received
                <input
                  type="datetime-local"
                  value={form.warehouseReceivedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      warehouseReceivedAt: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Loaded / shipped
                <input
                  type="datetime-local"
                  value={form.loadedAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, loadedAt: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as ShippingPackageStatus,
                    }))
                  }
                  className={inputClass}
                >
                  {SHIPPING_STATUS.map((key) => (
                    <option key={key} value={key}>
                      {SHIPPING_STATUS_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Days to Ghana
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={form.transitDays}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, transitDays: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Vessel / shipping note
              <input
                value={form.vessel}
                onChange={(event) =>
                  setForm((current) => ({ ...current, vessel: event.target.value }))
                }
                placeholder="Optional vessel or container reference"
                className={inputClass}
              />
            </label>

            {['arrived', 'clearing', 'ready', 'delivered'].includes(form.status) &&
            !form.freightIncluded ? (
              <label className="block text-xs font-semibold text-slate-700">
                Final USD to GHS rate
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.finalUsdToGhs}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, finalUsdToGhs: event.target.value }))
                  }
                  className={inputClass}
                  placeholder={String(board?.usd_to_ghs || '')}
                />
                <span className="mt-1 block font-normal text-slate-400">
                  Locks the final cedi freight amount when goods arrive.
                </span>
              </label>
            ) : null}

            {error ? <p className="text-xs text-red-600">{error}</p> : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !board}
                className="flex-1 rounded-xl bg-brand-primary py-3 text-xs font-bold text-white disabled:opacity-40"
              >
                {saving ? 'Saving…' : form.packageId ? 'Update package' : 'Create package'}
              </button>
              {form.packageId ? (
                <button
                  type="button"
                  onClick={() => void remove(form.packageId)}
                  className="rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
