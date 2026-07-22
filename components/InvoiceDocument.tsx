'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SNAPPY_BANK_ACCOUNTS, SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import { formatMoney } from '@/lib/payment-routing';
import { resolvePaymentReference } from '@/lib/payment-reference';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';
import PaymentReferenceHint from '@/components/PaymentReferenceHint';

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

function CopyAccountNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      alert(`Account number: ${value}`);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg bg-slate-100 px-2.5 py-2 text-left transition-colors active:bg-slate-200"
      aria-label={`Copy account number ${value}`}
    >
      <span className="min-w-0 truncate font-mono text-sm font-bold tracking-wide text-slate-900">
        {value}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand-primary">
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </span>
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
      {/* ─── Interactive screen layout ─── */}
      <div className="invoice-screen">
        <div className="flex flex-col-reverse gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className="mb-3 h-10 w-auto object-contain sm:h-12"
            />
            <h2 className="font-heading text-lg font-bold text-brand-primary sm:text-xl">
              {SNAPPY_INVOICE_ISSUER.brand}
            </h2>
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-600 sm:text-sm">
              {SNAPPY_INVOICE_ISSUER.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p className="pt-1 font-semibold text-slate-800">{SNAPPY_INVOICE_ISSUER.contactName}</p>
              {SNAPPY_INVOICE_ISSUER.phones.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <p>{SNAPPY_INVOICE_ISSUER.email}</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm sm:min-w-[260px]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">
              Invoice
            </p>
            <div className="space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">No.</span>
                <span className="font-bold text-brand-primary">{order.order_number}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Issued</span>
                <span className="font-medium">
                  {new Date(order.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>
              {dueAt ? (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Due</span>
                  <span className="font-medium">{new Date(dueAt).toLocaleDateString('en-GB')}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                <span className="text-slate-500">Method</span>
                <span className="font-medium capitalize">{paymentLabel}</span>
              </div>
              <div className="pt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total due
                </p>
                <p className="mt-0.5 text-2xl font-black tracking-tight text-brand-accent">
                  {formatMoney(order.total || 0, currency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bill to</p>
            <p className="mt-1 font-semibold text-brand-primary">{billName}</p>
            <p className="text-sm text-slate-600">{order.email}</p>
            <p className="text-sm text-slate-600">{order.phone || addr.phone}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {[addr.address, addr.city, addr.region].filter(Boolean).join(', ')}
            </p>
          </div>
          <PaymentReferenceHint code={paymentRef} supportId={order.order_number} />
        </div>

        <div className="mt-6">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">Unit</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>

          <div className="flex flex-col">
            {items.map((item, i) => {
              const variantLabel = itemVariantLabel(item);
              return (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-1 border-b border-slate-100 py-3 sm:grid-cols-12 sm:items-center sm:gap-3"
                >
                  <div className="sm:col-span-6">
                    <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                    {variantLabel ? (
                      <p className="mt-0.5 text-xs font-medium text-brand-primary">
                        {item.metadata?.color && !item.metadata?.size
                          ? `Color: ${item.metadata.color}`
                          : variantLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between text-sm sm:contents">
                    <span className="text-slate-600 sm:col-span-2 sm:text-center">
                      <span className="sm:hidden">{item.quantity} × </span>
                      <span className="hidden sm:inline">{item.quantity}</span>
                      <span className="sm:hidden">
                        {formatMoney(item.unit_price || 0, currency)}
                      </span>
                    </span>
                    <span className="hidden text-right text-slate-600 sm:col-span-2 sm:block">
                      {formatMoney(item.unit_price || 0, currency)}
                    </span>
                    <span className="font-semibold text-slate-900 sm:col-span-2 sm:text-right">
                      {formatMoney(item.total_price || 0, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatMoney(order.subtotal || 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Shipping</span>
              <span className="font-medium">
                {(order.shipping_total || 0) === 0
                  ? 'FREE / TBA'
                  : formatMoney(order.shipping_total || 0, currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <span className="font-bold">Total due</span>
              <span className="font-black text-brand-accent">
                {formatMoney(order.total || 0, currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-brand-primary">How to pay</h3>
            <p className="text-xs text-slate-500">
              Transfer the exact total. Tap an account number to copy it.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {SNAPPY_BANK_ACCOUNTS.map((acc) => (
              <div
                key={acc.accountNumber}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {acc.channel === 'momo' ? 'Mobile Money' : 'Bank'}
                </p>
                <p className="mt-1 text-sm font-bold leading-tight text-brand-primary">{acc.bank}</p>
                <p className="mt-1 truncate text-[11px] text-slate-500">{acc.holder}</p>
                {acc.branch ? (
                  <p className="truncate text-[10px] text-slate-400">{acc.branch}</p>
                ) : null}
                {acc.registeredName ? (
                  <p className="truncate text-[10px] text-slate-400">{acc.registeredName}</p>
                ) : null}
                <CopyAccountNumber value={acc.accountNumber} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Official PDF / print layout (dense, matches 003.pdf) ─── */}
      <div className="invoice-official hidden text-[10px] leading-tight text-black">
        {/* Header: logo + brand left, INVOICE + issuer right on one band */}
        <div className="flex items-start justify-between gap-4 border-b border-black pb-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className="h-9 w-auto shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold leading-tight tracking-wide">
                {SNAPPY_INVOICE_ISSUER.brand}
              </p>
              <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-widest text-slate-600">
                Issued by
              </p>
              <p className="mt-0.5 text-[9px] leading-snug">
                {SNAPPY_INVOICE_ISSUER.addressLines.join(', ')}
              </p>
              <p className="mt-0.5 text-[9px]">
                <span className="font-semibold">{SNAPPY_INVOICE_ISSUER.contactName}</span>
                {', '}
                {SNAPPY_INVOICE_ISSUER.phones.join(', ')}
              </p>
              <p className="text-[9px]">{SNAPPY_INVOICE_ISSUER.email}</p>
            </div>
          </div>
          <p className="shrink-0 text-xl font-bold tracking-wide">INVOICE</p>
        </div>

        {/* Bill to + meta */}
        <div className="mt-2.5 grid grid-cols-2 gap-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide">Bill to</p>
            <p className="mt-0.5 text-[11px] font-semibold">{billName}</p>
            {order.email ? <p className="text-[9px]">{order.email}</p> : null}
            {order.phone || addr.phone ? (
              <p className="text-[9px]">{order.phone || addr.phone}</p>
            ) : null}
            <p className="text-[9px]">
              {[addr.address, addr.city, addr.region].filter(Boolean).join(', ')}
            </p>
            {paymentRef ? (
              <p className="mt-1 text-[9px]">
                Transfer code (optional):{' '}
                <span className="font-mono font-bold">{paymentRef}</span>
              </p>
            ) : null}
          </div>
          <table className="w-full border-collapse text-[10px]">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-px pr-2 font-semibold">Invoice No.:</td>
                <td className="py-px text-right">{order.order_number}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-2 font-semibold">Issue date:</td>
                <td className="py-px text-right">
                  {new Date(order.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
              {dueAt ? (
                <tr>
                  <td className="whitespace-nowrap py-px pr-2 font-semibold">Due date:</td>
                  <td className="py-px text-right">
                    {new Date(dueAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="whitespace-nowrap py-px pr-2 font-semibold">Payment method:</td>
                <td className="py-px text-right capitalize">{paymentLabel}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap border-t border-black py-1 pr-2 font-bold">
                  TOTAL DUE ({currency})
                </td>
                <td className="border-t border-black py-1 text-right text-[12px] font-bold">
                  {formatMoney(order.total || 0, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Line items: tight rows, short variants inline */}
        <table className="mt-2.5 w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="pb-1 pr-2 font-bold uppercase">Description</th>
              <th className="w-14 pb-1 text-center font-bold uppercase">Qty</th>
              <th className="w-24 pb-1 text-right font-bold uppercase">Unit (GH¢)</th>
              <th className="w-24 pb-1 text-right font-bold uppercase">Amount (GH¢)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const variantLabel = itemVariantLabel(item);
              const name = item.product_name || '';
              const inlineVariant =
                variantLabel && variantLabel.length <= 24 && name.length <= 42;
              return (
                <tr key={i} className="border-b border-slate-300 align-top">
                  <td className="py-1 pr-2">
                    {inlineVariant ? (
                      <p className="font-medium">
                        {name}
                        <span className="font-normal text-slate-600"> ({variantLabel})</span>
                      </p>
                    ) : (
                      <>
                        <p className="font-medium">{name}</p>
                        {variantLabel ? (
                          <p className="text-[9px] text-slate-600">{variantLabel}</p>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">
                    {(item.unit_price || 0).toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-1 text-right font-medium">
                    {(item.total_price || 0).toLocaleString('en-GH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-2 flex justify-end">
          <table className="w-52 border-collapse text-[10px]">
            <tbody>
              <tr>
                <td className="py-px pr-3">Subtotal</td>
                <td className="py-px text-right">
                  {formatMoney(order.subtotal || 0, currency)}
                </td>
              </tr>
              <tr>
                <td className="py-px pr-3">Shipping</td>
                <td className="py-px text-right">
                  {(order.shipping_total || 0) === 0
                    ? 'FREE / TBA'
                    : formatMoney(order.shipping_total || 0, currency)}
                </td>
              </tr>
              <tr>
                <td className="border-t border-black py-1 pr-3 font-bold">
                  TOTAL DUE ({currency})
                </td>
                <td className="border-t border-black py-1 text-right text-[11px] font-bold">
                  {formatMoney(order.total || 0, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment: holder once, banks packed like 003.pdf */}
        <div className="mt-2.5 border-t border-black pt-1.5">
          <p className="font-bold uppercase tracking-wide">Payment details:</p>
          <p className="mt-0.5">
            Account holder:{' '}
            {SNAPPY_BANK_ACCOUNTS[0]?.holder || SNAPPY_INVOICE_ISSUER.legalName}
          </p>
          <p className="mt-0.5 leading-snug">
            {SNAPPY_BANK_ACCOUNTS.map((acc, idx) => (
              <span key={acc.accountNumber}>
                {idx > 0 ? '; ' : null}
                {acc.channel === 'momo' ? 'MoMo' : 'Bank'}: {acc.bank}
                {acc.branch ? ` (${acc.branch})` : ''}
                {acc.registeredName ? `, Reg: ${acc.registeredName}` : ''}, Acct:{' '}
                <span className="font-mono font-semibold">{acc.accountNumber}</span>
              </span>
            ))}
          </p>
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
