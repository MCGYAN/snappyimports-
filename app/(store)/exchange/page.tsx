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
  resolvePayAccounts,
  type CorridorRateBoard,
  type ExchangeCountryCode,
} from '@/lib/exchange-corridors';
import { ArrowRightLeft, Clock, ShieldCheck, Upload } from 'lucide-react';

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
  const payAccounts = resolvePayAccounts(board);

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
    <main className="min-h-screen bg-gradient-to-b from-[#0B1F3A] via-[#102a4a] to-[#0a1628] text-white">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-accent">Buy RMB</p>
        <h1 className="mt-3 font-heading text-3xl font-bold sm:text-5xl">
          Pay locally. Get RMB on Alipay.
        </h1>
        <p className="mt-4 max-w-2xl text-white/80">
          Choose your country first. Pay Snappy in that country’s currency. After we confirm your
          local payment, we send RMB to your Alipay receive QR.
        </p>

        <div className="mt-8">
          <p className="text-sm font-semibold text-white/90">1. Where are you paying from?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {EXCHANGE_COUNTRY_CODES.map((code) => {
              const c = EXCHANGE_CORRIDORS[code];
              const b = boards[code];
              const status = corridorIsReady(b);
              const selected = country === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleCountryChange(code)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    selected
                      ? 'border-brand-accent bg-brand-accent/20 ring-2 ring-brand-accent'
                      : 'border-white/15 bg-white/5 hover:border-white/40'
                  }`}
                >
                  <p className="font-bold text-white">{c.name}</p>
                  <p className="mt-1 text-xs text-white/70">You pay in {c.currencyLabel}</p>
                  <p className="mt-2 text-xs font-semibold">
                    {loading ? (
                      <span className="text-white/50">Checking…</span>
                    ) : status.ok ? (
                      <span className="text-emerald-300">Open now</span>
                    ) : (
                      <span className="text-amber-200">WhatsApp to buy</span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/55">
            One request = one country. Do not send {meta.name} money to another country’s accounts.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <div className="flex items-center gap-2 text-brand-accent">
              <ArrowRightLeft className="h-5 w-5" />
              <h2 className="text-lg font-bold">{meta.name} buy rate</h2>
            </div>
            {loading ? (
              <p className="mt-6 text-white/60">Loading…</p>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-black/20 p-4">
                  <p className="text-sm text-white/60">Official Snappy desk rate for {meta.name}</p>
                  <p className="text-3xl font-black text-white">
                    {board && Number(board.buy_rmb_rate) > 0
                      ? formatCorridorBuyRate(Number(board.buy_rmb_rate), country)
                      : 'Rate not published'}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    You pay {meta.currencyLabel}. You receive Chinese RMB on Alipay.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock className="h-4 w-4" />
                  {board?.valid_until
                    ? `This rate is valid until ${new Date(board.valid_until).toLocaleString('en-GB')}`
                    : ready.ok
                      ? 'Ask Snappy if you need a validity window'
                      : 'Waiting for today’s published rate'}
                </div>
                {!ready.ok ? (
                  <p className="text-sm text-amber-300">{ready.reason}</p>
                ) : null}
                {board?.notes ? <p className="text-sm text-white/60">{board.notes}</p> : null}

                <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white/75">
                  <p className="font-semibold text-white">What happens, in order</p>
                  <ol className="mt-2 list-decimal space-y-2 pl-4">
                    <li>Confirm you selected {meta.name}.</li>
                    <li>Upload your Alipay receive QR and lock today’s rate.</li>
                    <li>Pay the invoice in {meta.payVerb} to the {meta.name} accounts shown.</li>
                    <li>Tap I’ve paid only after the money has left your account.</li>
                    <li>We confirm your {meta.payVerb}, then scan your QR and send RMB.</li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                  <p className="font-semibold text-amber-100">Use the right Alipay QR</p>
                  <p className="mt-1.5 leading-relaxed text-amber-50/90">
                    Upload the QR that lets people send money to you (Receive / Collect). Do not
                    upload a shop payment QR or someone else’s QR.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
            <h2 className="text-xl font-bold text-brand-primary">
              2. Start your {meta.name} Buy RMB request
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              This creates your invoice for {meta.name} only. It does not charge your bank or phone
              by itself.
            </p>

            {ready.ok ? (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Full name</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Use the same name you will use when sending the {meta.name} payment.
                  </span>
                  <input
                    required
                    autoComplete="name"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="As it will appear on your transfer"
                    className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Business name (optional)</span>
                  <input
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Only if paying as a business"
                    className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">{meta.phoneHint}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Needed to reopen this invoice and reach you if Alipay name looks different.
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={meta.phoneExample}
                    className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Email (optional)</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    We email when local payment is confirmed and when RMB is sent.
                  </span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@email.com"
                    className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">
                    Amount you will pay ({meta.unitLabel})
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Enter {meta.payVerb}. We show the RMB you will receive before you lock.
                  </span>
                  <input
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Example amount in ${meta.unitLabel}`}
                    className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold"
                  />
                </label>

                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-brand-primary">
                    Alipay receive QR (required)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    This is where your RMB will go. Same for Ghana, Nigeria, and Tanzania.
                  </p>
                  <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-5 text-center hover:border-brand-accent/40">
                    <Upload className="h-5 w-5 text-brand-accent" />
                    <span className="text-sm font-semibold text-brand-primary">
                      {alipayFile ? 'Change QR screenshot' : 'Upload receive QR screenshot'}
                    </span>
                    <span className="text-xs text-slate-400">JPG, PNG, or WebP. Max 5MB.</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => onPickQr(e.target.files?.[0] || null)}
                    />
                  </label>
                  {alipayPreview ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={alipayPreview}
                        alt="Preview of the Alipay receive QR you uploaded"
                        className="mx-auto max-h-48 w-auto object-contain"
                      />
                    </div>
                  ) : null}
                  <label className="mt-3 block">
                    <span className="text-sm font-semibold text-slate-800">
                      Name shown on Alipay (optional)
                    </span>
                    <input
                      value={form.alipayAccountName}
                      onChange={(e) => setForm({ ...form, alipayAccountName: e.target.value })}
                      placeholder="As it appears in Alipay"
                      className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
                    />
                  </label>
                </div>

                {quote ? (
                  <div className="rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-primary">
                    <p className="font-semibold">If you lock now ({meta.name})</p>
                    <p className="mt-1">
                      You will pay:{' '}
                      <strong>{formatLocalMoney(quote.amountFrom, country)}</strong>
                    </p>
                    <p>
                      You will receive: <strong>{quote.amountTo.toFixed(2)} RMB</strong> on Alipay
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      Locked rate: {formatCorridorBuyRate(quote.rate, country, 4)}. RMB is sent only
                      after we confirm your {meta.payVerb}.
                    </p>
                  </div>
                ) : null}

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-brand-accent py-4 text-lg font-bold text-white disabled:opacity-50"
                >
                  {submitting
                    ? 'Creating your invoice…'
                    : quote
                      ? `Lock ${meta.name} rate and open invoice for ${formatLocalMoney(quote.amountFrom, country)}`
                      : `Lock ${meta.name} rate and open invoice`}
                </button>
                <p className="text-center text-xs leading-relaxed text-slate-500">
                  Next page is your {meta.name} invoice. Pay only those accounts. Uploading your QR
                  or locking the rate is not a payment.
                </p>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {ready.ok === false ? ready.reason : 'This country is not open yet.'}
                </p>
                <a
                  href={buildWhatsAppHref(DEFAULT_CONTACT_WHATSAPP)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-xl bg-[#25D366] py-4 text-center text-lg font-bold text-white hover:brightness-105"
                >
                  WhatsApp Snappy for {meta.name} Buy RMB
                </a>
              </div>
            )}

            <div className="mt-6 flex items-start gap-2 text-xs text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              <p>
                Pay only the {meta.name} accounts printed on your invoice under Snappy Sampson
                Enterprise. Do not send to another country’s accounts for this request.
              </p>
            </div>
            {payAccounts.length ? (
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p className="font-medium text-slate-500">
                  Usual {meta.name} accounts (confirm on invoice):
                </p>
                {payAccounts.map((a) => (
                  <p key={`${a.bank}-${a.accountNumber}`}>
                    {a.bank}: {a.accountNumber}
                  </p>
                ))}
              </div>
            ) : null}
            <p className="mt-4 text-sm">
              <Link href="/exchange/lookup" className="font-semibold text-brand-primary hover:underline">
                Already have a buy number? Open your invoice
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
