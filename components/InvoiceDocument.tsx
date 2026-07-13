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
      <div className="flex flex-col-reverse gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between">
        <div>
          <img
            src={SITE_LOGO_LIGHT_BG_PATH}
            alt={SNAPPY_INVOICE_ISSUER.brand}
            className="mb-4 h-12 w-auto object-contain sm:h-14"
          />
          <h2 className="font-heading text-xl font-bold text-brand-primary sm:text-2xl">
            {SNAPPY_INVOICE_ISSUER.brand}
          </h2>
          <div className="mt-2 space-y-0.5 text-sm text-slate-600">
            {SNAPPY_INVOICE_ISSUER.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="pt-1.5 font-bold text-slate-800">{SNAPPY_INVOICE_ISSUER.contactName}</p>
            {SNAPPY_INVOICE_ISSUER.phones.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p>{SNAPPY_INVOICE_ISSUER.email}</p>
          </div>
        </div>
        
        <div className="rounded-2xl bg-slate-50 px-5 py-5 text-sm shadow-sm sm:min-w-[280px]">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Invoice Summary</p>
          <div className="space-y-3">
            <div className="flex justify-between gap-4">
              <span className="font-medium text-slate-500">Invoice No.</span>
              <span className="font-bold text-brand-primary">{order.order_number}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-medium text-slate-500">Issue date</span>
              <span className="font-bold text-slate-900">
                {new Date(order.created_at).toLocaleDateString('en-GB')}
              </span>
            </div>
            {dueAt && (
              <div className="flex justify-between gap-4">
                <span className="font-medium text-slate-500">Due date</span>
                <span className="font-bold text-brand-accent">{new Date(dueAt).toLocaleDateString('en-GB')}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-b border-slate-200 pb-3">
              <span className="font-medium text-slate-500">Payment</span>
              <span className="font-bold capitalize text-slate-900">
                {order.payment_method === 'invoice' ? 'Bank Transfer' : order.payment_method || '—'}
              </span>
            </div>
            <div className="pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total amount due</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-brand-accent">
                {formatMoney(order.total || 0, currency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill to</p>
          <div className="mt-3 space-y-1">
            <p className="font-bold text-brand-primary">{billName}</p>
            <p className="text-sm font-medium text-slate-600">{order.email}</p>
            <p className="text-sm font-medium text-slate-600">{order.phone || addr.phone}</p>
            <p className="text-sm text-slate-500">
              {[addr.address, addr.city, addr.region].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-brand-accent/20 bg-brand-light/30 p-5">
          <PaymentReferenceHint code={paymentRef} supportId={order.order_number} />
        </div>
      </div>

      <div className="mt-8">
        <div className="hidden grid-cols-12 gap-4 border-b border-slate-200 pb-3 text-xs font-bold uppercase tracking-wider text-slate-500 sm:grid print:grid">
          <div className="col-span-6">Description</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-2 text-right">Unit</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>
        
        <div className="flex flex-col">
          {items.map((item, i) => {
            const color = item.metadata?.color || '';
            const size = item.metadata?.size || '';
            const variantLabel =
              (color && size && color.toLowerCase() !== size.toLowerCase()
                ? `${color} / ${size}`
                : color || size || cleanVariantDisplayLabel(item.variant_name)) || '';
            
            return (
              <div key={i} className="grid grid-cols-1 gap-2 border-b border-slate-100 py-4 sm:grid-cols-12 sm:gap-4 sm:items-center print:grid-cols-12 print:gap-4 print:items-center">
                <div className="col-span-1 sm:col-span-6 print:col-span-6">
                  <p className="font-bold text-slate-900">{item.product_name}</p>
                  {variantLabel ? (
                    <p className="mt-0.5 inline-block rounded-md bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand-primary">
                      {color && !size ? `Color: ${color}` : variantLabel}
                    </p>
                  ) : null}
                </div>
                
                {/* Mobile view of pricing details */}
                <div className="mt-1 flex items-center justify-between text-sm sm:hidden print:hidden">
                  <div className="text-slate-600">
                    {item.quantity} × {formatMoney(item.unit_price || 0, currency)}
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatMoney(item.total_price || 0, currency)}
                  </div>
                </div>

                {/* Desktop view of pricing details */}
                <div className="hidden text-center text-sm font-medium text-slate-700 sm:col-span-2 sm:block print:block print:col-span-2">
                  {item.quantity}
                </div>
                <div className="hidden text-right text-sm text-slate-600 sm:col-span-2 sm:block print:block print:col-span-2">
                  {formatMoney(item.unit_price || 0, currency)}
                </div>
                <div className="hidden text-right text-sm font-bold text-slate-900 sm:col-span-2 sm:block print:block print:col-span-2">
                  {formatMoney(item.total_price || 0, currency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:justify-end print:flex-row print:justify-end">
        <div className="w-full rounded-2xl bg-slate-50 p-5 sm:max-w-sm">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Subtotal</span>
              <span className="font-bold text-slate-800">{formatMoney(order.subtotal || 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-slate-500">Shipping</span>
              <span className="font-bold text-slate-800">
                {(order.shipping_total || 0) === 0
                  ? 'FREE / TBA'
                  : formatMoney(order.shipping_total || 0, currency)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-lg sm:text-xl">
              <span className="font-black text-slate-900">Total Due</span>
              <span className="font-black text-brand-accent">
                {formatMoney(order.total || 0, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border-2 border-brand-accent/20 bg-brand-light/30 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-white">
            <i className="ri-bank-card-line text-lg"></i>
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-brand-primary">How to pay</h3>
            <p className="text-xs font-medium text-slate-500">Transfer the exact total to one of these accounts.</p>
          </div>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
          {SNAPPY_BANK_ACCOUNTS.map((acc) => (
            <div key={acc.accountNumber} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="absolute right-0 top-0 rounded-bl-xl bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {acc.channel === 'momo' ? 'Mobile Money' : 'Bank'}
              </div>
              <p className="pr-16 font-bold text-brand-primary">{acc.bank}</p>
              <div className="mt-3 space-y-0.5">
                <p className="text-sm font-medium text-slate-700">{acc.holder}</p>
                {acc.registeredName ? (
                  <p className="text-xs text-slate-500">Reg: {acc.registeredName}</p>
                ) : null}
                {acc.branch ? <p className="text-xs text-slate-500">Branch: {acc.branch}</p> : null}
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Account Number</p>
                <p className="font-mono text-lg font-bold tracking-wider text-slate-900">
                  {acc.accountNumber}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
