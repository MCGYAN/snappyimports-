import { STORE_CURRENCY, STORE_CURRENCY_SYMBOL, formatStoreMoney } from '@/lib/currency';

/**
 * Hybrid checkout routing: low totals → MoMo gateway, high totals → electronic invoice.
 */

/** Cart totals at or above this (store currency) use invoice + bank/MoMo transfer. */
export const INVOICE_PAYMENT_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_INVOICE_PAYMENT_THRESHOLD || 2000,
);

/** How long an unpaid invoice stays valid (hours). */
export const INVOICE_DUE_HOURS = Number(process.env.NEXT_PUBLIC_INVOICE_DUE_HOURS || 48);

export type CheckoutPaymentChannel = 'moolre' | 'invoice';

export function resolveCheckoutPaymentChannel(cartTotal: number): CheckoutPaymentChannel {
  if (!Number.isFinite(cartTotal) || cartTotal < 0) return 'moolre';
  return cartTotal >= INVOICE_PAYMENT_THRESHOLD ? 'invoice' : 'moolre';
}

export function getInvoiceDueAt(from: Date = new Date(), hours = INVOICE_DUE_HOURS): string {
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function isInvoiceExpired(dueAt?: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function formatMoney(amount: number, currency = STORE_CURRENCY): string {
  return formatStoreMoney(amount, currency);
}

export { STORE_CURRENCY, STORE_CURRENCY_SYMBOL };
