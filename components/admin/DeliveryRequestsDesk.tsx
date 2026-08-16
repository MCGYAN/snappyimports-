'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Queue = 'requested' | 'contacting' | 'confirmed' | 'completed' | 'cancelled';

const QUEUES: { key: Queue; label: string }[] = [
  { key: 'requested', label: 'New requests' },
  { key: 'contacting', label: 'Calling' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function packageContents(pkg: any) {
  return (pkg?.shipping_package_items || [])
    .map(
      (entry: any) =>
        `${entry.order_items?.product_name || 'Item'} × ${entry.quantity}`,
    )
    .join(', ');
}

function orderNumbers(pkg: any) {
  return [
    ...new Set(
      (pkg?.shipping_package_items || [])
        .map((entry: any) => entry.order_items?.orders?.order_number)
        .filter(Boolean),
    ),
  ].join(', ');
}

export default function DeliveryRequestsDesk() {
  const [requests, setRequests] = useState<any[]>([]);
  const [queue, setQueue] = useState<Queue>('requested');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

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
    const response = await fetch('/api/delivery-requests?view=admin', {
      headers: await headers(),
    });
    const result = await response.json();
    if (response.ok) {
      setRequests(result.requests || []);
      setNotes(
        Object.fromEntries(
          (result.requests || []).map((request: any) => [
            request.id,
            request.admin_notes || '',
          ]),
        ),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        QUEUES.map((item) => [
          item.key,
          requests.filter((request) => request.status === item.key).length,
        ]),
      ) as Record<Queue, number>,
    [requests],
  );
  const rows = requests.filter((request) => request.status === queue);

  const update = async (request: any, status: Queue) => {
    const action =
      status === 'completed'
        ? `Complete this ${request.request_type === 'pickup' ? 'pickup' : 'delivery'}?`
        : status === 'cancelled'
          ? 'Cancel this request?'
          : null;
    if (action && !confirm(action)) return;

    setBusyId(request.id);
    const response = await fetch('/api/delivery-requests', {
      method: 'PATCH',
      headers: await headers(),
      body: JSON.stringify({
        requestId: request.id,
        status,
        adminNotes: notes[request.id] || '',
      }),
    });
    const result = await response.json();
    setBusyId('');
    if (!response.ok) return alert(result.error || 'Could not update the request.');
    await load();
  };

  if (loading) {
    return <p className="rounded-2xl bg-white p-6 text-slate-500">Loading delivery requests…</p>;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-bold text-brand-primary">Handoff queue</p>
            <p className="mt-1 text-xs text-slate-500">
              Call the customer, confirm the arrangement, then complete the handoff.
            </p>
          </div>
          <p className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
            {counts.requested + counts.contacting + counts.confirmed} active
          </p>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {QUEUES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setQueue(item.key)}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${
                queue === item.key
                  ? 'bg-brand-primary text-white'
                  : 'border border-slate-200 text-slate-600'
              }`}
            >
              {item.label} {counts[item.key]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-400">Nothing in this queue.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((request) => {
            const pkg = request.shipping_packages;
            const date = new Date(`${request.preferred_date}T12:00:00`);
            return (
              <article key={request.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{pkg?.package_name || 'Package'}</p>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                          request.request_type === 'pickup'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-violet-50 text-violet-700'
                        }`}
                      >
                        {request.request_type === 'pickup' ? 'Pickup' : 'Delivery'}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {pkg?.tracking_id}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      {packageContents(pkg) || 'No package contents'}
                    </p>
                    {orderNumbers(pkg) ? (
                      <p className="mt-1 text-xs text-slate-400">Orders: {orderNumbers(pkg)}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-brand-light/60 px-4 py-3 text-right">
                    <p className="text-xs text-slate-500">Preferred day</p>
                    <p className="font-bold text-brand-primary">
                      {date.toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {request.preferred_time_window || 'Any time'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-400">Customer</p>
                    <p className="font-semibold text-slate-800">{request.customer_email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Call number</p>
                    <a
                      href={`tel:${request.phone}`}
                      className="font-bold text-brand-primary hover:underline"
                    >
                      {request.phone}
                    </a>
                  </div>
                  {request.request_type === 'delivery' ? (
                    <div>
                      <p className="text-xs text-slate-400">Deliver to</p>
                      <p className="font-semibold text-slate-800">
                        {request.delivery_address}, {request.city}, {request.region}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-400">Handoff</p>
                      <p className="font-semibold text-slate-800">Customer will collect</p>
                    </div>
                  )}
                </div>

                {request.notes ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Customer note: {request.notes}
                  </p>
                ) : null}

                {!['completed', 'cancelled'].includes(request.status) ? (
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <label className="min-w-64 flex-1 text-xs font-semibold text-slate-500">
                      Admin note
                      <input
                        value={notes[request.id] || ''}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        placeholder="Call outcome, rider, or agreed time"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                    {request.status === 'requested' ? (
                      <button
                        type="button"
                        onClick={() => void update(request, 'contacting')}
                        disabled={busyId === request.id}
                        className="rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Start calling
                      </button>
                    ) : null}
                    {['requested', 'contacting'].includes(request.status) ? (
                      <button
                        type="button"
                        onClick={() => void update(request, 'confirmed')}
                        disabled={busyId === request.id}
                        className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Confirm arrangement
                      </button>
                    ) : null}
                    {request.status === 'confirmed' ? (
                      <button
                        type="button"
                        onClick={() => void update(request, 'completed')}
                        disabled={busyId === request.id}
                        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {request.request_type === 'pickup'
                          ? 'Mark picked up'
                          : 'Mark delivered'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void update(request, 'cancelled')}
                      disabled={busyId === request.id}
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : request.admin_notes ? (
                  <p className="mt-3 text-xs text-slate-500">Admin note: {request.admin_notes}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
