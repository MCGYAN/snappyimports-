'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SNAPPY_BANK_ACCOUNTS, SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import { formatMoney } from '@/lib/payment-routing';
import { resolvePaymentReference } from '@/lib/payment-reference';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';

type InvoiceItem = {
  product_name?: string;
  variant_name?: string | null;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  metadata?: {
    color?: string | null;
    size?: string | null;
  } | null;
};

type Props = {
  order: {
    order_number: string;
    created_at: string;
    email?: string;
    phone?: string;
    currency?: string;
    subtotal?: number;
    shipping_total?: number;
    total?: number;
    payment_status?: string;
    payment_method?: string;
    shipping_address?: Record<string, any>;
    metadata?: Record<string, any>;
    order_items?: InvoiceItem[];
  };
};

function itemVariantLabel(item: InvoiceItem): string {
  const color = item.metadata?.color || '';
  const size = item.metadata?.size || '';
  return (
    (color && size && color.toLowerCase() !== size.toLowerCase()
      ? `${color} / ${size}`
      : color || size || cleanVariantDisplayLabel(item.variant_name)) || ''
  );
}

function formatAmount(n: number): string {
  return (n || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Small inline copy button. Screen only: never shows in the PDF or print. */
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
      className="ml-1.5 inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 align-middle text-[10px] font-bold text-slate-700 transition-colors active:bg-slate-100 print:hidden"
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function InvoiceDocument({ order }: Props) {
  const addr = order.shipping_address || {};
  const billName =
    [addr.firstName, addr.lastName].filter(Boolean).join(' ') ||
    `${order.metadata?.first_name || ''} ${order.metadata?.last_name || ''}`.trim() ||
    order.email ||
    'Customer';
  const dueAt = order.metadata?.invoice_due_at;
  const currency = order.currency || 'GHS';
  const items = order.order_items || [];
  const paymentRef = resolvePaymentReference(
    order.metadata?.payment_ref,
    order.order_number,
  );
  const paymentLabel =
    order.payment_method === 'invoice' ? 'Bank Transfer' : order.payment_method || '—';

  return (
    <div id="invoice-print" className="bg-white text-slate-900">
      {/* ─── On-screen invoice: same official structure, plus copy buttons ─── */}
      <div className="invoice-screen text-xs leading-snug text-black sm:text-[13px]">
        {/* Header band */}
        <div className="flex flex-col gap-3 border-b border-black pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className="h-10 w-auto object-contain sm:h-12"
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

        {/* Bill to + invoice meta with totals */}
        <div className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-8">
          <div>
            <p className="font-bold uppercase tracking-wide">Bill to</p>
            <p className="mt-0.5 font-semibold">{billName}</p>
            {order.email ? <p>{order.email}</p> : null}
            {order.phone || addr.phone ? <p>{order.phone || addr.phone}</p> : null}
            <p>{[addr.address, addr.city, addr.region].filter(Boolean).join(', ')}</p>
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
                <td className="py-0.5 text-right">{order.order_number}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Issue date:</td>
                <td className="py-0.5 text-right">
                  {new Date(order.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
              {dueAt ? (
                <tr>
                  <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Due date:</td>
                  <td className="py-0.5 text-right">
                    {new Date(dueAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Payment method:</td>
                <td className="py-0.5 text-right capitalize">{paymentLabel}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">
                  Subtotal ({currency}):
                </td>
                <td className="py-0.5 text-right">{formatMoney(order.subtotal || 0, currency)}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Shipping:</td>
                <td className="py-0.5 text-right">
                  {(order.shipping_total || 0) === 0
                    ? 'FREE / TBA'
                    : formatMoney(order.shipping_total || 0, currency)}
                </td>
              </tr>
              <tr>
                <td className="whitespace-nowrap border-t border-black py-1 pr-3 pt-1.5 font-bold">
                  TOTAL DUE ({currency})
                </td>
                <td className="border-t border-black py-1 pt-1.5 text-right text-sm font-bold sm:text-base">
                  {formatMoney(order.total || 0, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Items */}
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
            {items.map((item, i) => {
              const variantLabel = itemVariantLabel(item);
              return (
                <tr key={i} className="border-b border-slate-300 align-top">
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{item.product_name}</span>
                    {variantLabel ? (
                      <span className="text-[10px] text-slate-600 sm:text-[11px]">
                        {' '}
                        ({variantLabel})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-center">{item.quantity}</td>
                  <td className="py-1.5 text-right">{formatAmount(item.unit_price || 0)}</td>
                  <td className="py-1.5 pl-2 text-right font-medium">
                    {formatAmount(item.total_price || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Payment details */}
        <div className="mt-4 border-t border-black pt-2">
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
        {/* Header band: logo + INVOICE on one row, issuer packed beside it */}
        <div className="flex items-start justify-between gap-6 border-b border-black pb-3">
          <div className="flex items-start gap-4">
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className="h-12 w-auto object-contain"
            />
            <div>
              <p className="text-sm font-bold">{SNAPPY_INVOICE_ISSUER.brand}</p>
              <div className="mt-0.5 text-[10px] leading-[1.45]">
                <p>
                  {SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', ')}
                </p>
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

        {/* Bill to + meta with totals folded in (saves the bottom totals block) */}
        <div className="mt-3 grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold uppercase tracking-wide">Bill to</p>
            <p className="mt-0.5 font-semibold">{billName}</p>
            {order.email ? <p>{order.email}</p> : null}
            {order.phone || addr.phone ? <p>{order.phone || addr.phone}</p> : null}
            <p>{[addr.address, addr.city, addr.region].filter(Boolean).join(', ')}</p>
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
                <td className="py-px text-right">{order.order_number}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Issue date:</td>
                <td className="py-px text-right">
                  {new Date(order.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
              {dueAt ? (
                <tr>
                  <td className="whitespace-nowrap py-px pr-3 font-semibold">Due date:</td>
                  <td className="py-px text-right">
                    {new Date(dueAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Payment method:</td>
                <td className="py-px text-right capitalize">{paymentLabel}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Subtotal ({currency}):</td>
                <td className="py-px text-right">{formatMoney(order.subtotal || 0, currency)}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Shipping:</td>
                <td className="py-px text-right">
                  {(order.shipping_total || 0) === 0
                    ? 'FREE / TBA'
                    : formatMoney(order.shipping_total || 0, currency)}
                </td>
              </tr>
              <tr>
                <td className="whitespace-nowrap border-t border-black py-0.5 pr-3 pt-1.5 font-bold">
                  TOTAL DUE ({currency})
                </td>
                <td className="border-t border-black py-0.5 pt-1.5 text-right text-sm font-bold">
                  {formatMoney(order.total || 0, currency)}
                </td>
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
            {items.map((item, i) => {
              const variantLabel = itemVariantLabel(item);
              return (
                <tr key={i} className="border-b border-slate-300 align-top">
                  <td className="py-1 pr-2">
                    <span className="font-medium">{item.product_name}</span>
                    {variantLabel ? <span className="text-[10px]"> ({variantLabel})</span> : null}
                  </td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">{formatAmount(item.unit_price || 0)}</td>
                  <td className="py-1 text-right font-medium">
                    {formatAmount(item.total_price || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-3 border-t border-black pt-2">
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
          #invoice-print .invoice-screen {
            display: none !important;
          }
          #invoice-print .invoice-official {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
