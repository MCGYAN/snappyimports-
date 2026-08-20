'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ExchangeInvoiceDocument from '@/components/ExchangeInvoiceDocument';
import ScaledDocumentPreview from '@/components/ScaledDocumentPreview';
import { downloadElementAsPdf } from '@/lib/download-pdf';
import { supabase } from '@/lib/supabase';
import { EXCHANGE_CORRIDORS, parseExchangeCountryCode } from '@/lib/exchange-corridors';
import { CheckCircle2, Download, Printer, Upload } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Awaiting your payment',
  payment_sent: 'Checking your transfer',
  confirmed: 'Sending your RMB',
  completed: 'RMB sent',
  expired: 'Expired',
};

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
      if (!ph && data.exchange?.phone) setPhone(data.exchange.phone);
      if (data.exchange?.alipay_account_name) setAlipayName(data.exchange.alipay_account_name);
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
        body: JSON.stringify({ action: 'payment_sent', exchangeNumber, phone, note }),
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

      const res = await fetch('/api/exchange/alipay-qr', { method: 'POST', headers, body });
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

  const status = String(exchange?.status || '');
  const isPaidSide =
    exchange?.payment_status === 'paid' || status === 'confirmed' || status === 'completed';
  const country = parseExchangeCountryCode(
    exchange?.country_code || exchange?.metadata?.country_code,
  );
  const countryName = EXCHANGE_CORRIDORS[country].name;

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Buy RMB</p>
            <h1 className="font-heading text-2xl font-bold text-brand-primary">{exchangeNumber}</h1>
          </div>
          {exchange ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : isPaidSide
                    ? 'bg-blue-100 text-blue-800'
                    : status === 'payment_sent'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
              }`}
            >
              {STATUS_LABEL[status] || status.replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>

        {loading && !exchange ? (
          <p className="text-sm text-slate-500 print:hidden">Opening invoice…</p>
        ) : null}

        {!loading && !exchange && (
          <form
            className="store-card mx-auto max-w-md space-y-3 p-6 print:hidden"
            onSubmit={(e) => {
              e.preventDefault();
              void load(exchangeNumber, phone);
            }}
          >
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone used on the request"
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-brand-primary px-6 py-3 font-bold text-white"
            >
              Open invoice
            </button>
          </form>
        )}

        {exchange ? (
          <div className="space-y-4">
            <section className="store-card p-5 sm:p-7">
              <div className="mb-5 flex justify-end gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadPdf()}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloading ? 'Preparing…' : 'PDF'}
                </button>
              </div>

              <ScaledDocumentPreview>
                <ExchangeInvoiceDocument exchange={exchange} />
              </ScaledDocumentPreview>
            </section>

            {!exchange.has_alipay_qr ? (
              <section className="store-card space-y-3 p-6 print:hidden">
                <div>
                  <h2 className="font-semibold text-brand-primary">Add your Alipay receive QR</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    We cannot send RMB without it. Upload your receive money code, not a shop
                    payment code.
                  </p>
                </div>
                <input
                  value={alipayName}
                  onChange={(e) => setAlipayName(e.target.value)}
                  placeholder="Name shown on Alipay (optional)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                  <Upload className="h-5 w-5 shrink-0 text-brand-primary" />
                  <span className="text-sm font-medium text-brand-primary">
                    {uploadingQr ? 'Uploading…' : 'Upload QR screenshot'}
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
              </section>
            ) : null}

            <section className="store-card p-6 print:hidden">
              {status === 'completed' ? (
                <div className="flex items-start gap-2 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    We sent {Number(exchange.amount_to).toFixed(2)} RMB to your Alipay. Check Alipay
                    for the credit.
                  </p>
                </div>
              ) : isPaidSide ? (
                <div className="flex items-start gap-2 text-brand-primary">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    Your {countryName} payment is confirmed. We are sending{' '}
                    {Number(exchange.amount_to).toFixed(2)} RMB to your Alipay.
                  </p>
                </div>
              ) : status === 'payment_sent' ? (
                <p className="text-sm text-amber-800">
                  We are checking your transfer. Please do not send the money again unless we ask.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h2 className="font-semibold text-brand-primary">Already paid?</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Tap below only after the money has left your account.
                    </p>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Transfer reference (optional)"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    rows={2}
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      if (
                        !confirm(
                          'Tap OK only if you have already sent the invoice amount to Snappy.',
                        )
                      ) {
                        return;
                      }
                      void handlePaid();
                    }}
                    className="w-full rounded-xl bg-brand-primary py-3.5 font-bold text-white disabled:opacity-60"
                  >
                    {submitting ? 'Notifying Snappy…' : 'I’ve paid'}
                  </button>
                </div>
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
