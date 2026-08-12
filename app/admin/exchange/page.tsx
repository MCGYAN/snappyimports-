'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { resolvePaymentReference } from '@/lib/payment-reference';
import ShareBuyRmbRate from '@/components/admin/ShareBuyRmbRate';
import {
  EXCHANGE_CORRIDORS,
  EXCHANGE_COUNTRY_CODES,
  formatLocalMoney,
  normalizePayAccounts,
  type CorridorRateBoard,
  type ExchangeCountryCode,
} from '@/lib/exchange-corridors';
import type { BankAccount } from '@/lib/bank-details';

type AccountDraft = {
  holder: string;
  bank: string;
  accountNumber: string;
  branch: string;
  registeredName: string;
  channel: 'bank' | 'momo';
};

const emptyAccount = (): AccountDraft => ({
  holder: 'Snappy Sampson Enterprise',
  bank: '',
  accountNumber: '',
  branch: '',
  registeredName: '',
  channel: 'bank',
});

function toDrafts(accounts: BankAccount[]): AccountDraft[] {
  if (!accounts.length) return [emptyAccount()];
  return accounts.map((a) => ({
    holder: a.holder || 'Snappy Sampson Enterprise',
    bank: a.bank || '',
    accountNumber: a.accountNumber || '',
    branch: a.branch || '',
    registeredName: a.registeredName || '',
    channel: a.channel === 'momo' ? 'momo' : 'bank',
  }));
}

