'use client';

import InvoicePaymentFooter from '@/components/InvoicePaymentFooter';
import { SNAPPY_BANK_ACCOUNTS, SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';
import {
  EXCHANGE_CORRIDORS,
  formatCorridorBuyRate,
  parseExchangeCountryCode,
} from '@/lib/exchange-corridors';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import {
  invoiceAddressClass,
  invoiceBodyClass,
  invoiceCompanyNameClass,
  invoiceLogoClass,
  invoiceOfficialMultiPageClass,
  invoiceOfficialPageClass,
  invoicePaymentFooterClass,
  invoicePaymentFooterMultiClass,
  invoiceTableHeaderClass,
  invoiceTitleClass,
  invoiceTotalAmountClass,
  invoiceTypographyClass,
  invoiceVariantClass,
  resolveInvoicePdfMode,
} from '@/lib/invoice-layout';
import { formatMoney } from '@/lib/payment-routing';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';

export type FinancialDocumentRecord = {
  id: string;
  document_number: string;
  document_type: 'invoice' | 'receipt';
  flow: 'shop' | 'rmb' | 'shipping';
  currency: string;
  amount: number;
  status: string;
  issued_at: string;
  due_at?: string | null;
  paid_at?: string | null;
  customer_email?: string | null;
  shipping_package_id?: string | null;
  shipping_packages?:
    | { shipping_payment_status?: string | null }
    | { shipping_payment_status?: string | null }[]
    | null;
  data?: Record<string, any> | null;
};

type Line = {
  description: string;
  detail?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

const SERVICE_LABELS: Record<FinancialDocumentRecord['flow'], string> = {
  shop: 'Product order',
  rmb: 'Buy RMB',
  shipping: 'Shipping to Ghana',
};

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB');
}

function variantLabel(item: any) {
  const color = item?.metadata?.color || '';
  const size = item?.metadata?.size || '';
  if (color && size && color.toLowerCase() !== size.toLowerCase()) return `${color} / ${size}`;
  return color || size || cleanVariantDisplayLabel(item?.variant_name) || '';
}

function buildLines(document: FinancialDocumentRecord): Line[] {
  const data = document.data || {};

  if (document.flow === 'shop' && Array.isArray(data.items) && data.items.length > 0) {
    return data.items.map((item: any) => {
      const label = variantLabel(item);
      const quantity = Number(item.quantity) || 1;
      const total = Number(item.total_price) || 0;
      return {
        description: item.product_name || 'Item',
        detail: label || undefined,
        quantity,
        unitPrice: Number(item.unit_price) || (quantity ? total / quantity : 0),
        amount: total,
      };
    });
  }

  if (document.flow === 'rmb') {
    const rate = Number(data.rate) || 0;
    const country = parseExchangeCountryCode(data.country_code);
    return [
      {
        description: `Buy RMB, ${EXCHANGE_CORRIDORS[country].name}`,
        detail: [
          data.amount_to ? `You receive ${formatAmount(Number(data.amount_to))} RMB` : '',
          rate ? formatCorridorBuyRate(rate, country, 4) : '',
        ]
          .filter(Boolean)
          .join('. '),
        quantity: 1,
        unitPrice: Number(document.amount) || 0,
        amount: Number(document.amount) || 0,
      },
    ];
  }

  if (document.flow === 'shipping') {
    const cbm = Number(data.cbm) || 0;
    const usdPerCbm = Number(data.usd_per_cbm) || 0;
    const shippingUsd = Number(data.shipping_usd) || 0;
    const usdToGhs = Number(data.usd_to_ghs) || 0;
    const contents = Array.isArray(data.contents)
      ? data.contents
          .map(
            (entry: any) =>
              `${entry.product_name || 'Item'} × ${entry.quantity || 1}${
                entry.order_number ? ` (${entry.order_number})` : ''
              }`,
          )
          .join(', ')
      : '';
    const detail = data.freight_included
      ? 'Freight is already included in the product price.'
      : [
          data.package_name ? `Package: ${data.package_name}` : '',
          contents ? `Inside: ${contents}` : '',
          `${cbm.toFixed(3)} CBM x $${formatAmount(usdPerCbm)} per CBM = $${formatAmount(shippingUsd)}`,
          usdToGhs ? `Arrival day rate GH¢${formatAmount(usdToGhs)} per $1` : '',
        ]
          .filter(Boolean)
          .join('. ');
    return [
      {
        description: 'Sea freight, China to Ghana',
        detail: [data.tracking_id ? `Tracking ${data.tracking_id}` : '', detail]
          .filter(Boolean)
          .join('. '),
        quantity: 1,
        unitPrice: Number(document.amount) || 0,
        amount: Number(document.amount) || 0,
      },
    ];
  }

  return [
    {
      description: SERVICE_LABELS[document.flow],
      quantity: 1,
      unitPrice: Number(document.amount) || 0,
      amount: Number(document.amount) || 0,
    },
  ];
}

function Paper({
  document,
  variant,
}: {
  document: FinancialDocumentRecord;
  variant: 'screen' | 'official';
}) {
  const isReceipt = document.document_type === 'receipt';
  const data = document.data || {};
  const lines = buildLines(document);
  const currency = document.currency || 'GHS';
  const title = isReceipt ? 'RECEIPT' : 'INVOICE';
  const expired =
    !isReceipt &&
    (document.status === 'expired' ||
      document.status === 'void' ||
      (document.due_at ? new Date(document.due_at).getTime() < Date.now() : false));

  const base = invoiceTypographyClass;
  const isOfficial = variant === 'official';
  const logoSize = isOfficial ? invoiceLogoClass : 'h-16 w-auto object-contain sm:h-24';
  const titleSize = isOfficial ? invoiceTitleClass : 'text-xl font-bold tracking-wide sm:text-2xl';
  const pdfMode = isOfficial ? resolveInvoicePdfMode(lines.length) : 'single';
  const isSinglePage = pdfMode === 'single';

  const receiptFooterClass = isOfficial
    ? isSinglePage
      ? invoicePaymentFooterClass
      : invoicePaymentFooterMultiClass
    : 'mt-3 pt-2 leading-normal';

  const footer = isReceipt ? (
    <div
      {...(isOfficial ? { 'data-invoice-footer': '' } : {})}
      className={receiptFooterClass}
    >
      <p className="font-bold uppercase tracking-wide">Payment received</p>
      <p className="mt-1">
        Snappy Imports Global confirms full payment of{' '}
        {formatMoney(Number(document.amount) || 0, currency)} for{' '}
        {SERVICE_LABELS[document.flow].toLowerCase()}
        {data.reference ? ` ${data.reference}` : ''}. Thank you for your business.
      </p>
      <p className="mt-1 text-[10px] text-slate-600">
        Keep this receipt. It is your proof of payment and no further amount is owed on this item.
      </p>
    </div>
  ) : isOfficial ? (
    <InvoicePaymentFooter
      accounts={SNAPPY_BANK_ACCOUNTS}
      pdfMode={pdfMode}
      pinned
      note={
        document.flow === 'shipping'
          ? 'This cedi amount is held until the due date because the dollar rate changes. After the due date, request a fresh bill from your account page.'
          : undefined
      }
    />
  ) : (
    <InvoicePaymentFooter
      accounts={SNAPPY_BANK_ACCOUNTS}
      withCopy
      note={
        document.flow === 'shipping'
          ? 'This cedi amount is held until the due date because the dollar rate changes. After the due date, request a fresh bill from your account page.'
          : undefined
      }
    />
  );

  return (
    <div
      className={`${base} bg-white leading-snug text-black ${
        isOfficial
          ? isSinglePage
            ? invoiceOfficialPageClass
            : invoiceOfficialMultiPageClass
          : ''
      }`}
      {...(isOfficial ? { 'data-invoice-mode': pdfMode } : {})}
      {...(isOfficial && isSinglePage ? { 'data-invoice-a4': '' } : {})}
    >
      <div className={isOfficial && isSinglePage ? invoiceBodyClass : undefined}>
      <div className="flex flex-col gap-3 border-b border-black pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <img
            src={SITE_LOGO_LIGHT_BG_PATH}
            alt={SNAPPY_INVOICE_ISSUER.brand}
            className={logoSize}
          />
          <div>
            <p className={invoiceCompanyNameClass}>{SNAPPY_INVOICE_ISSUER.brand}</p>
            <div className={`mt-0.5 ${invoiceAddressClass}`}>
              <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', ')}</p>
              <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(2).join(', ')}</p>
              <p>
                {SNAPPY_INVOICE_ISSUER.contactName}, {SNAPPY_INVOICE_ISSUER.phones.join(' / ')}
              </p>
              <p>{SNAPPY_INVOICE_ISSUER.email}</p>
            </div>
          </div>
        </div>
        <div className="sm:text-right">
          <p className={`${titleSize} font-bold tracking-wide`}>{title}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-700">
            {isReceipt ? 'Paid in full' : expired ? 'Expired' : 'Payment requested'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-2 sm:gap-8">
        <div>
          <p className="font-bold uppercase tracking-wide">Bill to</p>
          <p className="mt-0.5 font-semibold">{data.customer_name || 'Customer'}</p>
          {document.customer_email ? <p>{document.customer_email}</p> : null}
        </div>
        <table className="w-full border-collapse self-start">
          <tbody>
            <tr>
              <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">
                {isReceipt ? 'Receipt No.:' : 'Invoice No.:'}
              </td>
              <td className="py-0.5 text-right">{document.document_number}</td>
            </tr>
            {data.reference ? (
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Reference:</td>
                <td className="py-0.5 text-right">{data.reference}</td>
              </tr>
            ) : null}
            <tr>
              <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Issue date:</td>
              <td className="py-0.5 text-right">{formatDate(document.issued_at)}</td>
            </tr>
            {isReceipt && document.paid_at ? (
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Payment date:</td>
                <td className="py-0.5 text-right">{formatDate(document.paid_at)}</td>
              </tr>
            ) : null}
            {!isReceipt && document.due_at ? (
              <tr>
                <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Due date:</td>
                <td className="py-0.5 text-right">{formatDate(document.due_at)}</td>
              </tr>
            ) : null}
            <tr>
              <td className="whitespace-nowrap py-0.5 pr-3 font-semibold">Service:</td>
              <td className="py-0.5 text-right">{SERVICE_LABELS[document.flow]}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={isOfficial ? undefined : '-mx-1 overflow-x-auto'}>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className={`border-b-2 border-black text-left ${invoiceTableHeaderClass}`}>
            <th className="py-1.5 pr-2 font-bold uppercase">Description</th>
            <th className="py-1.5 text-center font-bold uppercase">Qty</th>
            <th className="py-1.5 text-right font-bold uppercase">Unit price ({currency})</th>
            <th className="py-1.5 pl-2 text-right font-bold uppercase">Amount ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.description}-${index}`} className="align-top">
              <td className="py-1.5 pr-2">
                <span className="font-medium">{line.description}</span>
                {line.detail ? (
                  <span className={`block ${invoiceVariantClass}`}>
                    {line.detail}
                  </span>
                ) : null}
              </td>
              <td className="py-1.5 text-center">{line.quantity}</td>
              <td className="py-1.5 text-right">{formatAmount(line.unitPrice)}</td>
              <td className="py-1.5 pl-2 text-right font-medium">{formatAmount(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="mt-3 flex justify-end">
        <div className="w-full max-w-[18rem] space-y-0.5 text-right">
          {data.payment_method ? (
            <div className="flex items-start justify-end gap-3">
              <span className="whitespace-nowrap font-semibold">Payment method:</span>
              <span className="capitalize">
                {String(data.payment_method) === 'invoice'
                  ? 'Bank Transfer'
                  : String(data.payment_method)}
              </span>
            </div>
          ) : null}
          {!isReceipt && data.invoice_valid_note ? (
            <div className="flex items-start justify-end gap-3">
              <span className="whitespace-nowrap font-semibold">Rate held until:</span>
              <span>{formatDate(document.due_at)}</span>
            </div>
          ) : null}
          <div className="flex items-start justify-end gap-3 pt-2">
            <span className="whitespace-nowrap font-bold">
              {isReceipt ? `TOTAL PAID (${currency})` : `TOTAL DUE (${currency})`}
            </span>
            <span className={invoiceTotalAmountClass}>
              {formatMoney(Number(document.amount) || 0, currency)}
            </span>
          </div>
        </div>
      </div>
      </div>

      {footer}
    </div>
  );
}

export default function FinancialDocumentPaper({
  document,
}: {
  document: FinancialDocumentRecord;
}) {
  return (
    <div id="financial-document-print" className="bg-white text-slate-900">
      <div className="document-screen">
        <Paper document={document} variant="screen" />
      </div>
      <div className="document-official hidden">
        <Paper document={document} variant="official" />
      </div>
    </div>
  );
}
