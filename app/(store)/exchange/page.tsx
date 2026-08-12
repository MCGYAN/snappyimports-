'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SNAPPY_BANK_ACCOUNTS } from '@/lib/bank-details';
import { buildWhatsAppHref, DEFAULT_CONTACT_WHATSAPP } from '@/lib/snappy-import';
import { isRateValid, quoteGhsToRmb, formatBuyRate, type ExchangeRateBoard } from '@/lib/rmb-exchange';
import { supabase } from '@/lib/supabase';
import { ArrowRightLeft, Clock, ShieldCheck, Upload } from 'lucide-react';

export default function ExchangePage() {
  const router = useRouter();
  const [board, setBoard] = useState<ExchangeRateBoard | null>(null);
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

  useEffect(() => {
    fetch('/api/exchange/rate')
      .then((r) => r.json())
      .then((d) => setBoard(d.board))
      .catch(() => setError('Could not load today’s rate'))
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
    return quoteGhsToRmb(n, Number(board.buy_rmb_rate));
  }, [amount, board]);

  const rateOk = isRateValid(board);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
          Pay cedis. Get RMB in China.
        </h1>
        <p className="mt-4 max-w-2xl text-white/80">
          Lock today’s rate, upload your Alipay receive QR, get an invoice, pay by bank or MoMo, then
          we send your RMB after we confirm payment.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <div className="flex items-center gap-2 text-brand-accent">
              <ArrowRightLeft className="h-5 w-5" />
              <h2 className="text-lg font-bold">Today’s buy rate</h2>
            </div>
            {loading ? (
              <p className="mt-6 text-white/60">Loading…</p>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-black/20 p-4">
                  <p className="text-sm text-white/60">You pay Ghana Cedis. You receive RMB.</p>
                  <p className="text-3xl font-black text-white">
                    {formatBuyRate(Number(board?.buy_rmb_rate || 0))}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock className="h-4 w-4" />
                  {board?.valid_until
                    ? `Valid until ${new Date(board.valid_until).toLocaleString('en-GB')}`
                    : 'Ask admin to set a validity window'}
                </div>
                {!rateOk ? (
                  <p className="text-sm text-amber-300">Rate expired. WhatsApp Snappy for an update.</p>
                ) : null}
                {board?.notes ? <p className="text-sm text-white/60">{board.notes}</p> : null}

                <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white/75">
                  <p className="font-semibold text-white">How Alipay works here</p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                    <li>Open Alipay and your receive money QR.</li>
                    <li>Screenshot or save that QR.</li>
                    <li>Upload it below so Snappy can scan and send your RMB.</li>
                  </ol>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
            <h2 className="text-xl font-bold text-brand-primary">Buy RMB</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter cedis amount and your Alipay receive QR. Then get the invoice and pay Snappy.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <input
                required
                autoComplete="name"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Full name (same name as on payment)"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
              />
              <input
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="Business name (optional)"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
              />
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="WhatsApp / phone"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
              />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email (optional). Use your account email for Order history"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
              />
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in GH¢"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold"
              />

              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-brand-primary">Alipay receive QR</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Required. Screenshot your Alipay receive QR (not the pay-at-shop code).
                </p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-5 text-center hover:border-brand-accent/40">
                  <Upload className="h-5 w-5 text-brand-accent" />
                  <span className="text-sm font-semibold text-brand-primary">
                    {alipayFile ? 'Change QR image' : 'Upload QR screenshot'}
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
                      alt="Alipay QR preview"
                      className="mx-auto max-h-48 w-auto object-contain"
                    />
                  </div>
                ) : null}
                <input
                  value={form.alipayAccountName}
                  onChange={(e) => setForm({ ...form, alipayAccountName: e.target.value })}
                  placeholder="Name shown on your Alipay (optional, helps us verify)"
                  className="mt-3 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm"
                />
              </div>

              {quote ? (
                <div className="rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-primary">
                  <p>
                    You pay: <strong>GH¢{quote.amountFrom.toFixed(2)}</strong>
                  </p>
                  <p>
                    You get: <strong>{quote.amountTo.toFixed(2)} RMB</strong>
                  </p>
                  <p className="text-xs opacity-80">Rate lock: {formatBuyRate(quote.rate, 4)}</p>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              {rateOk ? (
                <>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-brand-accent py-4 text-lg font-bold text-white disabled:opacity-50"
                  >
                    {submitting
                      ? 'Getting your invoice…'
                      : quote
                        ? `Lock rate. Get invoice and pay GH¢${quote.amountFrom.toFixed(2)}`
                        : 'Lock today’s rate. Get invoice and pay'}
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    You’ll get the invoice now. Pay by bank or MoMo, then tap I’ve paid. We send RMB
                    to your Alipay after confirming your cedis.
                  </p>
                </>
              ) : (
                <a
                  href={buildWhatsAppHref(DEFAULT_CONTACT_WHATSAPP)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-xl bg-[#25D366] py-4 text-center text-lg font-bold text-white hover:brightness-105"
                >
                  Rate expired. WhatsApp us for today&apos;s rate
                </a>
              )}
            </form>

            <div className="mt-6 flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-primary" />
              Pay only to Snappy Sampson Enterprise accounts shown on your invoice.
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              {SNAPPY_BANK_ACCOUNTS.map((a) => (
                <p key={a.accountNumber}>
                  {a.bank}: {a.accountNumber}
                </p>
              ))}
            </div>
            <p className="mt-4 text-sm">
              <Link href="/exchange/lookup" className="font-semibold text-brand-primary hover:underline">
                Already have a buy number? Open it
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
