'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import InvoiceDocument from '@/components/InvoiceDocument';
import { downloadElementAsPdf } from '@/lib/download-pdf';
import {
  deriveFulfillmentStage,
  FULFILLMENT_STAGES,
  fulfillmentIndex,
} from '@/lib/order-journey';
import { formatMoney, isInvoiceExpired } from '@/lib/payment-routing';
import { resolvePaymentReference } from '@/lib/payment-reference';
import { buildWhatsAppHref, resolveContactWhatsApp } from '@/lib/snappy-import';
import {
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  MessageCircle,
  Package,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react';

export default function OrderHubPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderNumber = decodeURIComponent(String(params.orderNumber || ''));
  const emailFromUrl = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromUrl);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(Boolean(emailFromUrl));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    address: '',
    city: '',
    preferredDate: '',
    preferredTime: '',
    notes: '',
  });
  const [now, setNow] = useState(Date.now());

  const loadOrder = useCallback(async (orderNum: string, mail: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/orders/lookup?order=${encodeURIComponent(orderNum)}&email=${encodeURIComponent(mail.trim())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load order');
        setOrder(null);
        return;
      }
      setOrder(data.order);
      const addr = data.order?.shipping_address || {};
      setDeliveryForm((prev) => ({
        ...prev,
        address: prev.address || addr.address || '',
        city: prev.city || addr.city || '',
      }));
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderNumber && emailFromUrl) loadOrder(orderNumber, emailFromUrl);
  }, [orderNumber, emailFromUrl, loadOrder]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const stage = order ? deriveFulfillmentStage(order) : 'awaiting_payment';
  const dueAt = order?.metadata?.invoice_due_at as string | undefined;
  const expired = isInvoiceExpired(dueAt);
  const msLeft = dueAt ? new Date(dueAt).getTime() - now : 0;
  const hoursLeft = Math.max(0, Math.floor(msLeft / 3600000));
  const minsLeft = Math.max(0, Math.floor((msLeft % 3600000) / 60000));

  const waHref = useMemo(() => {
    const base = buildWhatsAppHref(resolveContactWhatsApp(null));
    if (!base || !orderNumber) return base;
    const text = encodeURIComponent(`Hi Snappy, I need help with order ${orderNumber}.`);
    return `${base}${base.includes('?') ? '&' : '?'}text=${text}`;
  }, [orderNumber]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter the email used at checkout.');
      return;
    }
    loadOrder(orderNumber, email);
  };

  const handlePaymentSent = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders/payment-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: order.order_number,
          email: order.email,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not submit');
        return;
      }
      setOrder(data.order);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: order.order_number,
          email: order.email,
          ...deliveryForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not book delivery');
        return;
      }
      setOrder(data.order);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    const root = document.getElementById('invoice-print');
    const official = root?.querySelector<HTMLElement>('.invoice-official');
    if (!official) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(official, `${orderNumber || 'invoice'}.pdf`);
    } catch (err) {
      console.error('[order pdf]', err);
      alert('Could not download PDF. Try Print instead.');
    } finally {
      setDownloading(false);
    }
  };

  if (!orderNumber) {
    return (
      <main className="store-page py-16 text-center">
        <p>Missing order number.</p>
        <Link href="/order-tracking" className="text-brand-primary underline">
          Track an order
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fafc] via-white to-[#eef2f7]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Your order</p>
            <h1 className="font-heading text-2xl font-bold text-brand-primary sm:text-3xl">
              {orderNumber}
            </h1>
          </div>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp help
            </a>
          ) : null}
        </div>

        {!order && (
          <form onSubmit={handleUnlock} className="store-card mx-auto max-w-md space-y-4 p-6 print:hidden">
            <p className="text-sm text-slate-600">
              Enter the email you used at checkout to open your invoice, payment status, and tracking.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base focus:border-brand-accent focus:outline-none"
              required
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-primary py-3 font-bold text-white disabled:opacity-60"
            >
              {loading ? 'Opening…' : 'Open order'}
            </button>
          </form>
        )}

        {loading && !order ? (
          <div className="flex justify-center py-16 print:hidden">
            <RefreshCcw className="h-8 w-8 animate-spin text-brand-primary" />
          </div>
        ) : null}

        {order ? (
          <div className="space-y-6">
            <section className="store-card grid gap-4 p-5 sm:grid-cols-3 print:hidden">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-accent" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Payment</p>
                  <p className="font-bold capitalize text-brand-primary">
                    {order.payment_status?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="mt-0.5 h-5 w-5 text-brand-accent" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Journey</p>
                  <p className="font-bold text-brand-primary">
                    {FULFILLMENT_STAGES.find((s) => s.key === stage)?.title || stage}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 text-brand-accent" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Invoice deadline</p>
                  <p className="font-bold text-brand-primary">
                    {order.payment_status === 'paid'
                      ? 'Paid. Closed'
                      : expired
                        ? 'Expired'
                        : dueAt
                          ? `${hoursLeft}h ${minsLeft}m left`
                          : '—'}
                  </p>
                </div>
              </div>
            </section>

            <section className="store-card p-5 sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <h2 className="text-xl font-bold text-brand-primary">Invoice</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-primary"
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
                    {downloading ? 'Preparing PDF…' : 'Download PDF'}
                  </button>
                </div>
              </div>
              <InvoiceDocument order={order} />
            </section>

            {order.payment_status !== 'paid' && (
              <section className="store-card space-y-4 p-5 sm:p-8 print:hidden">
                <h2 className="text-xl font-bold text-brand-primary">Pay this invoice</h2>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                  <li>Transfer the total using one of the bank or MoMo accounts on the invoice.</li>
                  <li>
                    Optional: add code{' '}
                    <span className="font-mono font-bold">
                      {resolvePaymentReference(order.metadata?.payment_ref, order.order_number)}
                    </span>{' '}
                    on the transfer if you can. It helps us match your payment faster.
                  </li>
                  <li>Tap “I’ve paid” so we can confirm and start your import.</li>
                </ol>

                {order.payment_status === 'awaiting_confirmation' ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">
                      Payment marked as sent. Waiting for Snappy to confirm on the dashboard.
                    </p>
                  </div>
                ) : expired ? (
                  <p className="text-sm text-red-600">
                    This invoice expired. Message us on WhatsApp to renew the order.
                  </p>
                ) : (
                  <>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional: MoMo/bank reference or screenshot note"
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base"
                      rows={2}
                    />
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handlePaymentSent}
                      className="w-full rounded-xl bg-brand-primary py-4 text-lg font-bold text-white disabled:opacity-60 sm:w-auto sm:px-10"
                    >
                      {submitting ? 'Sending…' : 'I’ve paid'}
                    </button>
                  </>
                )}
              </section>
            )}

            {order.payment_status === 'paid' ? (
              <section className="store-card flex items-start gap-3 border border-green-200 bg-green-50 p-5 print:hidden">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-900">Payment confirmed</p>
                  <p className="text-sm text-green-800">
                    Total {formatMoney(order.total || 0, order.currency)}. Your import journey is active.
                  </p>
                </div>
              </section>
            ) : null}

            <section className="store-card p-5 sm:p-8 print:hidden">
              <div className="mb-6 flex items-center gap-2">
                <Truck className="h-5 w-5 text-brand-accent" />
                <h2 className="text-xl font-bold text-brand-primary">Shipping & tracking</h2>
              </div>
              <ol className="space-y-4">
                {FULFILLMENT_STAGES.filter((s) => s.key !== 'cancelled').map((s) => {
                  const idx = fulfillmentIndex(s.key);
                  const current = fulfillmentIndex(stage);
                  const done = order.payment_status === 'paid' ? idx <= current : idx === 0 && current === 0;
                  const active = s.key === stage;
                  return (
                    <li key={s.key} className="flex gap-3">
                      <div
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                          active
                            ? 'bg-brand-accent ring-4 ring-brand-accent/20'
                            : done
                              ? 'bg-brand-primary'
                              : 'bg-slate-200'
                        }`}
                      />
                      <div>
                        <p className={`font-semibold ${active ? 'text-brand-accent' : 'text-slate-800'}`}>
                          {s.title}
                        </p>
                        <p className="text-sm text-slate-500">{s.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {order.metadata?.tracking_number ? (
                <p className="mt-4 text-sm text-slate-600">
                  Tracking ID:{' '}
                  <span className="font-mono font-bold">{order.metadata.tracking_number}</span>
                </p>
              ) : null}
            </section>

            {order.payment_status === 'paid' && (
              <section className="store-card p-5 sm:p-8 print:hidden">
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-brand-accent" />
                  <h2 className="text-xl font-bold text-brand-primary">Book delivery</h2>
                </div>
                {order.metadata?.delivery_booking ? (
                  <div className="rounded-xl bg-brand-light/60 p-4 text-sm text-brand-primary">
                    <p className="font-bold">Delivery requested</p>
                    <p className="mt-1">{order.metadata.delivery_booking.address}</p>
                    {order.metadata.delivery_booking.preferredDate ? (
                      <p>
                        Preferred: {order.metadata.delivery_booking.preferredDate}
                        {order.metadata.delivery_booking.preferredTime
                          ? `, ${order.metadata.delivery_booking.preferredTime}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <form onSubmit={handleBookDelivery} className="space-y-3">
                    <p className="text-sm text-slate-600">
                      When your goods are in Ghana, tell us where and when to deliver.
                    </p>
                    <input
                      required
                      value={deliveryForm.address}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, address: e.target.value })}
                      placeholder="Delivery address"
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={deliveryForm.city}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, city: e.target.value })}
                        placeholder="City"
                        className="rounded-xl border-2 border-slate-200 px-4 py-3"
                      />
                      <input
                        type="date"
                        value={deliveryForm.preferredDate}
                        onChange={(e) =>
                          setDeliveryForm({ ...deliveryForm, preferredDate: e.target.value })
                        }
                        className="rounded-xl border-2 border-slate-200 px-4 py-3"
                      />
                    </div>
                    <input
                      value={deliveryForm.preferredTime}
                      onChange={(e) =>
                        setDeliveryForm({ ...deliveryForm, preferredTime: e.target.value })
                      }
                      placeholder="Preferred time (optional)"
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                    />
                    <textarea
                      value={deliveryForm.notes}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                      placeholder="Notes for the driver"
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-3"
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-xl bg-brand-accent px-6 py-3 font-bold text-white disabled:opacity-60"
                    >
                      {submitting ? 'Saving…' : 'Request delivery'}
                    </button>
                  </form>
                )}
              </section>
            )}
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print,
          #invoice-print * {
            visibility: visible;
          }
          #invoice-print {
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
