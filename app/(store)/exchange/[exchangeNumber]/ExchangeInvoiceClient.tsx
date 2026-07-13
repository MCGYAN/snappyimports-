'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { SNAPPY_BANK_ACCOUNTS, SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import { downloadElementAsPdf } from '@/lib/download-pdf';
import { resolvePaymentReference } from '@/lib/payment-reference';
import PaymentReferenceHint from '@/components/PaymentReferenceHint';
import { CheckCircle2, Clock, Download, Printer } from 'lucide-react';

export default function ExchangeInvoiceClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const exchangeNumber = decodeURIComponent(String(params.exchangeNumber || ''));
  const phoneFromUrl = searchParams.get('phone') || '';

  const [phone, setPhone] = useState(phoneFromUrl);
  const [exchange, setExchange] = useState<any>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(Boolean(phoneFromUrl));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = async (ex: string, ph: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/exchange?exchange=${encodeURIComponent(ex)}&phone=${encodeURIComponent(ph)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Not found');
        setExchange(null);
        return;
      }
      setExchange(data.exchange);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (exchangeNumber && phoneFromUrl) load(exchangeNumber, phoneFromUrl);
  }, [exchangeNumber, phoneFromUrl]);

  const handlePaid = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/exchange/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payment_sent',
          exchangeNumber,
          phone,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed');
        return;
      }
      setExchange(data.exchange);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('exchange-invoice-print');
    if (!el) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(el, `${exchangeNumber || 'buy-rmb-invoice'}.pdf`);
    } catch (err) {
      console.error('[exchange pdf]', err);
      alert('Could not download PDF. Try Print instead.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] py-10">
      <div className="mx-auto max-w-3xl px-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Buy RMB invoice</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-brand-primary">{exchangeNumber}</h1>

        {!exchange && (
          <form
            className="store-card mt-6 space-y-3 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              load(exchangeNumber, phone);
            }}
          >
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone used on the request"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="submit" className="rounded-xl bg-brand-primary px-6 py-3 font-bold text-white">
              {loading ? 'Opening…' : 'Open invoice'}
            </button>
          </form>
        )}

        {exchange ? (
          <div className="mt-6 space-y-6">
            <section id="exchange-invoice-print" className="store-card p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <img
                    src={SITE_LOGO_LIGHT_BG_PATH}
                    alt={SNAPPY_INVOICE_ISSUER.brand}
                    className="mb-3 h-12 w-auto object-contain sm:h-14"
                  />
                  <h2 className="text-xl font-bold text-brand-primary">{SNAPPY_INVOICE_ISSUER.brand}</h2>
                  <p className="text-sm text-slate-500">Buy RMB</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-mono font-bold">{exchange.exchange_number}</p>
                  <p>Due: {exchange.due_at ? new Date(exchange.due_at).toLocaleString('en-GB') : '—'}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">Customer</p>
                  <p className="font-semibold">{exchange.customer_name}</p>
                  <p className="text-sm">{exchange.phone}</p>
                  {exchange.business_name ? <p className="text-sm">{exchange.business_name}</p> : null}
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">You pay (GH¢)</p>
                  <p className="text-2xl font-black text-brand-accent">
                    GH¢{Number(exchange.amount_from).toFixed(2)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    You get {Number(exchange.amount_to).toFixed(2)} RMB
                  </p>
                  <p className="text-xs text-slate-400">
                    Rate: 1 GH¢ = {Number(exchange.rate).toFixed(4)} RMB
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pay to</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {SNAPPY_BANK_ACCOUNTS.map((a) => (
                    <div key={a.accountNumber} className="rounded-xl border border-slate-200 p-4">
                      <p className="font-semibold text-brand-primary">{a.bank}</p>
                      <p className="text-sm">{a.holder}</p>
                      {a.registeredName ? (
                        <p className="text-xs text-slate-500">{a.registeredName}</p>
                      ) : null}
                      {a.branch ? <p className="text-xs text-slate-400">{a.branch}</p> : null}
                      <p className="mt-1 font-mono text-lg font-bold">{a.accountNumber}</p>
                    </div>
                  ))}
                </div>
                <PaymentReferenceHint
                  className="mt-4"
                  code={resolvePaymentReference(
                    exchange.metadata?.payment_ref,
                    exchange.exchange_number,
                  )}
                  supportId={exchange.exchange_number}
                />
              </div>
            </section>

            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Preparing PDF…' : 'Download'}
              </button>
            </div>

            <section className="store-card space-y-3 p-6 print:hidden">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4" />
                Status: <strong className="capitalize">{String(exchange.status).replace(/_/g, ' ')}</strong>
              </div>
              {exchange.payment_status === 'paid' ||
              exchange.status === 'confirmed' ||
              exchange.status === 'completed' ? (
                <div className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-green-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-medium">Payment confirmed. Snappy is completing your RMB side.</p>
                </div>
              ) : exchange.status === 'payment_sent' ? (
                <p className="text-sm text-amber-700">Waiting for Snappy to confirm your transfer.</p>
              ) : (
                <>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional transfer reference"
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                    rows={2}
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePaid}
                    className="rounded-xl bg-brand-primary px-6 py-3 font-bold text-white disabled:opacity-60"
                  >
                    {submitting ? 'Sending…' : 'I’ve paid'}
                  </button>
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