export default function AdminExchangePage() {
  const [boards, setBoards] = useState<Partial<Record<ExchangeCountryCode, CorridorRateBoard>>>({});
  const [deskCountry, setDeskCountry] = useState<ExchangeCountryCode>('GH');
  const [listFilter, setListFilter] = useState<'ALL' | ExchangeCountryCode>('ALL');
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    buy_rmb_rate: '',
    sell_rmb_rate: '',
    min_amount: '',
    max_amount: '',
    notes: '',
    valid_until: '',
    is_live: false,
  });
  const [accounts, setAccounts] = useState<AccountDraft[]>([emptyAccount()]);

  const meta = EXCHANGE_CORRIDORS[deskCountry];
  const board = boards[deskCountry];

  const authHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  };

  const applyBoardToForm = (b: CorridorRateBoard | undefined) => {
    if (!b) {
      setForm({
        buy_rmb_rate: '',
        sell_rmb_rate: '',
        min_amount: '100',
        max_amount: '',
        notes: '',
        valid_until: '',
        is_live: false,
      });
      setAccounts([emptyAccount()]);
      return;
    }
    setForm({
      buy_rmb_rate: String(b.buy_rmb_rate ?? ''),
      sell_rmb_rate: String(b.sell_rmb_rate ?? ''),
      min_amount: String(b.min_amount ?? 100),
      max_amount: b.max_amount != null ? String(b.max_amount) : '',
      notes: b.notes || '',
      valid_until: b.valid_until ? new Date(b.valid_until).toISOString().slice(0, 16) : '',
      is_live: Boolean(b.is_live),
    });
    setAccounts(toDrafts(b.pay_accounts || []));
  };

  const load = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const countryQs = listFilter === 'ALL' ? '' : `&country=${listFilter}`;
      const [rateRes, listRes] = await Promise.all([
        fetch('/api/exchange/rate?all=1'),
        fetch(`/api/exchange?admin=1${countryQs}`, { headers }),
      ]);
      const rateData = await rateRes.json();
      const listData = await listRes.json();
      const next: Partial<Record<ExchangeCountryCode, CorridorRateBoard>> = {};
      for (const b of rateData.boards || []) {
        if (b?.country_code) next[b.country_code as ExchangeCountryCode] = b;
      }
      setBoards(next);
      applyBoardToForm(next[deskCountry]);
      setExchanges(listData.exchanges || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listFilter]);

  useEffect(() => {
    applyBoardToForm(boards[deskCountry]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deskCountry]);

  const saveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const headers = await authHeaders();
      const pay_accounts = normalizePayAccounts(accounts);
      const res = await fetch('/api/exchange/rate', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          country: deskCountry,
          buy_rmb_rate: Number(form.buy_rmb_rate),
          sell_rmb_rate: Number(form.sell_rmb_rate || form.buy_rmb_rate),
          min_amount: Number(form.min_amount),
          max_amount: form.max_amount ? Number(form.max_amount) : null,
          notes: form.notes || null,
          valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
          is_live: form.is_live,
          pay_accounts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Save failed');
        return;
      }
      setBoards((prev) => ({ ...prev, [deskCountry]: data.board }));
      applyBoardToForm(data.board);
      alert(`${meta.name} corridor updated`);
    } finally {
      setSaving(false);
    }
  };

  const liveSummary = useMemo(
    () =>
      EXCHANGE_COUNTRY_CODES.map((code) => {
        const b = boards[code];
        return `${EXCHANGE_CORRIDORS[code].name}: ${b?.is_live ? 'Live' : 'Off'}`;
      }).join('. '),
    [boards],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Buy RMB Desk</h1>
        <p className="text-sm text-slate-500">
          Three pay-in countries. One Alipay send flow. Publish rate and accounts per country, then
          open a request to confirm local money and scan the QR.
        </p>
        <p className="mt-1 text-xs text-slate-400">{liveSummary}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXCHANGE_COUNTRY_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setDeskCountry(code)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              deskCountry === code
                ? 'bg-brand-primary text-white'
                : 'border border-slate-200 bg-white text-brand-primary'
            }`}
          >
            {EXCHANGE_CORRIDORS[code].name}
            {boards[code]?.is_live ? ' (live)' : ''}
          </button>
        ))}
      </div>

      {deskCountry === 'GH' ? (
        <ShareBuyRmbRate
          buyRate={Number(form.buy_rmb_rate) || Number(board?.buy_rmb_rate) || 0}
          validUntil={
            form.valid_until
              ? new Date(form.valid_until).toISOString()
              : board?.valid_until || null
          }
        />
      ) : null}

      <form
        onSubmit={saveRate}
        className="max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-lg font-bold">{meta.name} rate and pay-in accounts</h2>
        <p className="text-sm text-slate-500">
          Customers paying from {meta.name} see only this rate and these accounts. Turn live only
          when both rate and accounts are ready.
        </p>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_live}
            onChange={(e) => setForm({ ...form, is_live: e.target.checked })}
          />
          <span>
            <strong>{meta.name} is live on the website</strong>
            <span className="block text-xs text-slate-500">
              Off means customers see WhatsApp instead of the lock form.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Buy rate (RMB per 1 {meta.unitLabel})
            <input
              value={form.buy_rmb_rate}
              onChange={(e) => setForm({ ...form, buy_rmb_rate: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </label>
          <label className="text-sm">
            Sell rate (optional / legacy)
            <input
              value={form.sell_rmb_rate}
              onChange={(e) => setForm({ ...form, sell_rmb_rate: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Min {meta.unitLabel}
            <input
              value={form.min_amount}
              onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Max {meta.unitLabel} (optional)
            <input
              value={form.max_amount}
              onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
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
            Notes (shown to customers)
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-brand-primary">{meta.name} receiving accounts</h3>
            <button
              type="button"
              onClick={() => setAccounts((prev) => [...prev, emptyAccount()])}
              className="text-sm font-semibold text-brand-primary hover:underline"
            >
              Add account
            </button>
          </div>
          {accounts.map((acc, idx) => (
            <div key={idx} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              <input
                value={acc.bank}
                onChange={(e) => {
                  const next = [...accounts];
                  next[idx] = { ...next[idx], bank: e.target.value };
                  setAccounts(next);
                }}
                placeholder="Bank or MoMo network"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                value={acc.accountNumber}
                onChange={(e) => {
                  const next = [...accounts];
                  next[idx] = { ...next[idx], accountNumber: e.target.value };
                  setAccounts(next);
                }}
                placeholder="Account / wallet number"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                value={acc.holder}
                onChange={(e) => {
                  const next = [...accounts];
                  next[idx] = { ...next[idx], holder: e.target.value };
                  setAccounts(next);
                }}
                placeholder="Account holder"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={acc.channel}
                onChange={(e) => {
                  const next = [...accounts];
                  next[idx] = {
                    ...next[idx],
                    channel: e.target.value === 'momo' ? 'momo' : 'bank',
                  };
                  setAccounts(next);
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="bank">Bank</option>
                <option value="momo">Mobile money</option>
              </select>
              <input
                value={acc.branch}
                onChange={(e) => {
                  const next = [...accounts];
                  next[idx] = { ...next[idx], branch: e.target.value };
                  setAccounts(next);
                }}
                placeholder="Branch (optional)"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                value={acc.registeredName}
                onChange={(e) => {
                  const next = [...accounts];
                  next[idx] = { ...next[idx], registeredName: e.target.value };
                  setAccounts(next);
                }}
                placeholder="Registered name (optional)"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setAccounts((prev) => prev.filter((_, i) => i !== idx))}
                className="text-left text-xs font-semibold text-red-600 sm:col-span-2"
              >
                Remove account
              </button>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-primary px-5 py-2.5 font-bold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : `Publish ${meta.name} corridor`}
        </button>
        {board?.updated_at ? (
          <p className="text-xs text-slate-400">
            Last updated {new Date(board.updated_at).toLocaleString()}
          </p>
        ) : null}
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <h2 className="text-lg font-bold">Exchange requests</h2>
          <div className="flex flex-wrap gap-2">
            {(['ALL', ...EXCHANGE_COUNTRY_CODES] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setListFilter(code)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  listFilter === code
                    ? 'bg-brand-primary text-white'
                    : 'border border-slate-200 text-slate-600'
                }`}
              >
                {code === 'ALL' ? 'All' : EXCHANGE_CORRIDORS[code].name}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500">Loading…</p>
        ) : exchanges.length === 0 ? (
          <p className="p-6 text-slate-500">No exchange requests yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {exchanges.map((ex) => {
                const code = (ex.country_code || 'GH') as ExchangeCountryCode;
                const cMeta = EXCHANGE_CORRIDORS[code] || EXCHANGE_CORRIDORS.GH;
                return (
                  <li key={ex.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-primary">{ex.customer_name}</p>
                        <p className="text-xs text-slate-500">
                          {cMeta.name}. {ex.phone}
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-brand-primary">
                          {resolvePaymentReference(ex.metadata?.payment_ref, ex.exchange_number)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-slate-900">
                          {formatLocalMoney(Number(ex.amount_from), code)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {Number(ex.amount_to).toFixed(2)} RMB
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/admin/exchange/${encodeURIComponent(ex.exchange_number)}`}
                      className="mt-3 block w-full rounded-xl border border-brand-primary py-3 text-center text-sm font-bold text-brand-primary"
                    >
                      Open invoice + QR
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">Exchange</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Deal</th>
                    <th className="px-4 py-3">QR</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exchanges.map((ex) => {
                    const code = (ex.country_code || 'GH') as ExchangeCountryCode;
                    const cMeta = EXCHANGE_CORRIDORS[code] || EXCHANGE_CORRIDORS.GH;
                    return (
                      <tr key={ex.id} className="border-t">
                        <td className="px-4 py-3 font-semibold">{cMeta.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{ex.exchange_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{ex.customer_name}</p>
                          <p className="text-xs text-slate-500">{ex.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          {formatLocalMoney(Number(ex.amount_from), code)} →{' '}
                          {Number(ex.amount_to).toFixed(2)} RMB
                        </td>
                        <td className="px-4 py-3">
                          {ex.has_alipay_qr ? (
                            <span className="text-xs font-semibold text-green-700">Ready</span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-700">Missing</span>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {String(ex.status || '').replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/exchange/${encodeURIComponent(ex.exchange_number)}`}
                            className="rounded-lg border border-brand-primary px-3 py-1.5 text-xs font-bold text-brand-primary"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
