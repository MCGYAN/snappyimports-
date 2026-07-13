'use client';

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

  return (
    <div id="invoice-print" className="bg-white text-slate-900">
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <img
            src={SITE_LOGO_LIGHT_BG_PATH}
            alt={SNAPPY_INVOICE_ISSUER.brand}
            className="mb-4 h-12 w-auto object-contain sm:h-14"
          />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Invoice</p>
          <h2 className="mt-1 font-heading text-2xl font-bold text-brand-primary">
            {SNAPPY_INVOICE_ISSUER.brand}
          </h2>
          <div className="mt-3 space-y-0.5 text-sm text-slate-600">
            {SNAPPY_INVOICE_ISSUER.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="pt-2 font-medium text-slate-800">{SNAPPY_INVOICE_ISSUER.contactName}</p>
            {SNAPPY_INVOICE_ISSUER.phones.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p>{SNAPPY_INVOICE_ISSUER.email}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-5 py-4 text-sm sm:min-w-[220px]">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Invoice No.</span>
            <span className="font-bold text-brand-primary">{order.order_number}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-500">Issue date</span>
            <span className="font-medium">
              {new Date(order.created_at).toLocaleDateString('en-GB')}
            </span>
          </div>
          {dueAt && (
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-slate-500">Due date</span>
              <span className="font-medium">{new Date(dueAt).toLocaleDateString('en-GB')}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-slate-500">Payment</span>
            <span className="font-medium capitalize">
              {order.payment_method === 'invoice' ? 'Bank Transfer' : order.payment_method || '—'}
            </span>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total due</p>
            <p className="text-2xl font-black text-brand-accent">
              {formatMoney(order.total || 0, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill to</p>
          <p className="mt-1 font-semibold text-brand-primary">{billName}</p>
          <p className="text-sm text-slate-600">{order.email}</p>
          <p className="text-sm text-slate-600">{order.phone || addr.phone}</p>
          <p className="mt-1 text-sm text-slate-600">
            {[addr.address, addr.city, addr.region].filter(Boolean).join(', ')}
          </p>
        </div>
        <div>
          <PaymentReferenceHint code={paymentRef} supportId={order.order_number} />
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th className="py-3 font-semibold">Description</th>
              <th className="py-3 font-semibold">Qty</th>
              <th className="py-3 font-semibold">Unit</th>
              <th className="py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const color = item.metadata?.color || '';
              const size = item.metadata?.size || '';
              const variantLabel =
                (color && size && color.toLowerCase() !== size.toLowerCase()
                  ? `${color} / ${size}`
                  : color || size || cleanVariantDisplayLabel(item.variant_name)) || '';
              return (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-3">
                  <p className="font-medium text-slate-900">{item.product_name}</p>
                  {variantLabel ? (
                    <p className="mt-0.5 text-xs font-semibold text-brand-primary">
                      {color && !size ? `Color: ${color}` : variantLabel}
                    </p>
                  ) : null}
                </td>
                <td className="py-3">{item.quantity}</td>
                <td className="py-3">{formatMoney(item.unit_price || 0, currency)}</td>
                <td className="py-3 text-right font-semibold">
                  {formatMoney(item.total_price || 0, currency)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">
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
            <span className="font-bold">Total</span>
            <span className="font-black text-brand-accent">
              {formatMoney(order.total || 0, currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Payment details</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SNAPPY_BANK_ACCOUNTS.map((acc) => (
            <div key={acc.accountNumber} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="font-semibold text-brand-primary">{acc.bank}</p>
              <p className="mt-1 text-sm text-slate-600">{acc.holder}</p>
              {acc.registeredName ? (
                <p className="text-xs text-slate-500">{acc.registeredName}</p>
              ) : null}
              {acc.branch ? <p className="text-xs text-slate-400">{acc.branch}</p> : null}
              <p className="mt-2 font-mono text-lg font-bold tracking-wide text-slate-900">
                {acc.accountNumber}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
