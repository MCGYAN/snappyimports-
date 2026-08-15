'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  calculateCbm,
  calculateShipping,
  formatGhs,
  formatUsd,
  rateForClass,
  SHIPPING_CLASS_LABELS,
  SHIPPING_GOODS_CLASSES,
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
  warehouseReceivedAt: '',
  loadedAt: '',
  transitDays: '45',
  vessel: '',
  notes: '',
};

function localInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateLabel(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StepHeading({ number, title, hint }: { number: number; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-white">
        {number}
      </span>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export default function OrderShippingDesk({ order }: Props) {
  const [packages, setPackages] = useState<any[]>([]);
  const [board, setBoard] = useState<ShippingRateBoard | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lockRates, setLockRates] = useState<Record<string, string>>({});
  const [lockingId, setLockingId] = useState('');

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

  const classRate =
    form.goodsClass === 'custom'
      ? Number(form.customUsdPerCbm) || 0
      : board
        ? rateForClass(board, form.goodsClass)
        : 0;

  const dimensionCbm = useMemo(() => {
    const length = Number(form.lengthM) || 0;
    const width = Number(form.widthM) || 0;
    const height = Number(form.heightM) || 0;
    if (!(length > 0 && width > 0 && height > 0)) return 0;
    return calculateCbm(length, width, height, Number(form.quantity) || 1);
  }, [form.heightM, form.lengthM, form.quantity, form.widthM]);

  const effectiveCbm = dimensionCbm > 0 ? dimensionCbm : Number(form.cbm) || 0;

  const preview = useMemo(
    () => calculateShipping(effectiveCbm, form.freightIncluded ? 0 : classRate, board?.usd_to_ghs),
    [board?.usd_to_ghs, classRate, effectiveCbm, form.freightIncluded],
  );

  const etaPreview = useMemo(() => {
    if (!form.loadedAt) return null;
    const days = Math.max(1, Number(form.transitDays) || 45);
    return new Date(new Date(form.loadedAt).getTime() + days * 86_400_000);
  }, [form.loadedAt, form.transitDays]);

  const chooseItem = (id: string) => {
    const item = order.order_items?.find((row: any) => row.id === id);
    const importType = String(
      item?.metadata?.import_type || item?.products?.metadata?.import_type || '',
    );
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
      warehouseReceivedAt: localInput(pkg.warehouse_received_at),
      loadedAt: localInput(pkg.loaded_at),
      transitDays: String(board?.default_transit_days || 45),
      vessel: pkg.vessel || '',
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
    if (!(effectiveCbm > 0)) {
      setError('Enter the box measurements, or type the total CBM.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/shipping/packages', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId: order.id, ...form, cbm: effectiveCbm }),
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

  const lockRate = async (pkg: any) => {
    const rate = Number(lockRates[pkg.id] || board?.usd_to_ghs || 0);
    if (!(rate > 0)) return alert('Enter the dollar rate for today.');
    const amount = Number(pkg.estimated_shipping_usd || 0) * rate;
    if (
      !confirm(
        `Bill ${formatGhs(amount)} for ${pkg.package_name} at GH¢${rate.toFixed(2)} per $1? The customer sees this amount straight away.`,
      )
    ) {
      return;
    }
    setLockingId(pkg.id);
    const headers = await authHeaders();
    const response = await fetch('/api/shipping/packages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'lock_rate',
        orderId: order.id,
        packageId: pkg.id,
        finalUsdToGhs: rate,
      }),
    });
    setLockingId('');
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return alert(data.error || 'Could not lock the rate.');
    }
    await load();
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
          <h2 className="font-bold text-brand-primary">Shipping and package size</h2>
          <p className="mt-1 text-xs text-slate-500">
            Measure the goods once. The freight cost, arrival date and the customer page fill in on
            their own. Milestones follow the import journey, so you never set a status twice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) reset();
            else setShowForm(true);
          }}
          disabled={order.payment_status !== 'paid'}
          className="shrink-0 rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
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
          <p className="py-3 text-center text-sm text-slate-400">
            No package measured yet. Add one after the China warehouse weighs and measures the
            goods.
          </p>
        ) : null}

        {packages.map((pkg) => {
          const arrived = ['arrived', 'clearing', 'ready', 'delivered'].includes(pkg.status);
          const needsLock = arrived && !pkg.freight_included && !pkg.final_usd_to_ghs;
          return (
            <div key={pkg.id} className="rounded-xl border border-slate-200">
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {pkg.package_name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{pkg.tracking_id}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {Number(pkg.cbm).toFixed(3)} CBM
                    {pkg.freight_included
                      ? '. Freight already paid in the product price.'
                      : `. ${Number(pkg.cbm).toFixed(3)} x ${formatUsd(pkg.usd_per_cbm)} = ${formatUsd(pkg.estimated_shipping_usd)}`}
                  </p>
                  {pkg.final_usd_to_ghs && !pkg.freight_included ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Billed {formatGhs(pkg.final_shipping_ghs)} at GH¢
                      {Number(pkg.final_usd_to_ghs).toFixed(2)} per $1
                    </p>
                  ) : null}
                  {dateLabel(pkg.estimated_arrival_at) && !arrived ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Arrives around {dateLabel(pkg.estimated_arrival_at)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-full bg-brand-light px-2 py-1 text-[10px] font-semibold text-brand-primary">
                    {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus]}
                  </span>
                  <button
                    type="button"
                    onClick={() => editPackage(pkg)}
                    className="text-[11px] font-semibold text-brand-primary underline"
                  >
                    Edit size and dates
                  </button>
                </div>
              </div>

              {needsLock ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-orange-100 bg-orange-50 px-3 py-3">
                  <div>
                    <p className="text-xs font-bold text-orange-900">Goods landed. Send the bill.</p>
                    <p className="text-[11px] text-orange-800">
                      Type today&apos;s dollar rate. We turn {formatUsd(pkg.estimated_shipping_usd)}{' '}
                      into cedis and send the invoice.
                    </p>
                  </div>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lockRates[pkg.id] ?? String(board?.usd_to_ghs || '')}
                    onChange={(event) =>
                      setLockRates((current) => ({ ...current, [pkg.id]: event.target.value }))
                    }
                    className="w-24 rounded-lg border border-orange-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void lockRate(pkg)}
                    disabled={lockingId === pkg.id}
                    className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {lockingId === pkg.id ? 'Sending…' : 'Lock rate and bill'}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {showForm ? (
          <form onSubmit={save} className="space-y-5 border-t border-slate-100 pt-4">
            <div className="space-y-3">
              <StepHeading
                number={1}
                title="What is in the package?"
                hint="Pick the item so the customer sees the same name."
              />
              <label className="block text-xs font-semibold text-slate-700">
                Order item
                <select
                  value={form.orderItemId}
                  onChange={(event) => chooseItem(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Custom package, not tied to one item</option>
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
            </div>

            <div className="space-y-3">
              <StepHeading
                number={2}
                title="How big is it?"
                hint="Enter the box in metres. We work out the CBM for you."
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['lengthM', 'Length (m)'],
                  ['widthM', 'Width (m)'],
                  ['heightM', 'Height (m)'],
                  ['quantity', 'How many boxes'],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold text-slate-600">
                    {label}
                    <input
                      type="number"
                      min={key === 'quantity' ? '1' : '0.01'}
                      step={key === 'quantity' ? '1' : '0.01'}
                      value={form[key as keyof typeof form] as string}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs text-slate-600">
                  {dimensionCbm > 0
                    ? 'Total size from your measurements'
                    : 'No measurements yet. Type the CBM if the warehouse already sent it.'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-brand-primary">
                    {effectiveCbm.toFixed(3)} CBM
                  </span>
                  {dimensionCbm > 0 ? null : (
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={form.cbm}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, cbm: event.target.value }))
                      }
                      placeholder="0.300"
                      className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <StepHeading
                number={3}
                title="What does the freight cost?"
                hint="Cedis are only an estimate until the goods land in Ghana."
              />
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
                  <strong>Shipping is already inside the product price</strong>
                  <span className="block text-slate-500">
                    Tick this for CIF Tema or DDP items. The customer gets no shipping bill.
                  </span>
                </span>
              </label>

              {form.freightIncluded ? null : (
                <>
                  <label className="block text-xs font-semibold text-slate-700">
                    Type of goods
                    <select
                      value={form.goodsClass}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          goodsClass: event.target.value as ShippingGoodsClass,
                        }))
                      }
                      className={inputClass}
                    >
                      {SHIPPING_GOODS_CLASSES.map((key) => (
                        <option key={key} value={key}>
                          {SHIPPING_CLASS_LABELS[key]}
                          {board && key !== 'custom'
                            ? ` (${formatUsd(rateForClass(board, key))} per CBM)`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.goodsClass === 'custom' ? (
                    <label className="block text-xs font-semibold text-slate-700">
                      Your own rate, dollars per CBM
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.customUsdPerCbm}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            customUsdPerCbm: event.target.value,
                          }))
                        }
                        className={inputClass}
                        required
                      />
                    </label>
                  ) : null}
                </>
              )}

              <div className="rounded-xl bg-brand-light/60 px-3 py-3 text-xs text-brand-primary">
                {form.freightIncluded ? (
                  <p className="font-semibold">
                    No shipping bill. Freight was already paid in the product price.
                  </p>
                ) : (
                  <>
                    <p className="font-semibold">
                      {effectiveCbm.toFixed(3)} CBM × {formatUsd(classRate)} per CBM ={' '}
                      {formatUsd(preview.shippingUsd)}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {preview.shippingGhs == null
                        ? 'Set today’s dollar rate on the Shipping page to preview cedis.'
                        : `About ${formatGhs(preview.shippingGhs)} at today’s GH¢${Number(
                            board?.usd_to_ghs || 0,
                          ).toFixed(2)} per $1. You lock the real cedi price when the goods land.`}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <StepHeading
                number={4}
                title="When does it travel?"
                hint="The loaded date starts the countdown the customer sees."
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-700">
                  Received at China warehouse
                  <input
                    type="datetime-local"
                    value={form.warehouseReceivedAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, warehouseReceivedAt: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Loaded on the vessel
                  <input
                    type="datetime-local"
                    value={form.loadedAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, loadedAt: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Days at sea
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
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {etaPreview
                  ? `Customer sees: arrives around ${etaPreview.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}.`
                  : 'Add the loaded date and the customer gets a live countdown to Ghana.'}
              </p>
              <details className="rounded-xl border border-slate-100 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-brand-primary">
                  Vessel and internal note
                </summary>
                <label className="mt-2 block text-xs font-semibold text-slate-700">
                  Vessel or container
                  <input
                    value={form.vessel}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, vessel: event.target.value }))
                    }
                    placeholder="Optional"
                    className={inputClass}
                  />
                </label>
                <label className="mt-2 block text-xs font-semibold text-slate-700">
                  Note for staff
                  <input
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Optional. Customers never see this."
                    className={inputClass}
                  />
                </label>
              </details>
            </div>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !board}
                className="flex-1 rounded-xl bg-brand-primary py-3 text-xs font-bold text-white disabled:opacity-40"
              >
                {saving ? 'Saving…' : form.packageId ? 'Save package' : 'Create package'}
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
