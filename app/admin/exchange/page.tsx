'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resolvePaymentReference } from '@/lib/payment-reference';
import ShareBuyRmbRate from '@/components/admin/ShareBuyRmbRate';

export default function AdminExchangePage() {
  const [board, setBoard] = useState<any>(null);
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    buy_rmb_rate: '0.57',
    sell_rmb_rate: '0.59',
    min_amount_ghs: '100',
    max_amount_ghs: '',
    notes: '',
    valid_until: '',
  });

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  };

  const load = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const [rateRes, listRes] = await Promise.all([
        fetch('/api/exchange/rate'),
        fetch('/api/exchange?admin=1', { headers }),
      ]);
      const rateData = await rateRes.json();
      const listData = await listRes.json();
      if (rateData.board) {
        setBoard(rateData.board);
        setForm({
          buy_rmb_rate: String(rateData.board.buy_rmb_rate ?? ''),
          sell_rmb_rate: String(rateData.board.sell_rmb_rate ?? ''),
          min_amount_ghs: String(rateData.board.min_amount_ghs ?? 100),
          max_amount_ghs: rateData.board.max_amount_ghs != null ? String(rateData.board.max_amount_ghs) : '',
          notes: rateData.board.notes || '',
          valid_until: rateData.board.valid_until
            ? new Date(rateData.board.valid_until).toISOString().slice(0, 16)
            : '',
        });
      }
      setExchanges(listData.exchanges || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/exchange/rate', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          buy_rmb_rate: Number(form.buy_rmb_rate),
          sell_rmb_rate: Number(form.sell_rmb_rate),
          min_amount_ghs: Number(form.min_amount_ghs),
          max_amount_ghs: form.max_amount_ghs ? Number(form.max_amount_ghs) : null,
          notes: form.notes || null,
          valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Save failed');
        return;
      }
      setBoard(data.board);
      alert('Rate board updated');
    } finally {
      setSaving(false);
    }
  };

  const act = async (exchangeNumber: string, action: 'confirm' | 'complete') => {
    const headers = await authHeaders();
    const res = await fetch('/api/exchange/action', {
      method: 'POST',
      headers,
      body: JSON.stringify({ exchangeNumber, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed');
      return;
    }
    await load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Buy RMB Desk</h1>
        <p className="text-sm text-slate-500">
          When cedis land in your bank or MoMo, click Confirm payment. After you send the RMB, click Mark RMB sent.
        </p>
      </div>

      <ShareBuyRmbRate
        buyRate={Number(form.buy_rmb_rate) || Number(board?.buy_rmb_rate) || 0}
        validUntil={
          form.valid_until
            ? new Date(form.valid_until).toISOString()
            : board?.valid_until || null
        }
      />

      <form onSubmit={saveRate} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 max-w-2xl">
        <h2 className="font-bold text-lg">Today’s rate board</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Buy rate (RMB per 1 GH¢)
            <input
              value={form.buy_rmb_rate}
              onChange={(e) => setForm({ ...form, buy_rmb_rate: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            Sell rate (RMB per 1 GH¢, optional / legacy)
            <input
              value={form.sell_rmb_rate}
              onChange={(e) => setForm({ ...form, sell_rmb_rate: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            Min GHS
            <input
              value={form.min_amount_ghs}
              onChange={(e) => setForm({ ...form, min_amount_ghs: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Max GHS (optional)
            <input
              value={form.max_amount_ghs}
              onChange={(e) => setForm({ ...form, max_amount_ghs: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Valid until
            <input
              type="datetime-local"
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-primary px-5 py-2.5 font-bold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Publish rate'}
        </button>
        {board?.updated_at ? (
          <p className="text-xs text-slate-400">Last updated {new Date(board.updated_at).toLocaleString()}</p>
        ) : null}
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="font-bold text-lg">Exchange requests</h2>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500">Loading…</p>
        ) : exchanges.length === 0 ? (
          <p className="p-6 text-slate-500">No exchange requests yet.</p>
        ) : (
          <>
          {/* Mobile: request cards, actions always in reach */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {exchanges.map((ex) => {
              const canConfirm =
                ['awaiting_payment', 'payment_sent'].includes(ex.status) ||
                ex.payment_status === 'awaiting_confirmation' ||
                ex.payment_status === 'pending';
              return (
                <li key={ex.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-primary">{ex.customer_name}</p>
                      <p className="text-xs text-slate-500">{ex.phone}</p>
                      <p className="mt-1 font-mono text-sm font-bold text-brand-primary">
                        {resolvePaymentReference(ex.metadata?.payment_ref, ex.exchange_number)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">
                        GH¢{Number(ex.amount_from).toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">{Number(ex.amount_to).toFixed(2)} RMB</p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {String(ex.status || '').replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    {canConfirm ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !confirm(
                              `Confirm payment received: GH¢${Number(ex.amount_from).toFixed(2)} for ${ex.exchange_number}?`,
                            )
                          ) {
                            return;
                          }
                          act(ex.exchange_number, 'confirm');
                        }}
                        className="w-full rounded-xl bg-brand-primary py-3 text-sm font-bold text-white"
                      >
                        Confirm payment
                      </button>
                    ) : ex.status === 'confirmed' ? (
                      <button
                        type="button"
                        onClick={() => act(ex.exchange_number, 'complete')}
                        className="w-full rounded-xl bg-brand-accent py-3 text-sm font-bold text-white"
                      >
                        Mark RMB sent
                      </button>
                    ) : ex.status === 'completed' ? (
                      <p className="text-center text-sm font-semibold text-green-700">Done</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Exchange</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Deal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exchanges.map((ex) => (
                  <tr key={ex.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{ex.exchange_number}</td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-brand-primary">
                      {resolvePaymentReference(ex.metadata?.payment_ref, ex.exchange_number)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{ex.customer_name}</p>
                      <p className="text-xs text-slate-500">{ex.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      {Number(ex.amount_from).toFixed(2)} {ex.currency_from} →{' '}
                      {Number(ex.amount_to).toFixed(2)} {ex.currency_to}
                    </td>
                    <td className="px-4 py-3 capitalize">{String(ex.status || '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                      {['awaiting_payment', 'payment_sent'].includes(ex.status) ||
                      ex.payment_status === 'awaiting_confirmation' ||
                      ex.payment_status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !confirm(
                                `Confirm payment received: GH¢${Number(ex.amount_from).toFixed(2)} for ${ex.exchange_number}?`,
                              )
                            ) {
                              return;
                            }
                            act(ex.exchange_number, 'confirm');
                          }}
                          className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Confirm payment
                        </button>
                      ) : null}
                      {ex.status === 'confirmed' ? (
                        <button
                          type="button"
                          onClick={() => act(ex.exchange_number, 'complete')}
                          className="rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Mark RMB sent
                        </button>
                      ) : null}
                      {ex.status === 'completed' ? (
                        <span className="text-xs font-semibold text-green-700">Done</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
