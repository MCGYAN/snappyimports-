/** Inner content height for one A4 page at 794px capture width (see download-pdf.ts). */
export const INVOICE_PAGE_HEIGHT_PX = 1043;

/** Space reserved so body content does not overlap the pinned footer. */
export const INVOICE_FOOTER_RESERVE_PX = 168;

/** Bottom inset for the pinned payment footer so the last line is not clipped in PDFs. */
export const INVOICE_FOOTER_BOTTOM_PX = 12;

/**
 * Line items at or below this count use a fixed single A4 page with the payment
 * footer pinned to the bottom. Above this, the PDF flows across multiple pages
 * and the footer appears once after the totals on the last page.
 */
export const INVOICE_SINGLE_PAGE_MAX_LINES = 8;

export type InvoicePdfMode = 'single' | 'multi';

export function resolveInvoicePdfMode(lineCount: number): InvoicePdfMode {
  return lineCount <= INVOICE_SINGLE_PAGE_MAX_LINES ? 'single' : 'multi';
}

/** Shared typography: screen preview matches downloaded PDF. */
export const invoiceTypographyClass = 'text-[11px] leading-snug text-black';
export const invoiceCompanyNameClass = 'text-sm font-bold';
export const invoiceAddressClass = 'text-[10px] leading-[1.45] text-slate-700';
export const invoiceTitleClass = 'text-2xl font-bold tracking-wide';
export const invoiceTableHeaderClass = 'text-[10px]';
export const invoiceVariantClass = 'text-[10px] text-slate-600';
export const invoiceTotalAmountClass = 'text-sm font-bold';
export const invoiceLogoClass = 'h-24 w-auto object-contain';

export const invoiceOfficialPageClass = 'relative box-border h-[1043px] overflow-hidden';

export const invoiceOfficialMultiPageClass = 'relative box-border';

export const invoiceBodyClass = 'pb-[168px]';

/** Pinned to the page bottom during single-page PDF capture. */
export const invoicePaymentFooterClass =
  'absolute inset-x-0 bottom-3 bg-white px-0 pt-4 pb-3 leading-normal';

/** Flows after totals on the last page of a multi-page PDF. */
export const invoicePaymentFooterMultiClass = 'mt-8 bg-white pt-4 pb-3 leading-normal';

export const INVOICE_A4_ATTR = 'data-invoice-a4';
export const INVOICE_MODE_ATTR = 'data-invoice-mode';
export const INVOICE_FOOTER_ATTR = 'data-invoice-footer';
