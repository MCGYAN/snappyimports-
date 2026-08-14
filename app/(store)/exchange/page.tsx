'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildWhatsAppHref, DEFAULT_CONTACT_WHATSAPP } from '@/lib/snappy-import';
import { supabase } from '@/lib/supabase';
import {
  corridorIsReady,
  EXCHANGE_CORRIDORS,
  EXCHANGE_COUNTRY_CODES,
  formatCorridorBuyRate,
  formatLocalMoney,
  quoteLocalToRmb,
  type CorridorRateBoard,
  type ExchangeCountryCode,
} from '@/lib/exchange-corridors';
import { Check, Upload } from 'lucide-react';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-primary';

const labelClass = 'text-[13px] font-medium text-slate-600';

export default function ExchangePage() {
  const router = useRouter();
  const [country, setCountry] = useState<ExchangeCountryCode>('GH');
  const [boards, setBoards] = useState<Partial<Record<ExchangeCountryCode, CorridorRateBoard>>>({});
  const [amount, setAmount] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    businessName: '',
    alipayAccountName: '',
  });
  const [alipayFile, setAlipayFile] = useState<File | null>(null);
  const [alipayPreview, setAlipayPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const board = boards[country] || null;
  const meta = EXCHANGE_CORRIDORS[country];
  const ready = corridorIsReady(board);

  useEffect(() => {
    fetch('/api/exchange/rate?all=1')
      .then((r) => r.json())
      .then((d) => {
        const next: Partial<Record<ExchangeCountryCode, CorridorRateBoard>> = {};
        for (const b of (d.boards || []) as CorridorRateBoard[]) {
          if (b?.country_code && EXCHANGE_COUNTRY_CODES.includes(b.country_code)) {
            next[b.country_code] = b;
          }
        }
        const fallback = d.board as CorridorRateBoard | undefined;
        if (
          fallback?.country_code &&
          EXCHANGE_COUNTRY_CODES.includes(fallback.country_code) &&
          !next[fallback.country_code]
        ) {
          next[fallback.country_code] = fallback;
        }
        setBoards(next);
      })
      .catch(() => setError('Could not load today’s rates'))
      .finally(() => setLoading(false));

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accountEmail = session?.user?.email?.trim();
      if (accountEmail) {
        setForm((prev) => (prev.email ? prev : { ...prev, email: accountEmail }));
      }
    })();
  }, []);

  useEffect(() => {
    if (!alipayFile) {
      setAlipayPreview(null);
      return;
    }
    const url = URL.createObjectURL(alipayFile);
    setAlipayPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [alipayFile]);

  const quote = useMemo(() => {
    const n = Number(amount);
    if (!board || !Number.isFinite(n) || n <= 0) return null;
    return quoteLocalToRmb(n, Number(board.buy_rmb_rate), country);
  }, [amount, board, country]);

  const onPickQr = (file: File | null) => {
    setError('');
    if (!file) {
      setAlipayFile(null);
      return;
    }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Upload a JPG, PNG, or WebP screenshot of your Alipay receive QR.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    setAlipayFile(file);
  };

  const handleCountryChange = (code: ExchangeCountryCode) => {
    setCountry(code);
    setAmount('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!ready.ok) {
      setError(ready.reason);
      return;
    }
    if (!alipayFile) {
      setError('Upload your Alipay receive QR screenshot before locking the rate.');
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const body = new FormData();
      body.set('country', country);
      body.set('customerName', form.customerName);
      body.set('phone', form.phone);
      body.set('email', form.email);
      body.set('businessName', form.businessName);
      body.set('alipayAccountName', form.alipayAccountName);
      body.set('amount', String(Number(amount)));
      body.set('alipayQr', alipayFile);

      const res = await fetch('/api/exchange', {
        method: 'POST',
        headers,
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create buy request');
        return;
      }
      router.push(
        `/exchange/${encodeURIComponent(data.exchange.exchange_number)}?phone=${encodeURIComponent(form.phone)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent">
            Buy RMB
          </p>
          <h1 className="mt-2 font-heading text-[28px] font-bold leading-tight text-brand-primary sm:text-4xl">
            Pay locally. Get RMB on Alipay.
          </h1>
          <p className="mt-2 text-[15px] text-slate-500">
            Pay Snappy in your country. We send RMB after your payment is confirmed.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {EXCHANGE_COUNTRY_CODES.map((code) => {
            const c = EXCHANGE_CORRIDORS[code];
            const open = corridorIsReady(boards[code]).ok;
            const selected = country === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => handleCountryChange(code)}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  selected ? 'bg-brand-primary text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.name}
                {!loading && !open ? (
                  <span className={`ml-1 text-[11px] ${selected ? 'text-white/70' : 'text-slate-400'}`}>
                    soon
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-2xl font-bold tracking-tight text-brand-primary sm:text-[28px]">
              {loading
                ? 'Loading rate'
                : board && Number(board.buy_rmb_rate) > 0
                  ? formatCorridorBuyRate(Number(board.buy_rmb_rate), country)
                  : 'Rate not published'}
            </p>
            {board?.valid_until && ready.ok ? (
              <p className="text-xs text-slate-400">
                Valid until {new Date(board.valid_until).toLocaleString('en-GB')}
              </p>
            ) : null}
          </div>
          {board?.notes && ready.ok ? (
            <p className="mt-1.5 text-sm text-slate-500">{board.notes}</p>
          ) : null}

          {ready.ok ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className={labelClass} htmlFor="ex-amount">
                  You pay ({meta.unitLabel})
                </label>
                <input
                  id="ex-amount"
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} text-lg font-semibold`}
                />
                {quote ? (
                  <p className="mt-2 text-sm text-slate-600">
                    You receive{' '}
                    <span className="font-semibold text-brand-primary">
                      {quote.amountTo.toFixed(2)} RMB
                    </span>{' '}
                    for {formatLocalMoney(quote.amountFrom, country)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="ex-name">
                    Full name
                  </label>
                  <input
                    id="ex-name"
                    required
                    autoComplete="name"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="Name on your transfer"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ex-phone">
                    WhatsApp number
                  </label>
                  <input
                    id="ex-phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={meta.phoneExample}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ex-email">
                    Email <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="ex-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@email.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ex-business">
                    Business <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="ex-business"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Company name"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Alipay receive QR</label>
                <label
                  className={`mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3.5 py-3 transition ${
                    alipayFile
                      ? 'border-emerald-300 bg-emerald-50/60'
                      : 'border-slate-300 bg-slate-50 hover:border-brand-accent/50'
                  }`}
                >
                  {alipayFile ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Upload className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="text-sm text-slate-600">
                    {alipayFile ? 'QR added. Tap to change' : 'Upload your receive QR screenshot'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => onPickQr(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="mt-1.5 text-xs text-slate-400">
                  Use the Receive or Collect QR from Alipay, not a shop payment code.
                </p>
                {alipayPreview ? (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={alipayPreview}
                      alt="Preview of the Alipay receive QR you uploaded"
                      className="mx-auto max-h-40 w-auto object-contain"
                    />
                  </div>
                ) : null}
                <input
                  value={form.alipayAccountName}
                  onChange={(e) => setForm({ ...form, alipayAccountName: e.target.value })}
                  placeholder="Name shown on Alipay (optional)"
                  className={inputClass}
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-accent py-3.5 text-base font-bold text-white transition hover:brightness-105 disabled:opacity-50"
              >
                {submitting
                  ? 'Creating invoice…'
                  : quote
                    ? `Lock rate. Get invoice for ${formatLocalMoney(quote.amountFrom, country)}`
                    : 'Lock rate and get invoice'}
              </button>
              <p className="text-center text-xs text-slate-400">
                This creates an invoice only. Nothing is charged yet.
              </p>
            </form>
          ) : (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-slate-500">{ready.reason}</p>
              <a
                href={buildWhatsAppHref(DEFAULT_CONTACT_WHATSAPP)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-[#25D366] py-3.5 text-center text-base font-bold text-white hover:brightness-105"
              >
                WhatsApp us for {meta.name}
              </a>
            </div>
          )}
        </section>

        <details className="group mt-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-200">
          <summary className="cursor-pointer list-none text-sm font-semibold text-brand-primary">
            How it works
            <span className="ml-1 font-normal text-slate-400 group-open:hidden">(5 steps)</span>
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
            <li>Pick your country and enter the amount.</li>
            <li>Upload your Alipay receive QR and lock the rate.</li>
            <li>Pay the invoice to the {meta.name} accounts shown on it.</li>
            <li>Tap I’ve paid once the money has left your account.</li>
            <li>We confirm, scan your QR, and send the RMB.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-400">
            Pay only the accounts printed on your invoice. One request covers one country.
          </p>
        </details>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/exchange/lookup" className="font-medium text-brand-primary hover:underline">
            Already have a buy number? Open your invoice
          </Link>
        </p>
      </div>
    </main>
  );
}
