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
          Pay cedis in Ghana. Get RMB on Alipay.
        </h1>
        <p className="mt-4 max-w-2xl text-white/80">
          This is not an instant swap. First you lock today’s rate and get an invoice. Then you pay
          Snappy in Ghana. Only after we confirm your cedis do we send RMB to your Alipay.
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
                  <p className="text-sm text-white/60">Official Snappy desk rate</p>
                  <p className="text-3xl font-black text-white">
                    {formatBuyRate(Number(board?.buy_rmb_rate || 0))}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    You pay Ghana Cedis. You receive Chinese RMB on Alipay.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock className="h-4 w-4" />
                  {board?.valid_until
                    ? `This rate is valid until ${new Date(board.valid_until).toLocaleString('en-GB')}`
                    : 'Ask Snappy to publish today’s rate window'}
                </div>
                {!rateOk ? (
                  <p className="text-sm text-amber-300">
                    This rate has expired. Message Snappy on WhatsApp for today’s rate before you pay
                    anyone.
                  </p>
                ) : null}
                {board?.notes ? <p className="text-sm text-white/60">{board.notes}</p> : null}

                <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white/75">
                  <p className="font-semibold text-white">What happens, in order</p>
                  <ol className="mt-2 list-decimal space-y-2 pl-4">
                    <li>Fill the form and upload your Alipay receive QR.</li>
                    <li>Lock the rate. You get an invoice. No money has moved yet.</li>
                    <li>Pay the invoice amount to Snappy by bank or MoMo.</li>
                    <li>Tap I’ve paid only after you have sent the money.</li>
                    <li>We confirm your cedis, then scan your QR and send the RMB.</li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                  <p className="font-semibold text-amber-100">Use the right Alipay QR</p>
                  <p className="mt-1.5 leading-relaxed text-amber-50/90">
                    Upload the QR that lets people send money to you (Receive / Collect). Do not
                    upload a shop payment QR, a pay-to-merchant code, or someone else’s QR. Wrong QR
                    means the RMB can go to the wrong person.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
            <h2 className="text-xl font-bold text-brand-primary">Start your Buy RMB request</h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter who you are, how much cedis you will pay, and where we should send the RMB. This
              button only creates your invoice. It does not charge your phone or bank.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Full name</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Use the same name you will use when sending the bank or MoMo payment.
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
                <span className="text-sm font-semibold text-slate-800">WhatsApp / phone</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Needed to open your invoice again and for us to reach you if the Alipay name looks
                  different.
                </span>
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Ghana number you use on WhatsApp"
                  className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Email (optional)</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  We email you when cedis are confirmed and when RMB is sent. Use your Snappy account
                  email if you have one.
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
                <span className="text-sm font-semibold text-slate-800">Amount you will pay (GH¢)</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Enter the cedis amount. We show the RMB you will receive at today’s rate before you
                  lock.
                </span>
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Example: 1000"
                  className="mt-1.5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold"
                />
              </label>

              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-brand-primary">Alipay receive QR (required)</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  This is where your RMB will go. In Alipay open Receive / Collect money, screenshot
                  that QR, then upload it here. Do not upload a pay-at-shop or merchant QR.
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
                    <p className="mt-2 text-center text-xs text-slate-500">
                      Check this preview. If this is not your receive QR, change it before you lock
                      the rate.
                    </p>
                  </div>
                ) : null}
                <label className="mt-3 block">
                  <span className="text-sm font-semibold text-slate-800">
                    Name shown on Alipay (optional)
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Helps us check we are sending to the right person. Can differ from your Ghana
                    payment name.
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
                  <p className="font-semibold">If you lock now</p>
                  <p className="mt-1">
                    You will pay: <strong>GH¢{quote.amountFrom.toFixed(2)}</strong>
                  </p>
                  <p>
                    You will receive: <strong>{quote.amountTo.toFixed(2)} RMB</strong> on Alipay
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    Locked rate: {formatBuyRate(quote.rate, 4)}. RMB is sent only after we confirm
                    your cedis.
                  </p>
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
                      ? 'Creating your invoice…'
                      : quote
                        ? `Lock rate and open invoice for GH¢${quote.amountFrom.toFixed(2)}`
                        : 'Lock today’s rate and open invoice'}
                  </button>
                  <p className="text-center text-xs leading-relaxed text-slate-500">
                    Next page is your invoice with Snappy payment details. Pay that amount first.
                    Then tap I’ve paid. Uploading your QR or locking the rate is not a payment.
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

            <div className="mt-6 flex items-start gap-2 text-xs text-slate-600">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
              <p>
                Pay only the accounts printed on your invoice under Snappy Sampson Enterprise. Do not
                send money to any other number or account someone sends you in chat.
              </p>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <p className="font-medium text-slate-500">Our usual Ghana accounts (confirm on invoice):</p>
              {SNAPPY_BANK_ACCOUNTS.map((a) => (
                <p key={a.accountNumber}>
                  {a.bank}: {a.accountNumber}
                </p>
              ))}
            </div>
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
