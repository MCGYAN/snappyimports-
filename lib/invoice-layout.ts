/** Inner content height for one A4 page at 794px capture width (see download-pdf.ts). */
export const INVOICE_PAGE_HEIGHT_PX = 1043;

/** Space reserved so body content does not overlap the pinned footer. */
export const INVOICE_FOOTER_RESERVE_PX = 148;

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

export const invoiceOfficialPageClass = 'relative box-border h-[1043px] overflow-hidden';

export const invoiceOfficialMultiPageClass = 'relative box-border';

export const invoiceBodyClass = 'pb-[148px]';

/** Pinned to the page bottom during single-page PDF capture. */
export const invoicePaymentFooterClass =
  'absolute inset-x-0 bottom-0 bg-white pt-4 leading-normal';

/** Flows after totals on the last page of a multi-page PDF. */
export const invoicePaymentFooterMultiClass = 'mt-8 bg-white pt-4 leading-normal';

export const INVOICE_A4_ATTR = 'data-invoice-a4';
export const INVOICE_MODE_ATTR = 'data-invoice-mode';
export const INVOICE_FOOTER_ATTR = 'data-invoice-footer';
