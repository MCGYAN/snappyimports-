'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Western North',
  'Central',
  'Eastern',
  'Volta',
  'Oti',
  'Northern',
  'Savannah',
  'North East',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
];

const EMPTY_FORM = {
  requestType: 'pickup',
  preferredDate: '',
  preferredTimeWindow: '',
  phone: '',
  deliveryAddress: '',
  city: '',
  region: '',
  notes: '',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Request sent',
  contacting: 'We are calling you',
  confirmed: 'Arrangement confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function packageContents(pkg: any) {
  return (pkg.shipping_package_items || [])
    .map(
      (entry: any) =>
        `${entry.order_items?.product_name || 'Item'} × ${entry.quantity}`,
    )
    .join(', ');
}

export default function DeliveryRequests() {
  const [data, setData] = useState<any>({ packages: [], requests: [] });
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
    const response = await fetch('/api/delivery-requests', { headers: await headers() });
    const result = await response.json();
    if (response.ok) setData(result);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestsByPackage = useMemo(
    () =>
      new Map(
        (data.requests || []).map((request: any) => [request.shipping_package_id, request]),
      ),
    [data.requests],
  );
  const visiblePackages = (data.packages || []).filter(
    (pkg: any) => pkg.status === 'ready' || requestsByPackage.has(pkg.id),
  );
  const selectedPackage = visiblePackages.find((pkg: any) => pkg.id === selectedPackageId);

  const openForm = (pkg: any) => {
    const request: any = requestsByPackage.get(pkg.id);
    setSelectedPackageId(pkg.id);
    setMessage('');
    setForm(
      request
        ? {
            requestType: request.request_type,
            preferredDate: request.preferred_date,
            preferredTimeWindow: request.preferred_time_window || '',
            phone: request.phone || '',
            deliveryAddress: request.delivery_address || '',
            city: request.city || '',
            region: request.region || '',
            notes: request.notes || '',
          }
        : EMPTY_FORM,
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPackageId) return;
    setSaving(true);
    setMessage('');
    const response = await fetch('/api/delivery-requests', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ packageId: selectedPackageId, ...form }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error || 'Could not save your request.');
      return;
    }
    setMessage('Your request was sent. We will call you to confirm the arrangement.');
    setSelectedPackageId('');
    setForm(EMPTY_FORM);
    await load();
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-500">Loading deliveries…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">Deliveries</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose pickup or delivery after a package is ready in Ghana.
        </p>
      </div>

      <div className="rounded-2xl bg-brand-light/60 p-4 text-sm text-brand-primary">
        <p className="font-bold">Scheduling opens only when your package is ready.</p>
        <p className="mt-1 text-xs leading-relaxed">
          Submit your preferred day here. Snappy will call you before pickup or delivery is
          confirmed.
        </p>
      </div>

      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            message.startsWith('Your request')
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message}
        </p>
      ) : null}

      {visiblePackages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <i className="ri-calendar-check-line text-3xl text-slate-300" />
          <p className="mt-2 font-semibold text-slate-700">Nothing ready to schedule yet</p>
          <p className="mt-1 text-sm text-slate-500">
            A scheduling button will appear after your package is cleared and ready in Ghana.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePackages.map((pkg: any) => {
            const request: any = requestsByPackage.get(pkg.id);
            const completed = request?.status === 'completed';
            return (
              <article key={pkg.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{pkg.package_name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{pkg.tracking_id}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      {packageContents(pkg) || 'Package contents recorded by the warehouse'}
                    </p>
                  </div>
                  {request ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        completed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {STATUS_LABELS[request.status] || request.status}
                    </span>
                  ) : null}
                </div>

                {request ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">
                      {request.request_type === 'pickup' ? 'Pickup' : 'Delivery'} on{' '}
                      {new Date(`${request.preferred_date}T12:00:00`).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    {request.preferred_time_window ? (
                      <p className="mt-1">{request.preferred_time_window}</p>
                    ) : null}
                  </div>
                ) : null}

                {!completed && pkg.status === 'ready' ? (
                  <button
                    type="button"
                    onClick={() =>
                      selectedPackageId === pkg.id ? setSelectedPackageId('') : openForm(pkg)
                    }
                    className="mt-3 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white"
                  >
                    {selectedPackageId === pkg.id
                      ? 'Close form'
                      : request
                        ? 'Change request'
                        : 'Schedule pickup or delivery'}
                  </button>
                ) : null}

                {selectedPackageId === pkg.id && selectedPackage ? (
                  <form onSubmit={submit} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['pickup', 'I will pick it up'],
                        ['delivery', 'Deliver it to me'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({ ...current, requestType: value }))
                          }
                          className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                            form.requestType === value
                              ? 'border-brand-primary bg-brand-light text-brand-primary'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Preferred date
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={form.preferredDate}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              preferredDate: event.target.value,
                            }))
                          }
                          required
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Preferred time
                        <select
                          value={form.preferredTimeWindow}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              preferredTimeWindow: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                        >
                          <option value="">Any time</option>
                          <option value="Morning, 8am to 12pm">Morning, 8am to 12pm</option>
                          <option value="Afternoon, 12pm to 4pm">Afternoon, 12pm to 4pm</option>
                          <option value="Evening, 4pm to 6pm">Evening, 4pm to 6pm</option>
                        </select>
                      </label>
                    </div>

                    <label className="block text-xs font-semibold text-slate-600">
                      Phone number
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, phone: event.target.value }))
                        }
                        placeholder="024 123 4567"
                        required
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                      />
                    </label>

                    {form.requestType === 'delivery' ? (
                      <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                        <label className="block text-xs font-semibold text-slate-600">
                          Delivery address
                          <input
                            value={form.deliveryAddress}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                deliveryAddress: event.target.value,
                              }))
                            }
                            required
                            placeholder="House number, street, and landmark"
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-600">
                            City
                            <input
                              value={form.city}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, city: event.target.value }))
                              }
                              required
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Region
                            <select
                              value={form.region}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, region: event.target.value }))
                              }
                              required
                              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                            >
                              <option value="">Choose region</option>
                              {GHANA_REGIONS.map((region) => (
                                <option key={region} value={region}>
                                  {region}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <label className="block text-xs font-semibold text-slate-600">
                      Note, optional
                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        rows={2}
                        placeholder="Landmark, pickup contact, or anything we should know"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {saving ? 'Sending…' : 'Submit request'}
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
