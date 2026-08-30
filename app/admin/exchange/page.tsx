'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ShareBuyRmbRate from '@/components/admin/ShareBuyRmbRate';
import ProductRepriceModal from '@/components/admin/ProductRepriceModal';
import {
  EXCHANGE_CORRIDORS,
  EXCHANGE_COUNTRY_CODES,
  formatLocalMoney,
  normalizePayAccounts,
  type CorridorRateBoard,
  type ExchangeCountryCode,
} from '@/lib/exchange-corridors';
import type { BankAccount } from '@/lib/bank-details';
import { Plus, X } from 'lucide-react';
import type { ProductRepriceRow } from '@/lib/product-pricing';

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

const STATUS_STYLE: Record<string, string> = {
  awaiting_payment: 'bg-slate-100 text-slate-700',
  payment_sent: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-red-100 text-red-700',
};

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
  const [repriceOpen, setRepriceOpen] = useState(false);
  const [repriceChanges, setRepriceChanges] = useState<ProductRepriceRow[]>([]);
  const [pendingBuyRate, setPendingBuyRate] = useState<number | null>(null);

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
    const previousBuyRate = board?.buy_rmb_rate ?? null;
    const nextBuyRate = Number(form.buy_rmb_rate);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/exchange/rate', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          country: deskCountry,
          buy_rmb_rate: nextBuyRate,
          sell_rmb_rate: Number(form.sell_rmb_rate || form.buy_rmb_rate),
          min_amount: Number(form.min_amount),
          max_amount: form.max_amount ? Number(form.max_amount) : null,
          notes: form.notes || null,
          valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
          is_live: form.is_live,
          pay_accounts: normalizePayAccounts(accounts),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Save failed');
        return;
      }
      setBoards((prev) => ({ ...prev, [deskCountry]: data.board }));
      applyBoardToForm(data.board);

      if (
        deskCountry === 'GH' &&
        nextBuyRate > 0 &&
        previousBuyRate != null &&
        Math.abs(previousBuyRate - nextBuyRate) > 0.000001
      ) {
        const previewRes = await fetch(
          `/api/admin/products/rmb-reprice?buy_rmb_rate=${encodeURIComponent(String(nextBuyRate))}`,
          { headers },
        );
        const previewData = await previewRes.json();
        if (previewRes.ok && Array.isArray(previewData.changes) && previewData.changes.length > 0) {
          setPendingBuyRate(nextBuyRate);
          setRepriceChanges(previewData.changes);
          setRepriceOpen(true);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const setAccount = (idx: number, patch: Partial<AccountDraft>) => {
    setAccounts((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-primary">Buy RMB Desk</h1>
        <div className="flex gap-1.5">
          {EXCHANGE_COUNTRY_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setDeskCountry(code)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                deskCountry === code
                  ? 'bg-brand-primary text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {EXCHANGE_CORRIDORS[code].name}
              <span
                className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                  boards[code]?.is_live ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={saveRate} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-brand-primary">{meta.name}</h2>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.is_live}
              onChange={(e) => setForm({ ...form, is_live: e.target.checked })}
            />
            Live on website
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Rate (RMB per 1 {meta.unitLabel})
            <input
              value={form.buy_rmb_rate}
              onChange={(e) => setForm({ ...form, buy_rmb_rate: e.target.value })}
              className={fieldClass}
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Valid until
            <input
              type="datetime-local"
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              className={fieldClass}
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Receiving accounts</p>
            <button
              type="button"
              onClick={() => setAccounts((prev) => [...prev, emptyAccount()])}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {accounts.map((acc, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <select
                value={acc.channel}
                onChange={(e) =>
                  setAccount(idx, { channel: e.target.value === 'momo' ? 'momo' : 'bank' })
                }
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="bank">Bank</option>
                <option value="momo">MoMo</option>
              </select>
              <input
                value={acc.bank}
                onChange={(e) => setAccount(idx, { bank: e.target.value })}
                placeholder="Bank or network"
                className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={acc.accountNumber}
                onChange={(e) => setAccount(idx, { accountNumber: e.target.value })}
                placeholder="Account number"
                className="min-w-[9rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setAccounts((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded-lg p-2 text-slate-400 hover:text-red-600"
                aria-label="Remove account"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <details>
          <summary className="cursor-pointer list-none text-sm font-medium text-brand-primary">
            More settings
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Min {meta.unitLabel}
              <input
                value={form.min_amount}
                onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Max {meta.unitLabel}
              <input
                value={form.max_amount}
                onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Note shown to customers
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Leave empty for none"
                className={fieldClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Sell rate (legacy)
              <input
                value={form.sell_rmb_rate}
                onChange={(e) => setForm({ ...form, sell_rmb_rate: e.target.value })}
                className={fieldClass}
              />
            </label>
            {accounts.map((acc, idx) => (
              <div key={idx} className="grid gap-2 sm:col-span-2 sm:grid-cols-3">
                <input
                  value={acc.holder}
                  onChange={(e) => setAccount(idx, { holder: e.target.value })}
                  placeholder={`Holder ${idx + 1}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={acc.branch}
                  onChange={(e) => setAccount(idx, { branch: e.target.value })}
                  placeholder="Branch"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  value={acc.registeredName}
                  onChange={(e) => setAccount(idx, { registeredName: e.target.value })}
                  placeholder="Registered name"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Publish'}
          </button>
          {board?.updated_at ? (
            <p className="text-xs text-slate-400">
              Updated {new Date(board.updated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      </form>

      {deskCountry === 'GH' ? (
        <ShareBuyRmbRate
          buyRate={Number(form.buy_rmb_rate) || Number(board?.buy_rmb_rate) || 0}
          validUntil={
            form.valid_until ? new Date(form.valid_until).toISOString() : board?.valid_until || null
          }
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="font-bold text-brand-primary">Requests</h2>
          <div className="flex gap-1.5">
            {(['ALL', ...EXCHANGE_COUNTRY_CODES] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setListFilter(code)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  listFilter === code
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 ring-1 ring-slate-200'
                }`}
              >
                {code === 'ALL' ? 'All' : EXCHANGE_CORRIDORS[code].name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading…</p>
        ) : exchanges.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {exchanges.map((ex) => {
              const code = (ex.country_code || 'GH') as ExchangeCountryCode;
              const cMeta = EXCHANGE_CORRIDORS[code] || EXCHANGE_CORRIDORS.GH;
              const st = String(ex.status || '');
              return (
                <li key={ex.id}>
                  <Link
                    href={`/admin/exchange/${encodeURIComponent(ex.exchange_number)}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50"
                  >
                    <div className="min-w-[9rem] flex-1">
                      <p className="font-semibold text-slate-900">{ex.customer_name}</p>
                      <p className="text-xs text-slate-500">
                        {cMeta.name}. {ex.phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {formatLocalMoney(Number(ex.amount_from), code)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {Number(ex.amount_to).toFixed(2)} RMB
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!ex.has_alipay_qr ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          No QR
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          STATUS_STYLE[st] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {st.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ProductRepriceModal
        open={repriceOpen}
        buyRmbRate={pendingBuyRate ?? 0}
        changes={repriceChanges}
        onClose={() => setRepriceOpen(false)}
        onApplied={() => {
          setRepriceChanges([]);
          setPendingBuyRate(null);
        }}
        getAuthHeaders={authHeaders}
      />
    </div>
  );
}
