/** Inner content height for one A4 page at 794px capture width (see download-pdf.ts). */
export const INVOICE_PAGE_HEIGHT_PX = 1043;

/** Space reserved so body content does not overlap the pinned footer. */
export const INVOICE_FOOTER_RESERVE_PX = 148;

export const invoiceOfficialPageClass = 'relative box-border h-[1043px] overflow-hidden';

export const invoiceBodyClass = 'pb-[148px]';

/** Pinned to the page bottom during PDF capture via absolute positioning. */
export const invoicePaymentFooterClass =
  'absolute inset-x-0 bottom-0 bg-white pt-4 leading-normal';

export const INVOICE_A4_ATTR = 'data-invoice-a4';
export const INVOICE_FOOTER_ATTR = 'data-invoice-footer';
