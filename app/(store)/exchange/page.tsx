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
import { Check, ShieldCheck, Upload } from 'lucide-react';

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
      setError('Upload a JPG, PNG, or WebP screenshot.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    setAlipayFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!ready.ok) {
      setError(ready.reason);
      return;
    }
    if (!alipayFile) {
      setError('Upload your Alipay receive QR first.');
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

      const res = await fetch('/api/exchange', { method: 'POST', headers, body });
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

  const inputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand-accent';

  return (
    <main className="min-h-screen bg-[#0B1F3A] text-white">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-accent">Buy RMB</p>
          <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">
            Pay locally. Get RMB on Alipay.
          </h1>
        </header>

        <div className="mt-6 flex gap-2">
          {EXCHANGE_COUNTRY_CODES.map((code) => {
            const open = corridorIsReady(boards[code]).ok;
            const selected = country === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setCountry(code);
                  setAmount('');
                  setError('');
                }}
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  selected
                    ? 'bg-white text-[#0B1F3A]'
                    : 'bg-white/10 text-white/80 hover:bg-white/15'
                }`}
              >
                {EXCHANGE_CORRIDORS[code].name}
                {!loading && open ? (
                  <span
                    className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                      selected ? 'bg-emerald-500' : 'bg-emerald-400'
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl bg-white/10 px-4 py-3">
          {loading ? (
            <p className="text-white/60">Loading rate…</p>
          ) : ready.ok ? (
            <>
              <p className="text-xl font-bold">
                {formatCorridorBuyRate(Number(board?.buy_rmb_rate), country)}
              </p>
              <p className="text-xs text-white/60">
                {board?.valid_until
                  ? `Valid until ${new Date(board.valid_until).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : `You pay ${meta.currencyLabel}`}
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-200">{ready.reason}</p>
          )}
        </div>

        {ready.ok && board?.notes ? (
          <p className="mt-2 px-1 text-xs text-white/60">{board.notes}</p>
        ) : null}

        <section className="mt-4 rounded-2xl bg-white p-5 text-slate-900 sm:p-6">
          {ready.ok ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold">Full name</span>
                <input
                  required
                  autoComplete="name"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Same name you pay with"
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold">Phone</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={meta.phoneExample}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">
                    Amount <span className="font-normal text-slate-400">({meta.unitLabel})</span>
                  </span>
                  <input
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} font-semibold`}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold">
                  Email <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="For payment and RMB sent updates"
                  className={inputClass}
                />
              </label>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">Alipay receive QR</span>
                  <span className="text-xs text-slate-400">Receive money code only</span>
                </div>
                <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 hover:border-brand-accent">
                  {alipayPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={alipayPreview}
                      alt="Your Alipay QR"
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <Upload className="h-5 w-5 shrink-0 text-brand-accent" />
                  )}
                  <span className="text-sm font-medium text-brand-primary">
                    {alipayFile ? 'Change QR screenshot' : 'Upload QR screenshot'}
                  </span>
                  {alipayFile ? (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-600" />
                  ) : null}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => onPickQr(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-brand-primary">
                  More details (optional)
                </summary>
                <div className="mt-3 space-y-4">
                  <label className="block">
                    <span className="text-sm font-semibold">Business name</span>
                    <input
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                      placeholder="If paying as a business"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold">Name shown on Alipay</span>
                    <input
                      value={form.alipayAccountName}
                      onChange={(e) => setForm({ ...form, alipayAccountName: e.target.value })}
                      placeholder="Helps us verify before sending"
                      className={inputClass}
                    />
                  </label>
                </div>
              </details>

              {quote ? (
                <div className="flex items-center justify-between rounded-xl bg-brand-light px-4 py-3 text-brand-primary">
                  <div>
                    <p className="text-xs uppercase tracking-wide opacity-70">You pay</p>
                    <p className="font-bold">{formatLocalMoney(quote.amountFrom, country)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide opacity-70">You get</p>
                    <p className="font-bold">{quote.amountTo.toFixed(2)} RMB</p>
                  </div>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-brand-accent py-3.5 text-base font-bold text-white disabled:opacity-50"
              >
                {submitting ? 'Creating invoice…' : 'Lock rate and get invoice'}
              </button>
              <p className="text-center text-xs text-slate-500">
                This creates an invoice. It is not a payment yet.
              </p>
            </form>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-600">
                {meta.name} is not open on the site yet. Message us and we will handle it directly.
              </p>
              <a
                href={buildWhatsAppHref(DEFAULT_CONTACT_WHATSAPP)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-[#25D366] py-3.5 text-base font-bold text-white"
              >
                WhatsApp Snappy
              </a>
            </div>
          )}
        </section>

        <div className="mt-4 flex items-start gap-2 text-xs text-white/60">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Pay only the {meta.name} accounts printed on your invoice.</p>
        </div>

        <details className="mt-6 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80">
          <summary className="cursor-pointer list-none font-semibold text-white">
            How it works
          </summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-white/70">
            <li>Upload your Alipay receive QR and lock the rate.</li>
            <li>Pay the invoice in {meta.payVerb} to the accounts shown.</li>
            <li>Tap I’ve paid once the money has left your account.</li>
            <li>We confirm, scan your QR, and send the RMB.</li>
          </ol>
        </details>

        <p className="mt-6 text-center text-sm">
          <Link href="/exchange/lookup" className="font-semibold text-brand-accent hover:underline">
            Already have a buy number? Open your invoice
          </Link>
        </p>
      </div>
    </main>
  );
}
