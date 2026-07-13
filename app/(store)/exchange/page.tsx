'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SNAPPY_BANK_ACCOUNTS } from '@/lib/bank-details';
import { buildWhatsAppHref, DEFAULT_CONTACT_WHATSAPP } from '@/lib/snappy-import';
import { isRateValid, quoteGhsToRmb, formatBuyRate, type ExchangeRateBoard } from '@/lib/rmb-exchange';
import { ArrowRightLeft, Clock, ShieldCheck } from 'lucide-react';

export default function ExchangePage() {
  const router = useRouter();
  const [board, setBoard] = useState<ExchangeRateBoard | null>(null);
  const [amount, setAmount] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    businessName: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/exchange/rate')
      .then((r) => r.json())
      .then((d) => setBoard(d.board))
      .catch(() => setError('Could not load today’s rate'))
      .finally(() => setLoading(false));
  }, []);

  const quote = useMemo(() => {
    const n = Number(amount);
    if (!board || !Number.isFinite(n) || n <= 0) return null;
    return quoteGhsToRmb(n, Number(board.buy_rmb_rate));
  }, [amount, board]);

  const rateOk = isRateValid(board);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          direction: 'ghs_to_rmb',
          amount: Number(amount),
        }),
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
          Official buy rate. Lock today’s rate, get an electronic invoice, pay by bank transfer, and we send your RMB.
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
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
            <h2 className="text-xl font-bold text-brand-primary">Buy RMB</h2>
            <p className="mt-1 text-sm text-slate-500">Enter how much you want to spend in cedis. Invoice only. Bank transfer.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <input
                required
                autoComplete="name"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Full name"
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
                placeholder="Email (optional)"
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

              {quote ? (
                <div className="rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-primary">
                  <p>
                    You pay:{' '}
                    <strong>
                      GH¢{quote.amountFrom.toFixed(2)}
                    </strong>
                  </p>
                  <p>
                    You get:{' '}
                    <strong>
                      {quote.amountTo.toFixed(2)} RMB
                    </strong>
                  </p>
                  <p className="text-xs opacity-80">Rate lock: {formatBuyRate(quote.rate, 4)}</p>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              {rateOk ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-brand-accent py-4 text-lg font-bold text-white disabled:opacity-50"
                >
                  {submitting
                    ? 'Creating invoice…'
                    : quote
                      ? `Lock rate. Get invoice for GH¢${quote.amountFrom.toFixed(2)}`
                      : 'Lock rate and get my invoice'}
                </button>
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
