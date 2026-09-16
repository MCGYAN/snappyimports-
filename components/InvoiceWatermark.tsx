'use client';

import { SITE_INVOICE_WATERMARK_PATH } from '@/lib/brand';
import { invoiceWatermarkClass, invoiceWatermarkImageClass } from '@/lib/invoice-layout';

/** Soft centered brand mark for official invoices. */
export default function InvoiceWatermark() {
  return (
    <div className={invoiceWatermarkClass} aria-hidden="true" style={{ zIndex: 0 }}>
      <img
        src={SITE_INVOICE_WATERMARK_PATH}
        alt=""
        className={invoiceWatermarkImageClass}
        style={{ opacity: 0.04 }}
      />
    </div>
  );
}
