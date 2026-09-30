'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import InvoicePaymentFooter from '@/components/InvoicePaymentFooter';
import InvoiceWatermark from '@/components/InvoiceWatermark';
import { SNAPPY_BANK_ACCOUNTS, SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';
import {
  EXCHANGE_CORRIDORS,
  formatCorridorBuyRate,
  parseExchangeCountryCode,
} from '@/lib/exchange-corridors';
import { SITE_INVOICE_LOGO_PATH } from '@/lib/brand';
import {
  INVOICE_FOOTER_BOTTOM_PX,
  INVOICE_PAGE_HEIGHT_PX,
  invoiceAddressClass,
  invoiceBodyClass,
  invoiceCompanyNameClass,
  invoiceLogoClass,
  invoiceOfficialPageClass,
  invoicePaymentFooterClass,
  invoiceTableHeaderClass,
  invoiceTitleClass,
  invoiceTotalAmountClass,
  invoiceTypographyClass,
  invoiceVariantClass,
} from '@/lib/invoice-layout';
import { formatMoney } from '@/lib/payment-routing';
import { cleanVariantDisplayLabel } from '@/lib/product-variants';

export type FinancialDocumentRecord = {
  id: string;
  document_number: string;
  document_type: 'invoice' | 'receipt';
  flow: 'shop' | 'rmb' | 'shipping' | 'manual';
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
  manual: 'Invoice',
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

  if (
    (document.flow === 'shop' || document.flow === 'manual') &&
    Array.isArray(data.items) &&
    data.items.length > 0
  ) {
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

/** One A4 sheet of a paged preview. */
type PaperSegment = {
  lines: Line[];
  letterhead: boolean;
  totals: boolean;
  footer: boolean;
};

/** Top gap above the repeated table header on continuation sheets. */
const CONTINUATION_TOP_PX = 24;
/** Bottom margin for sheets that do not carry the payment footer. */
const SHEET_BOTTOM_MARGIN_PX = 24;

function Paper({
  document,
  variant,
  segment,
  fluid = false,
}: {
  document: FinancialDocumentRecord;
  variant: 'screen' | 'official';
  segment?: PaperSegment;
  /** Grow with content instead of a fixed A4 box (used to measure rows). */
  fluid?: boolean;
}) {
  const isReceipt = document.document_type === 'receipt';
  const data = document.data || {};
  const lines = segment?.lines ?? buildLines(document);
  const showLetterhead = segment?.letterhead ?? true;
  const showTotals = segment?.totals ?? true;
  const showFooter = segment?.footer ?? true;
  const currency = document.currency || 'GHS';
  const title = isReceipt ? 'RECEIPT' : 'INVOICE';
  const expired =
    !isReceipt &&
    (document.status === 'expired' ||
      document.status === 'void' ||
      (document.due_at ? new Date(document.due_at).getTime() < Date.now() : false));

  const isOfficial = variant === 'official';
  const base = isOfficial
    ? invoiceTypographyClass
    : 'text-[13px] leading-snug text-black sm:text-[11px]';
  const logoSize = invoiceLogoClass;
  const titleSize = isOfficial
    ? invoiceTitleClass
    : 'text-[1.65rem] font-bold tracking-wide sm:text-2xl';
  const addressClass = isOfficial
    ? invoiceAddressClass
    : 'text-[12px] leading-snug text-slate-700 sm:text-[10px] sm:leading-[1.45]';
  const tableHeadClass = isOfficial
    ? invoiceTableHeaderClass
    : 'text-[11px] sm:text-[10px]';
  const detailClass = isOfficial
    ? invoiceVariantClass
    : 'text-[12px] text-slate-600 sm:text-[10px]';

  const footer = isReceipt ? (
    <div
      {...(isOfficial ? { 'data-invoice-footer': '' } : {})}
      className={isOfficial ? invoicePaymentFooterClass : 'mt-3 pt-2 leading-normal'}
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
      pdfMode="single"
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
      pinned={!isOfficial}
      pdfMode="single"
      note={
        document.flow === 'shipping'
          ? 'This cedi amount is held until the due date because the dollar rate changes. After the due date, request a fresh bill from your account page.'
          : undefined
      }
    />
  );

  return (
    <div
      className={`${base} relative bg-white leading-snug text-black ${
        fluid ? 'box-border' : isOfficial ? invoiceOfficialPageClass : 'relative min-h-[1043px]'
      }`}
      {...(isOfficial && !fluid ? { 'data-invoice-mode': 'single', 'data-invoice-a4': '' } : {})}
    >
      <InvoiceWatermark />
      <div
        className={
          !showFooter
            ? 'relative z-[1]'
            : isOfficial
              ? invoiceBodyClass
              : 'relative z-[1] pb-[168px]'
        }
      >
      {showLetterhead ? (
      <>
      <div className="flex flex-col gap-3 border-b border-black pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <img
            src={SITE_INVOICE_LOGO_PATH}
            alt={SNAPPY_INVOICE_ISSUER.brand}
            className={logoSize}
          />
          <div>
            <p className={invoiceCompanyNameClass}>{SNAPPY_INVOICE_ISSUER.brand}</p>
            <div className={`mt-0.5 ${addressClass}`}>
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
          {data.customer_phone ? <p>{String(data.customer_phone)}</p> : null}
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
      </>
      ) : null}

      {lines.length > 0 || showLetterhead ? (
      <table
        className="w-full border-collapse"
        style={{ marginTop: showLetterhead ? 16 : CONTINUATION_TOP_PX }}
      >
        <thead data-measure="thead">
          <tr className={`border-b-2 border-black text-left ${tableHeadClass}`}>
            <th className="py-1.5 pr-2 font-bold uppercase">Description</th>
            <th className="py-1.5 text-center font-bold uppercase">Qty</th>
            <th className="py-1.5 text-right font-bold uppercase">Unit price ({currency})</th>
            <th className="py-1.5 pl-2 text-right font-bold uppercase">Amount ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.description}-${index}`} data-measure="row" className="align-top">
              <td className="py-1.5 pr-2">
                <span className="font-medium">{line.description}</span>
                {line.detail ? (
                  <span className={`block ${detailClass}`}>
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
      ) : null}

      {showTotals ? (
      <div
        data-measure="totals"
        className="flex justify-end"
        style={{ marginTop: lines.length > 0 || showLetterhead ? 12 : CONTINUATION_TOP_PX }}
      >
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
      ) : null}
      </div>

      {showFooter ? footer : null}
    </div>
  );
}

type Measurements = {
  headBottom: number;
  theadHeight: number;
  rows: number[];
  totalsHeight: number;
  footerHeight: number;
};

function offsetWithin(element: HTMLElement, root: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== root) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

function measurePaper(root: HTMLElement): Measurements | null {
  const thead = root.querySelector<HTMLElement>('[data-measure="thead"]');
  const totals = root.querySelector<HTMLElement>('[data-measure="totals"]');
  const footer = root.querySelector<HTMLElement>('[data-invoice-footer]');
  if (!thead || !totals || !footer) return null;
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-measure="row"]')).map(
    (row) => row.offsetHeight,
  );
  return {
    headBottom: offsetWithin(thead, root) + thead.offsetHeight,
    theadHeight: thead.offsetHeight,
    rows,
    totalsHeight: totals.offsetHeight + 12,
    footerHeight: footer.offsetHeight,
  };
}

/** Same rules as the server PDF: rows fill each sheet, total and payment details share the last one. */
function paginate(lines: Line[], m: Measurements): PaperSegment[] {
  const pageHeight = INVOICE_PAGE_HEIGHT_PX;
  const rowsBottom = pageHeight - SHEET_BOTTOM_MARGIN_PX;
  const footerTop = pageHeight - INVOICE_FOOTER_BOTTOM_PX - m.footerHeight - 8;

  const ranges: Array<[number, number]> = [];
  let start = 0;
  let y = m.headBottom;
  m.rows.forEach((height, index) => {
    if (index > start && y + height > rowsBottom) {
      ranges.push([start, index]);
      start = index;
      y = CONTINUATION_TOP_PX + m.theadHeight;
    }
    y += height;
  });
  ranges.push([start, m.rows.length]);

  const segments: PaperSegment[] = ranges.map(([from, to], index) => ({
    lines: lines.slice(from, to),
    letterhead: index === 0,
    totals: false,
    footer: false,
  }));

  const last = segments[segments.length - 1];
  if (y + m.totalsHeight <= footerTop) {
    last.totals = true;
    last.footer = true;
  } else {
    segments.push({ lines: [], letterhead: false, totals: true, footer: true });
  }
  return segments;
}

function PagedPaper({ document }: { document: FinancialDocumentRecord }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [segments, setSegments] = useState<PaperSegment[] | null>(null);

  useLayoutEffect(() => {
    const root = measureRef.current?.firstElementChild as HTMLElement | null;
    if (!root) return;
    const lines = buildLines(document);
    const update = () => {
      const m = measurePaper(root);
      setSegments(m ? paginate(lines, m) : null);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [document]);

  return (
    <div className="relative">
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 -z-10"
      >
        <Paper document={document} variant="official" fluid />
      </div>
      {segments ? (
        <div className="space-y-4">
          {segments.map((segment, index) => (
            <div key={index} className="shadow-sm">
              <Paper document={document} variant="official" segment={segment} />
            </div>
          ))}
        </div>
      ) : (
        <Paper document={document} variant="official" />
      )}
    </div>
  );
}

export default function FinancialDocumentPaper({
  document,
  mode = 'both',
}: {
  document: FinancialDocumentRecord;
  /** Admin generator preview can show the official pinned layout only, or split into A4 sheets. */
  mode?: 'both' | 'screen' | 'official' | 'paged';
}) {
  if (mode === 'paged') {
    return (
      <div id="financial-document-print" className="text-slate-900">
        <PagedPaper document={document} />
      </div>
    );
  }

  if (mode === 'official') {
    return (
      <div id="financial-document-print" className="bg-white text-slate-900">
        <Paper document={document} variant="official" />
      </div>
    );
  }

  if (mode === 'screen') {
    return (
      <div id="financial-document-print" className="bg-white text-slate-900">
        <Paper document={document} variant="screen" />
      </div>
    );
  }

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
