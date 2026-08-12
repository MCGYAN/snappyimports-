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
import { ArrowLeft, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';

export default function AdminExchangeDetailPage() {
  const params = useParams();
  const exchangeNumber = decodeURIComponent(String(params.exchangeNumber || ''));

  const [exchange, setExchange] = useState<any>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState({
    cedisConfirmed: false,
    nameChecked: false,
    amountChecked: false,
  });

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
      if (res.ok && data.url) {
        setQrUrl(data.url);
      } else {
        setQrUrl(null);
      }
    },
    [authHeaders],
  );

  const load = useCallback(async () => {
    if (!exchangeNumber) return;
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/exchange?exchange=${encodeURIComponent(exchangeNumber)}`,
        { headers },
      );
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
      if (data.exchange?.status === 'confirmed' || data.exchange?.payment_status === 'paid') {
        setChecklist((c) => ({ ...c, cedisConfirmed: true }));
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
      setExchange(data.exchange ? { ...data.exchange, has_alipay_qr: exchange?.has_alipay_qr } : exchange);
      if (action === 'confirm') {
        setChecklist((c) => ({ ...c, cedisConfirmed: true }));
      }
      await load();
    } finally {
      setActing(false);
    }
  };

  const canConfirm =
    exchange &&
    (['awaiting_payment', 'payment_sent'].includes(exchange.status) ||
      exchange.payment_status === 'awaiting_confirmation' ||
      exchange.payment_status === 'pending');

  const canMarkSent = exchange?.status === 'confirmed';
  const wa = exchange?.phone ? buildWhatsAppHref(exchange.phone) : '';
  const paymentRef = exchange
    ? resolvePaymentReference(exchange.metadata?.payment_ref, exchange.exchange_number)
    : '';
  const country = parseExchangeCountryCode(
    exchange?.country_code || exchange?.metadata?.country_code,
  );
  const countryMeta = EXCHANGE_CORRIDORS[country];
  const localPaidLabel = formatLocalMoney(Number(exchange?.amount_from || 0), country);

  const readyToMarkSent =
    checklist.cedisConfirmed && checklist.nameChecked && checklist.amountChecked;

  if (loading) {
    return <p className="p-6 text-slate-500">Loading Buy RMB request…</p>;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/exchange"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Buy RMB desk
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-bold text-brand-primary">
            {exchange.exchange_number}
          </h1>
          <p className="text-sm text-slate-500">
            Code {paymentRef}. {countryMeta.name}. Status:{' '}
            <span className="capitalize">{String(exchange.status).replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-primary"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {wa ? (
            <a
              href={`${wa}?text=${encodeURIComponent(
                `Hi ${exchange.customer_name}, this is Snappy Imports Global about your Buy RMB ${exchange.exchange_number}.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp customer
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold text-brand-primary">Customer invoice</h2>
          <p className="mt-1 text-sm text-slate-500">
            Same invoice the customer received. Use the name here when checking Alipay.
          </p>
          <div className="mt-4 overflow-auto rounded-xl border border-slate-100">
            <ExchangeInvoiceDocument exchange={exchange} />
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-brand-accent/30 bg-gradient-to-b from-orange-50 to-white p-4 sm:p-6">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-accent" />
              <div>
                <h2 className="text-lg font-bold text-brand-primary">Alipay send checklist</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Confirm {countryMeta.name} payment first. Scan QR. Check name. Send RMB. Then mark
                  sent.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-100">
              <p>
                <span className="font-semibold text-slate-500">Pay-in country:</span>{' '}
                <span className="font-bold text-brand-primary">{countryMeta.name}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Invoice name:</span>{' '}
                <span className="font-bold text-brand-primary">{exchange.customer_name}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Alipay name on form:</span>{' '}
                {exchange.alipay_account_name || (
                  <span className="text-slate-400">Not provided</span>
                )}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Send:</span>{' '}
                <span className="text-xl font-black text-brand-primary">
                  {Number(exchange.amount_to).toFixed(2)} RMB
                </span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Customer paid:</span> {localPaidLabel}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={checklist.cedisConfirmed}
                  onChange={(e) =>
                    setChecklist((c) => ({ ...c, cedisConfirmed: e.target.checked }))
                  }
                  className="mt-1"
                />
                <span>
                  {countryMeta.name} payment confirmed in bank or mobile money ({localPaidLabel})
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={checklist.nameChecked}
                  onChange={(e) =>
                    setChecklist((c) => ({ ...c, nameChecked: e.target.checked }))
                  }
                  className="mt-1"
                />
                <span>
                  Alipay name after scan matches invoice name (or WhatsApp confirmed if nickname)
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={checklist.amountChecked}
                  onChange={(e) =>
                    setChecklist((c) => ({ ...c, amountChecked: e.target.checked }))
                  }
                  className="mt-1"
                />
                <span>RMB amount entered in Alipay is {Number(exchange.amount_to).toFixed(2)}</span>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {canConfirm ? (
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => {
                    if (
                      !confirm(
                        `Confirm ${countryMeta.name} payment received: ${localPaidLabel} for ${exchange.exchange_number}?`,
                      )
                    ) {
                      return;
                    }
                    void act('confirm');
                  }}
                  className="rounded-xl bg-brand-primary py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {acting ? 'Working…' : `1. Confirm ${countryMeta.name} payment received`}
                </button>
              ) : null}

              {canMarkSent ? (
                <button
                  type="button"
                  disabled={acting || !readyToMarkSent}
                  onClick={() => {
                    if (!readyToMarkSent) {
                      alert('Tick all checklist items before marking RMB sent.');
                      return;
                    }
                    if (
                      !confirm(
                        `Confirm you sent ${Number(exchange.amount_to).toFixed(2)} RMB via Alipay?`,
                      )
                    ) {
                      return;
                    }
                    void act('complete');
                  }}
                  className="rounded-xl bg-brand-accent py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {acting ? 'Working…' : '3. Mark RMB sent'}
                </button>
              ) : null}

              {exchange.status === 'completed' ? (
                <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-800">
                  Done. RMB marked as sent.
                </p>
              ) : null}

              {!readyToMarkSent && canMarkSent ? (
                <p className="text-xs text-slate-500">
                  Tick the checklist after you scan and verify in Alipay, then mark RMB sent.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold text-brand-primary">2. Scan Alipay QR</h2>
            <p className="mt-1 text-sm text-slate-500">
              Open Alipay on your phone and scan this screen. Confirm the name, enter the RMB amount,
              then pay.
            </p>
            {qrUrl ? (
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="Customer Alipay receive QR"
                  className="mx-auto max-h-[min(70vh,520px)] w-auto max-w-full object-contain"
                />
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No Alipay QR on file. Ask the customer on WhatsApp for a fresh receive QR screenshot.
              </p>
            )}
            <button
              type="button"
              onClick={() => void loadQr(exchangeNumber)}
              className="mt-3 text-sm font-semibold text-brand-primary hover:underline"
            >
              Reload QR
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
