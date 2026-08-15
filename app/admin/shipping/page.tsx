'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  calculateShipping,
  formatGhs,
  formatUsd,
  type ShippingRateBoard,
} from '@/lib/shipping';
import ShippingOperationsDesk from '@/components/admin/ShippingOperationsDesk';

const EMPTY: ShippingRateBoard = {
  id: 1,
  usd_to_ghs: 0,
  normal_usd_per_cbm: 260,
  sensitive_usd_per_cbm: 280,
  heavy_usd_per_cbm: 300,
  bulk_usd_per_cbm: 240,
  default_transit_days: 45,
  invoice_valid_days: 5,
  notes: null,
};

export default function AdminShippingPage() {
  const [form, setForm] = useState<ShippingRateBoard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [previewCbm, setPreviewCbm] = useState('0.3');

  useEffect(() => {
    fetch('/api/shipping/rates')
      .then((response) => response.json())
      .then((data) => {
        if (data.board) setForm(data.board);
      })
      .finally(() => setLoading(false));
  }, []);

  const preview = useMemo(
    () =>
      calculateShipping(
        Math.max(0, Number(previewCbm) || 0),
        Number(form.normal_usd_per_cbm) || 0,
        Number(form.usd_to_ghs) || 0,
      ),
    [form.normal_usd_per_cbm, form.usd_to_ghs, previewCbm],
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch('/api/shipping/rates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save rates.');
      setForm(data.board);
      setMessage('Shipping rates published.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save rates.');
    } finally {
      setSaving(false);
    }
  };

  const setNumber = (key: keyof ShippingRateBoard, value: string) => {
    setForm((current) => ({ ...current, [key]: Number(value) }));
  };

  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/15';

  if (loading) return <p className="p-6 text-slate-500">Loading shipping rates…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Shipping</h1>
        <p className="mt-1 text-sm text-slate-500">
          Publish China to Ghana CBM rates. Package details are added inside each paid order.
        </p>
      </div>

      <ShippingOperationsDesk />

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 font-bold text-brand-primary">
          Rates and defaults
          <span className="ml-2 text-xs font-normal text-slate-500">
            Change only when your freight terms change
          </span>
        </summary>
      <div className="grid gap-6 border-t border-slate-100 p-5 lg:grid-cols-[1fr_18rem]">
        <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              USD to GHS
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.usd_to_ghs}
                onChange={(event) => setNumber('usd_to_ghs', event.target.value)}
                className={inputClass}
                required
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Used only for the cedi estimate. Final cedis can be locked on arrival.
              </span>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Default journey days
              <input
                type="number"
                min="1"
                max="180"
                value={form.default_transit_days}
                onChange={(event) => setNumber('default_transit_days', event.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Shipping invoice days
              <input
                type="number"
                min="1"
                max="30"
                value={form.invoice_valid_days}
                onChange={(event) => setNumber('invoice_valid_days', event.target.value)}
                className={inputClass}
                required
              />
            </label>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="font-bold text-brand-primary">Rates per CBM</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {[
                ['normal_usd_per_cbm', 'Normal goods'],
                ['sensitive_usd_per_cbm', 'Sensitive goods'],
                ['heavy_usd_per_cbm', 'Heavy goods'],
                ['bulk_usd_per_cbm', 'Bulk goods'],
              ].map(([key, label]) => (
                <label key={key} className="text-sm font-semibold text-slate-700">
                  {label}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(form[key as keyof ShippingRateBoard] ?? '')}
                      onChange={(event) =>
                        setNumber(key as keyof ShippingRateBoard, event.target.value)
                      }
                      className={`${inputClass} pl-7`}
                      required
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Customer note (optional)
            <textarea
              value={form.notes || ''}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className={inputClass}
              rows={2}
              placeholder="Rates are estimates until arrival in Ghana."
            />
          </label>

          {message ? (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                message.includes('published')
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Publishing…' : 'Publish shipping rates'}
          </button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-accent">
              Quick check
            </p>
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Package CBM
              <input
                value={previewCbm}
                onChange={(event) => setPreviewCbm(event.target.value)}
                inputMode="decimal"
                className={inputClass}
              />
            </label>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Normal rate</dt>
                <dd className="font-semibold">{formatUsd(form.normal_usd_per_cbm)} / CBM</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Shipping</dt>
                <dd className="font-bold text-brand-primary">{formatUsd(preview.shippingUsd)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Cedi estimate</dt>
                <dd className="font-bold text-brand-primary">
                  {preview.shippingGhs == null ? 'Set USD rate' : formatGhs(preview.shippingGhs)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl bg-brand-light/60 p-4 text-sm text-brand-primary">
            <p className="font-bold">Next step</p>
            <p className="mt-1 text-xs leading-relaxed">
              Open a paid order and add its measured package. CIF freight can still be tracked but
              will show freight included.
            </p>
            <Link href="/admin/orders" className="mt-3 inline-block font-semibold underline">
              Open orders
            </Link>
          </div>
        </aside>
      </div>
      </details>
    </div>
  );
}
