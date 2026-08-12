'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ExchangeInvoiceDocument from '@/components/ExchangeInvoiceDocument';
import { downloadElementAsPdf } from '@/lib/download-pdf';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, Download, Printer, Upload } from 'lucide-react';

export default function ExchangeInvoiceClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const exchangeNumber = decodeURIComponent(String(params.exchangeNumber || ''));
  const phoneFromUrl = searchParams.get('phone') || '';

  const [phone, setPhone] = useState(phoneFromUrl);
  const [exchange, setExchange] = useState<any>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(Boolean(exchangeNumber));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [alipayName, setAlipayName] = useState('');

  const load = async (ex: string, ph: string) => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const qs = new URLSearchParams({ exchange: ex });
      if (ph) qs.set('phone', ph);

      const res = await fetch(`/api/exchange?${qs.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Not found');
        setExchange(null);
        return;
      }
      setExchange(data.exchange);
      if (!ph && data.exchange?.phone) {
        setPhone(data.exchange.phone);
      }
      if (data.exchange?.alipay_account_name) {
        setAlipayName(data.exchange.alipay_account_name);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (exchangeNumber) void load(exchangeNumber, phoneFromUrl);
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

  const handleDownloadPdf = useCallback(async () => {
    const root = document.getElementById('exchange-invoice-print');
    const official = root?.querySelector<HTMLElement>('.invoice-official');
    if (!official) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(official, `${exchangeNumber || 'buy-rmb-invoice'}.pdf`);
    } catch (err) {
      console.error('[exchange pdf]', err);
      alert('Could not download PDF. Try Print instead.');
    } finally {
      setDownloading(false);
    }
  }, [exchangeNumber]);

  const uploadQr = async (file: File) => {
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Upload a JPG, PNG, or WebP screenshot.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.');
      return;
    }
    setUploadingQr(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const body = new FormData();
      body.set('exchangeNumber', exchangeNumber);
      body.set('phone', phone);
      body.set('alipayAccountName', alipayName);
      body.set('alipayQr', file);
      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch('/api/exchange/alipay-qr', {
        method: 'POST',
        headers,
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not upload Alipay QR');
        return;
      }
      setExchange(data.exchange);
    } finally {
      setUploadingQr(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#eef2f7]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 print:hidden">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Buy RMB</p>
          <h1 className="font-heading text-2xl font-bold text-brand-primary sm:text-3xl">
            {exchangeNumber}
          </h1>
        </div>

        {loading && !exchange ? (
          <p className="mt-6 text-sm text-slate-500 print:hidden">Opening invoice…</p>
        ) : null}

        {!loading && !exchange && (
          <form
            className="store-card mx-auto mt-6 max-w-md space-y-3 p-6 print:hidden"
            onSubmit={(e) => {
              e.preventDefault();
              void load(exchangeNumber, phone);
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
            <button type="submit" className="w-full rounded-xl bg-brand-primary px-6 py-3 font-bold text-white">
              Open invoice
            </button>
          </form>
        )}

        {exchange ? (
          <div className="space-y-6">
            <section className="store-card p-5 sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div>
                  <h2 className="text-xl font-bold text-brand-primary">Your invoice</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Pay the total due on this invoice to Snappy. Then come back here and tap I’ve paid.
                    RMB is not sent until we confirm your cedis.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-primary"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDownloadPdf();
                    }}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {downloading ? 'Preparing PDF…' : 'Download PDF'}
                  </button>
                </div>
              </div>

              <ExchangeInvoiceDocument exchange={exchange} />
            </section>

            <section className="store-card space-y-3 p-6 print:hidden">
              <h3 className="font-semibold text-brand-primary">Where your RMB will go</h3>
              {exchange.has_alipay_qr ? (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                  Your Alipay receive QR is saved
                  {exchange.alipay_account_name ? (
                    <>
                      {' '}
                      for <strong>{exchange.alipay_account_name}</strong>
                    </>
                  ) : null}
                  . After we confirm your Ghana payment, we will scan this QR and send{' '}
                  <strong>{Number(exchange.amount_to).toFixed(2)} RMB</strong>. Uploading the QR is
                  not a payment.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-amber-700">
                    We still need your Alipay receive QR before we can send RMB. Upload the Receive /
                    Collect QR only, not a shop payment code.
                  </p>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">
                      Name shown on Alipay (optional)
                    </span>
                    <input
                      value={alipayName}
                      onChange={(e) => setAlipayName(e.target.value)}
                      placeholder="As it appears in Alipay"
                      className="mt-1 w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                    />
                  </label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                    <Upload className="mb-2 h-6 w-6 text-brand-primary" />
                    <span className="text-sm font-semibold text-brand-primary">
                      {uploadingQr ? 'Uploading…' : 'Upload Alipay receive QR screenshot'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                      disabled={uploadingQr}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        e.target.value = '';
                        if (file) void uploadQr(file);
                      }}
                    />
                  </label>
                </div>
              )}
            </section>

            <section className="store-card space-y-3 p-6 print:hidden">
              <h3 className="font-semibold text-brand-primary">Local payment status</h3>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4" />
                Status:{' '}
                <strong className="capitalize">{String(exchange.status).replace(/_/g, ' ')}</strong>
              </div>
              {exchange.payment_status === 'paid' ||
              exchange.status === 'confirmed' ||
              exchange.status === 'completed' ? (
                <div className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-green-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    {exchange.status === 'completed'
                      ? 'RMB has been sent to your Alipay. Check Alipay for the credit.'
                      : 'We confirmed your cedis. We are sending your RMB to the Alipay QR on this request.'}
                  </p>
                </div>
              ) : exchange.status === 'payment_sent' ? (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  You told us you paid. We are checking your bank or MoMo transfer. Do not send the
                  money again unless we ask you to.
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Only tap I’ve paid after you have already sent the invoice total to Snappy. This
                    button tells us to check your transfer. It does not move money by itself.
                  </p>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">
                      Transfer note or reference (optional)
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Example: MoMo name, or bank reference"
                      className="mt-1 w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                      rows={2}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      if (
                        !confirm(
                          'Have you already sent the invoice amount to Snappy? Tap OK only if the money has left your account.',
                        )
                      ) {
                        return;
                      }
                      void handlePaid();
                    }}
                    className="rounded-xl bg-brand-primary px-6 py-3 font-bold text-white disabled:opacity-60"
                  >
                    {submitting ? 'Notifying Snappy…' : 'I’ve paid. Please confirm my transfer'}
                  </button>
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #exchange-invoice-print,
          #exchange-invoice-print * {
            visibility: visible;
          }
          #exchange-invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
          }
        }
      `}</style>
    </main>
  );
}
