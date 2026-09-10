'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, PackagePlus, RefreshCw, Warehouse } from 'lucide-react';
import {
  buildChineseAddressLine,
  buildCustomerShippingLabel,
  formatTraderPhoneForLabel,
} from '@/lib/warehouse-label';

type ChinaWarehouseProps = {
  accessToken: string;
};

type WarehouseData = {
  shippingMark: string | null;
  traderName: string | null;
  traderPhone: string | null;
  warehouse: {
    warehouse_name: string;
    contact_name: string | null;
    phone: string | null;
    address_chinese: string | null;
    entry_numbers: string | null;
    ghana_tracking_phone: string | null;
    tracking_whatsapp: string | null;
    instructions: string | null;
  } | null;
  inboundPackages: any[];
};

const EMPTY_DATA: WarehouseData = {
  shippingMark: null,
  traderName: null,
  traderPhone: null,
  warehouse: null,
  inboundPackages: [],
};

const STATUS_LABELS: Record<string, string> = {
  expected: 'Expected at China warehouse',
  received: 'Received at China warehouse',
  converted: 'International shipment created',
};

export default function ChinaWarehouse({ accessToken }: ChinaWarehouseProps) {
  const [data, setData] = useState<WarehouseData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    trackingNumber: '',
    supplierName: '',
    description: '',
    notes: '',
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await fetch('/api/account/china-warehouse', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load warehouse details.');
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load warehouse details.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1800);
  };

  const chinaTracking =
    data.warehouse?.tracking_whatsapp || data.warehouse?.phone || null;
  const labelSource = useMemo(
    () => ({
      shippingMark: data.shippingMark,
      traderPhone: data.traderPhone,
      addressChinese: data.warehouse?.address_chinese,
      entryNumbers: data.warehouse?.entry_numbers,
      ghanaTrackingPhone: data.warehouse?.ghana_tracking_phone,
      chinaTrackingPhone: chinaTracking,
    }),
    [chinaTracking, data],
  );
  const shippingLabel = useMemo(() => buildCustomerShippingLabel(labelSource), [labelSource]);
  const addressLine = useMemo(() => buildChineseAddressLine(labelSource), [labelSource]);
  const traderPhoneLabel = formatTraderPhoneForLabel(data.traderPhone);
  const chinaWhatsappDigits = String(chinaTracking || '').replace(/\D/g, '');
  const ghanaWhatsappDigits = String(data.warehouse?.ghana_tracking_phone || '').replace(/\D/g, '');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/account/china-warehouse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not register this package.');
      setForm({ trackingNumber: '', supplierName: '', description: '', notes: '' });
      setMessage('Package registered. We will update it after the China warehouse receives it.');
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not register this package.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading China warehouse…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">China warehouse</h2>
        <p className="mt-1 text-sm text-slate-500">
          Copy this label and send it to your supplier in China.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {data.warehouse ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-brand-accent">
                <Warehouse size={22} />
              </span>
              <div>
                <h3 className="font-bold text-slate-900">Supplier shipping label</h3>
                <p className="text-xs text-slate-500">Chinese suppliers understand this format best.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void copyText('details', shippingLabel)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-bold text-white"
            >
              {copied === 'details' ? <Check size={17} /> : <Copy size={17} />}
              {copied === 'details' ? 'Copied' : 'Copy shipping label'}
            </button>
          </div>

          <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {(data.warehouse.ghana_tracking_phone || chinaTracking) && (
              <div className="space-y-1 border-b border-slate-200 pb-4">
                {data.warehouse.ghana_tracking_phone ? (
                  <p>
                    <span className="font-semibold text-slate-500">Ghana tracking:</span>{' '}
                    {data.warehouse.ghana_tracking_phone}
                  </p>
                ) : null}
                {chinaTracking ? (
                  <p>
                    <span className="font-semibold text-slate-500">China tracking:</span>{' '}
                    {chinaTracking}
                  </p>
                ) : null}
              </div>
            )}

            <div className="space-y-3 font-medium">
              {addressLine ? (
                <p className="text-base font-bold leading-relaxed text-slate-900">{addressLine}</p>
              ) : null}
              <div>
                <p className="font-bold text-slate-900">唛头</p>
                <p className="font-mono text-lg font-black tracking-wide text-brand-primary">
                  {data.shippingMark || 'Shipping mark pending'}
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-900">（电话）：</p>
                <p>
                  (电话):
                  {traderPhoneLabel || 'Add your telephone in Profile Settings'}
                </p>
              </div>
            </div>
          </div>

          {data.warehouse.instructions ? (
            <div className="mt-4 rounded-xl bg-orange-50 p-4 text-sm leading-relaxed text-slate-700">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Important</p>
              <p className="mt-1 whitespace-pre-line">{data.warehouse.instructions}</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {ghanaWhatsappDigits ? (
              <a
                href={`https://wa.me/${ghanaWhatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white"
              >
                <MessageCircle size={18} />
                Ghana tracking team
              </a>
            ) : null}
            {chinaWhatsappDigits ? (
              <a
                href={`https://wa.me/${chinaWhatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#25D366] bg-white px-4 text-sm font-bold text-[#128C7E]"
              >
                <MessageCircle size={18} />
                China tracking team
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <Warehouse className="mx-auto text-slate-300" size={32} />
          <p className="mt-3 font-semibold text-slate-700">Warehouse details are being prepared</p>
          <p className="mt-1 text-sm text-slate-500">Contact Snappy before asking a supplier to send goods.</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <PackagePlus className="text-brand-accent" size={22} />
          <div>
            <h3 className="font-bold text-slate-900">Register an incoming package</h3>
            <p className="text-sm text-slate-500">Tell us what your supplier has sent to the warehouse.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Supplier tracking number
            <input
              required
              value={form.trackingNumber}
              onChange={(event) => setForm({ ...form, trackingNumber: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono font-normal"
              placeholder="SF123456789"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Supplier name
            <input
              value={form.supplierName}
              onChange={(event) => setForm({ ...form, supplierName: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
              placeholder="Optional"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            What is inside?
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
              placeholder="Optional item description"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Note
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
              placeholder="Anything the warehouse should know"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              disabled={saving}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-accent px-5 font-bold text-white disabled:opacity-60 sm:w-auto"
            >
              {saving ? <RefreshCw className="animate-spin" size={17} /> : <PackagePlus size={17} />}
              {saving ? 'Registering…' : 'Register package'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h3 className="font-bold text-slate-900">Incoming packages</h3>
        {data.inboundPackages.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center">
            <p className="font-semibold text-slate-700">No incoming packages</p>
            <p className="mt-1 text-sm text-slate-500">Packages you register will appear here.</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
            {data.inboundPackages.map((pkg) => (
              <div key={pkg.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-semibold text-slate-900">{pkg.description || 'Incoming package'}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{pkg.supplier_tracking_number}</p>
                  {pkg.supplier_name ? (
                    <p className="mt-1 text-xs text-slate-500">Supplier: {pkg.supplier_name}</p>
                  ) : null}
                </div>
                <span className="w-fit rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-800">
                  {STATUS_LABELS[pkg.status] || 'Being reviewed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
