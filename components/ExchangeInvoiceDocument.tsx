'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SNAPPY_BANK_ACCOUNTS, SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import { formatMoney } from '@/lib/payment-routing';
import { resolvePaymentReference } from '@/lib/payment-reference';
import { formatBuyRate } from '@/lib/rmb-exchange';

type Props = {
  exchange: {
    exchange_number: string;
    created_at: string;
    customer_name?: string;
    email?: string | null;
    phone?: string;
    business_name?: string | null;
    rate?: number;
    amount_from?: number;
    amount_to?: number;
    currency_from?: string;
    currency_to?: string;
    due_at?: string | null;
    metadata?: Record<string, any> | null;
  };
};

function formatAmount(n: number): string {
  return (n || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Quiet screen-only copy control. Never included in the official PDF layout. */
function InlineCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      alert(`Copy this: ${value}`);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      data-html2canvas-ignore="true"
      className="ml-1 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline print:hidden"
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

export default function ExchangeInvoiceDocument({ exchange }: Props) {
  const currency = exchange.currency_from || 'GHS';
  const amountFrom = Number(exchange.amount_from || 0);
  const amountTo = Number(exchange.amount_to || 0);
  const rate = Number(exchange.rate || 0);
  const paymentRef = resolvePaymentReference(
    exchange.metadata?.payment_ref,
    exchange.exchange_number,
  );
  const description = `Buy RMB (${formatBuyRate(rate, 4)})`;

  return (
    <div id="exchange-invoice-print" className="bg-white text-slate-900">
      {/* ─── On-screen invoice: same official structure, plus copy buttons ─── */}
      <div className="invoice-screen text-xs leading-snug text-black sm:text-[13px]">
        <div className="flex flex-col gap-3 border-b border-black pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className="h-16 w-auto object-contain sm:h-20"
            />
            <div>
              <p className="text-sm font-bold sm:text-base">{SNAPPY_INVOICE_ISSUER.brand}</p>
              <div className="mt-0.5 text-[10px] leading-[1.5] text-slate-700 sm:text-[11px]">
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', ')}</p>
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(2).join(', ')}</p>
                <p>
                  {SNAPPY_INVOICE_ISSUER.contactName}, {SNAPPY_INVOICE_ISSUER.phones.join(' / ')}
                </p>
                <p>{SNAPPY_INVOICE_ISSUER.email}</p>
              </div>
            </div>
          </div>
          <p className="text-xl font-bold tracking-wide sm:text-2xl">INVOICE</p>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-8">
          <div>
            <p className="font-bold uppercase tracking-wide">Bill to</p>
            <p className="mt-0.5 font-semibold">{exchange.customer_name || 'Customer'}</p>
            {exchange.business_name ? <p>{exchange.business_name}</p> : null}
            {exchange.email ? <p>{exchange.email}</p> : null}
            {exchange.phone ? <p>{exchange.phone}</p> : null}
            {paymentRef ? (
              <p className="mt-2">
                Transfer code (optional):{' '}
                <span className="font-mono font-bold">{paymentRef}</span>
                <InlineCopy value={paymentRef} />
              </p>
            ) : null}
          </div>
          <table className="w-full border-collapse self-start">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Invoice No.:</td>
                <td className="py-0.5 text-right">{exchange.exchange_number}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Issue date:</td>
                <td className="py-0.5 text-right">
                  {new Date(exchange.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
              {exchange.due_at ? (
                <tr>
                  <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Due date:</td>
                  <td className="py-0.5 text-right">
                    {new Date(exchange.due_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Service:</td>
                <td className="py-0.5 text-right">Buy RMB</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left text-[10px] sm:text-[11px]">
              <th className="py-1.5 pr-2 font-bold uppercase">Description</th>
              <th className="py-1.5 text-center font-bold uppercase">Qty</th>
              <th className="py-1.5 text-right font-bold uppercase">Unit price (GH¢)</th>
              <th className="py-1.5 pl-2 text-right font-bold uppercase">Amount (GH¢)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-300 align-top">
              <td className="py-1.5 pr-2">
                <span className="font-medium">{description}</span>
                <span className="block text-[10px] text-slate-600 sm:text-[11px]">
                  You receive {formatAmount(amountTo)} RMB
                </span>
              </td>
              <td className="py-1.5 text-center">1</td>
              <td className="py-1.5 text-right">{formatAmount(amountFrom)}</td>
              <td className="py-1.5 pl-2 text-right font-medium">{formatAmount(amountFrom)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-1.5 flex justify-end">
          <table className="w-full max-w-[18rem] border-collapse">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Payment method:</td>
                <td className="py-px text-right">Bank Transfer</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">RMB to receive:</td>
                <td className="py-px text-right">{formatAmount(amountTo)} RMB</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap border-t border-black py-0.5 pr-3 pt-1 font-bold">
                  TOTAL DUE ({currency})
                </td>
                <td className="border-t border-black py-0.5 pt-1 text-right text-sm font-bold sm:text-base">
                  {formatMoney(amountFrom, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 border-t border-black pt-2">
          <p className="font-bold uppercase tracking-wide">Payment details:</p>
          <p className="mt-0.5">
            Account holder: {SNAPPY_BANK_ACCOUNTS[0]?.holder || SNAPPY_INVOICE_ISSUER.legalName}
          </p>
          <div className="mt-1 space-y-1.5">
            {SNAPPY_BANK_ACCOUNTS.map((acc) => (
              <p key={acc.accountNumber}>
                {acc.channel === 'momo' ? 'Mobile Money' : 'Bank'}: {acc.bank}
                {acc.branch ? ` (${acc.branch})` : ''}
                {acc.registeredName ? `, Reg: ${acc.registeredName}` : ''}, Account No.:{' '}
                <span className="font-mono font-semibold">{acc.accountNumber}</span>
                <InlineCopy value={acc.accountNumber} />
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Official PDF / print layout (fixed A4 structure, no buttons) ─── */}
      <div className="invoice-official hidden text-[11px] leading-snug text-black">
        <div className="flex items-start justify-between gap-6 border-b border-black pb-3">
          <div className="flex items-start gap-4">
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className="h-20 w-auto object-contain"
            />
            <div>
              <p className="text-sm font-bold">{SNAPPY_INVOICE_ISSUER.brand}</p>
              <div className="mt-0.5 text-[10px] leading-[1.45]">
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', ')}</p>
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(2).join(', ')}</p>
                <p>
                  {SNAPPY_INVOICE_ISSUER.contactName}, {SNAPPY_INVOICE_ISSUER.phones.join(' / ')}
                </p>
                <p>{SNAPPY_INVOICE_ISSUER.email}</p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold tracking-wide">INVOICE</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold uppercase tracking-wide">Bill to</p>
            <p className="mt-0.5 font-semibold">{exchange.customer_name || 'Customer'}</p>
            {exchange.business_name ? <p>{exchange.business_name}</p> : null}
            {exchange.email ? <p>{exchange.email}</p> : null}
            {exchange.phone ? <p>{exchange.phone}</p> : null}
            {paymentRef ? (
              <p className="mt-1.5">
                Transfer code (optional):{' '}
                <span className="font-mono font-bold">{paymentRef}</span>
              </p>
            ) : null}
          </div>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Invoice No.:</td>
                <td className="py-px text-right">{exchange.exchange_number}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Issue date:</td>
                <td className="py-px text-right">
                  {new Date(exchange.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
              {exchange.due_at ? (
                <tr>
                  <td className="whitespace-nowrap py-px pr-3 font-semibold">Due date:</td>
                  <td className="py-px text-right">
                    {new Date(exchange.due_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Service:</td>
                <td className="py-px text-right">Buy RMB</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="mt-3 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 font-bold uppercase">Description</th>
              <th className="py-1.5 text-center font-bold uppercase">Quantity</th>
              <th className="py-1.5 text-right font-bold uppercase">Unit price (GH¢)</th>
              <th className="py-1.5 text-right font-bold uppercase">Amount (GH¢)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-300 align-top">
              <td className="py-1 pr-2">
                <span className="font-medium">{description}</span>
                <span className="block text-[10px]">You receive {formatAmount(amountTo)} RMB</span>
              </td>
              <td className="py-1 text-center">1</td>
              <td className="py-1 text-right">{formatAmount(amountFrom)}</td>
              <td className="py-1 text-right font-medium">{formatAmount(amountFrom)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-1 flex justify-end">
          <table className="w-64 border-collapse text-[11px]">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Payment method:</td>
                <td className="py-px text-right">Bank Transfer</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">RMB to receive:</td>
                <td className="py-px text-right">{formatAmount(amountTo)} RMB</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap border-t border-black py-0.5 pr-3 pt-1 font-bold">
                  TOTAL DUE ({currency})
                </td>
                <td className="border-t border-black py-0.5 pt-1 text-right text-sm font-bold">
                  {formatMoney(amountFrom, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 border-t border-black pt-1.5">
          <p className="font-bold uppercase tracking-wide">Payment details:</p>
          <p className="mt-0.5">
            Account holder: {SNAPPY_BANK_ACCOUNTS[0]?.holder || SNAPPY_INVOICE_ISSUER.legalName}
          </p>
          <div className="mt-0.5 space-y-0.5">
            {SNAPPY_BANK_ACCOUNTS.map((acc) => (
              <p key={acc.accountNumber}>
                {acc.channel === 'momo' ? 'Mobile Money' : 'Bank'}: {acc.bank}
                {acc.branch ? ` (${acc.branch})` : ''}
                {acc.registeredName ? `, Reg: ${acc.registeredName}` : ''}, Account No.:{' '}
                <span className="font-mono font-semibold">{acc.accountNumber}</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          #exchange-invoice-print .invoice-screen {
            display: none !important;
          }
          #exchange-invoice-print .invoice-official {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
