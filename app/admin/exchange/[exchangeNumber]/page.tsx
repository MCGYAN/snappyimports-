'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ExchangeInvoiceDocument from '@/components/ExchangeInvoiceDocument';
import { supabase } from '@/lib/supabase';
import { buildWhatsAppHref } from '@/lib/snappy-import';
import { resolvePaymentReference } from '@/lib/payment-reference';
import {
  EXCHANGE_CORRIDORS,
  formatLocalMoney,
  parseExchangeCountryCode,
} from '@/lib/exchange-corridors';
import { ArrowLeft, MessageCircle, RefreshCw } from 'lucide-react';

export default function AdminExchangeDetailPage() {
  const params = useParams();
  const exchangeNumber = decodeURIComponent(String(params.exchangeNumber || ''));

  const [exchange, setExchange] = useState<any>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState({ name: false, amount: false });

  const authHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }, []);

  const loadQr = useCallback(
    async (exNumber: string) => {
      const headers = await authHeaders();
      const res = await fetch(`/api/exchange/alipay-qr?exchange=${encodeURIComponent(exNumber)}`, {
        headers,
      });
      const data = await res.json();
      setQrUrl(res.ok && data.url ? data.url : null);
    },
    [authHeaders],
  );

  const load = useCallback(async () => {
    if (!exchangeNumber) return;
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/exchange?exchange=${encodeURIComponent(exchangeNumber)}`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load exchange');
        setExchange(null);
        return;
      }
      setExchange(data.exchange);
      if (data.exchange?.has_alipay_qr) {
        await loadQr(exchangeNumber);
      } else {
        setQrUrl(null);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, exchangeNumber, loadQr]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: 'confirm' | 'complete') => {
    if (!exchangeNumber) return;
    setActing(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/exchange/action', {
        method: 'POST',
        headers,
        body: JSON.stringify({ exchangeNumber, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed');
        return;
      }
      await load();
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-slate-500">Loading…</p>;
  }

  if (error || !exchange) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-red-600">{error || 'Not found'}</p>
        <Link href="/admin/exchange" className="font-semibold text-brand-primary hover:underline">
          Back to Buy RMB desk
        </Link>
      </div>
    );
  }

  const country = parseExchangeCountryCode(
    exchange.country_code || exchange.metadata?.country_code,
  );
  const countryMeta = EXCHANGE_CORRIDORS[country];
  const localPaid = formatLocalMoney(Number(exchange.amount_from || 0), country);
  const rmbToSend = Number(exchange.amount_to || 0).toFixed(2);
  const paymentRef = resolvePaymentReference(
    exchange.metadata?.payment_ref,
    exchange.exchange_number,
  );
  const wa = exchange.phone ? buildWhatsAppHref(exchange.phone) : '';

  const status = String(exchange.status || '');
  const needsConfirm =
    ['awaiting_payment', 'payment_sent'].includes(status) ||
    exchange.payment_status === 'awaiting_confirmation' ||
    exchange.payment_status === 'pending';
  const canMarkSent = status === 'confirmed';
  const isDone = status === 'completed';
  const readyToSend = checks.name && checks.amount;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/exchange"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Buy RMB desk
          </Link>
          <h1 className="mt-1.5 font-heading text-2xl font-bold text-brand-primary">
            {exchange.customer_name}
          </h1>
          <p className="text-sm text-slate-500">
            {countryMeta.name}. {exchange.exchange_number}. Code {paymentRef}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg p-2 text-slate-500 ring-1 ring-slate-200 hover:text-brand-primary"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {wa ? (
            <a
              href={`${wa}?text=${encodeURIComponent(
                `Hi ${exchange.customer_name}, this is Snappy Imports Global about your Buy RMB ${exchange.exchange_number}.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          {isDone ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800">
              Done. {rmbToSend} RMB marked as sent.
            </p>
          ) : needsConfirm ? (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-sm text-slate-500">Waiting on {countryMeta.name} payment</p>
                <p className="mt-1 text-3xl font-black text-brand-primary">{localPaid}</p>
              </div>
              <button
                type="button"
                disabled={acting}
                onClick={() => {
                  if (!confirm(`Confirm ${localPaid} received for ${exchange.exchange_number}?`)) {
                    return;
                  }
                  void act('confirm');
                }}
                className="w-full rounded-xl bg-brand-primary py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {acting ? 'Working…' : `Confirm ${countryMeta.name} payment received`}
              </button>
              <p className="text-xs text-slate-500">
                The Alipay QR opens here once the payment is confirmed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-slate-500">Scan with Alipay and send</p>
                <p className="text-2xl font-black text-brand-primary">{rmbToSend} RMB</p>
              </div>

              {qrUrl ? (
                <div className="rounded-xl bg-slate-50 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt="Customer Alipay receive QR"
                    className="mx-auto max-h-[min(60vh,460px)] w-auto max-w-full object-contain"
                  />
                </div>
              ) : (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No Alipay QR on file. Ask the customer for a fresh receive QR screenshot.
                </p>
              )}

              {canMarkSent ? (
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checks.name}
                      onChange={(e) => setChecks((c) => ({ ...c, name: e.target.checked }))}
                      className="mt-0.5"
                    />
                    <span>
                      Alipay name matches{' '}
                      <strong>{exchange.alipay_account_name || exchange.customer_name}</strong>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checks.amount}
                      onChange={(e) => setChecks((c) => ({ ...c, amount: e.target.checked }))}
                      className="mt-0.5"
                    />
                    <span>
                      Amount entered is <strong>{rmbToSend} RMB</strong>
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={acting || !readyToSend}
                    onClick={() => {
                      if (!confirm(`Confirm you sent ${rmbToSend} RMB via Alipay?`)) return;
                      void act('complete');
                    }}
                    className="w-full rounded-xl bg-brand-accent py-3 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {acting ? 'Working…' : 'Mark RMB sent'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <dl className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Paid</dt>
              <dd className="font-semibold text-slate-900">{localPaid}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Send</dt>
              <dd className="font-semibold text-slate-900">{rmbToSend} RMB</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Alipay name</dt>
              <dd className="text-right font-medium text-slate-900">
                {exchange.alipay_account_name || <span className="text-slate-400">Not given</span>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{exchange.phone}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium capitalize text-slate-900">{status.replace(/_/g, ' ')}</dd>
            </div>
          </dl>

          <details className="rounded-2xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer list-none text-sm font-semibold text-brand-primary">
              View customer invoice
            </summary>
            <div className="mt-4 overflow-auto">
              <ExchangeInvoiceDocument exchange={exchange} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
