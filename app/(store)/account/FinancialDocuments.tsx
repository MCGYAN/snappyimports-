'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { formatStoreMoney } from '@/lib/currency';
import { downloadElementAsPdf, preloadPdfLibraries } from '@/lib/download-pdf';
import FinancialDocumentPaper, {
  type FinancialDocumentRecord,
} from '@/components/FinancialDocumentPaper';
import ScaledDocumentPreview from '@/components/ScaledDocumentPreview';

const FLOW_LABELS: Record<string, string> = {
  shop: 'Product order',
  rmb: 'Buy RMB',
  shipping: 'Shipping to Ghana',
};

function isMobilePdfDevice() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return (
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Mac/i.test(ua))
  );
}

function isAppleMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || '');
}

/**
 * Real Safari on iPhone/iPad only.
 * Chrome/Firefox/Edge on iOS include "Safari" in the UA but also CriOS/FxiOS/EdgiOS.
 */
function isIOSSafari() {
  if (typeof navigator === 'undefined' || !isAppleMobileDevice()) return false;
  const ua = navigator.userAgent || '';
  if (/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android/i.test(ua)) return false;
  return /Safari/i.test(ua);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchMobilePdfBlob(
  row: FinancialDocumentRecord,
  accessToken: string,
): Promise<Blob> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        `/api/account/document-pdf?id=${encodeURIComponent(row.id)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const message = result?.error || 'Could not create the PDF.';
        if (response.status >= 500 && attempt < 2) {
          await delay(350 * (attempt + 1));
          continue;
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      if (!blob || blob.size < 64) {
        throw new Error('The PDF came back empty. Please try again.');
      }
      return blob;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Could not download the PDF.');
      if (attempt < 2) {
        await delay(350 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError || new Error('Could not download the PDF.');
}

type MobilePdfDelivery = 'opened' | 'shared' | 'downloaded';

function triggerPdfFileDownload(blobUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Deliver the invoice PDF on phones.
 * Safari iOS: open in Safari viewer (Telegram share from Web Share freezes).
 * Chrome / Android: save via share sheet or download attribute (blob tabs show blank / no Save).
 */
async function downloadMobileServerPdf(
  row: FinancialDocumentRecord,
  accessToken: string,
): Promise<MobilePdfDelivery> {
  const safariIOS = isIOSSafari();
  // Must open synchronously from the tap. After await, Safari blocks window.open.
  const previewWindow = safariIOS ? window.open('about:blank', '_blank') : null;

  try {
    const blob = await fetchMobilePdfBlob(row, accessToken);
    const filename = `${row.document_number}.pdf`.replace(/[^\w.\-]+/g, '_');
    const blobUrl = URL.createObjectURL(blob);
    const revokeLater = (ms = 180_000) => {
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), ms);
    };

    if (safariIOS) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = blobUrl;
      } else {
        window.location.assign(blobUrl);
      }
      revokeLater();
      return 'opened';
    }

    // Chrome (phone) and Android: let the customer save the file.
    const file = new File([blob], filename, { type: 'application/pdf' });
    const title = row.document_type === 'receipt' ? 'Payment receipt' : 'Invoice';
    const canShareFiles =
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

    if (canShareFiles && blob.size <= 1_500_000) {
      try {
        await navigator.share({ files: [file], title });
        revokeLater();
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          revokeLater();
          return 'shared';
        }
      }
    }

    triggerPdfFileDownload(blobUrl, filename);
    revokeLater();
    return 'downloaded';
  } catch (error) {
    try {
      previewWindow?.close();
    } catch {
      /* ignore */
    }
    throw error;
  }
}

function money(amount: number, currency: string) {
  return currency === 'GHS'
    ? formatStoreMoney(amount)
    : `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function longDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isExpired(row: FinancialDocumentRecord) {
  if (row.document_type !== 'invoice') return false;
  if (row.status === 'expired' || row.status === 'void') return true;
  return row.due_at ? new Date(row.due_at).getTime() < Date.now() : false;
}

function shippingPaymentStatus(row: FinancialDocumentRecord) {
  const nested = row.shipping_packages;
  if (Array.isArray(nested)) return nested[0]?.shipping_payment_status || null;
  return nested?.shipping_payment_status || null;
}

function canMarkShippingPaid(row: FinancialDocumentRecord) {
  const paymentStatus = shippingPaymentStatus(row);
  return (
    row.flow === 'shipping' &&
    row.document_type === 'invoice' &&
    row.status === 'active' &&
    !isExpired(row) &&
    paymentStatus !== 'paid' &&
    paymentStatus !== 'awaiting_confirmation'
  );
}

function DocumentRow({
  row,
  highlight,
  busy,
  paying,
  onView,
  onDownload,
  onPaymentSent,
}: {
  row: FinancialDocumentRecord;
  highlight: boolean;
  busy: boolean;
  paying: boolean;
  onView: () => void;
  onDownload: () => void;
  onPaymentSent?: () => void;
}) {
  const receipt = row.document_type === 'receipt';
  const expired = isExpired(row);
  const paymentStatus = shippingPaymentStatus(row);
  const showShippingPay = canMarkShippingPaid(row) && Boolean(onPaymentSent);
  const waitingForConfirm =
    row.flow === 'shipping' &&
    row.document_type === 'invoice' &&
    paymentStatus === 'awaiting_confirmation';
  const line = receipt
    ? `Paid ${longDate(row.paid_at || row.issued_at)}`
    : expired
      ? 'This price expired. Ask Snappy for a fresh one.'
      : row.due_at
        ? `Pay by ${longDate(row.due_at)}`
        : `Sent ${longDate(row.issued_at)}`;

  return (
    <div
      className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${
        highlight ? 'bg-brand-light/40' : 'bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="break-words font-semibold text-slate-900 sm:truncate">
          {FLOW_LABELS[row.flow] || 'Payment'}
          {row.data?.reference ? ` ${row.data.reference}` : ''}
        </p>
        <p className={`mt-0.5 text-xs ${expired ? 'text-red-600' : 'text-slate-500'}`}>
          {line}. Document {row.document_number}
        </p>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
        <span className="col-span-2 font-bold text-brand-primary sm:col-span-1">
          {money(row.amount, row.currency)}
        </span>
        {waitingForConfirm ? (
          <span className="col-span-2 rounded-xl bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900">
            Waiting for Snappy to confirm
          </span>
        ) : null}
        {showShippingPay ? (
          <button
            type="button"
            onClick={onPaymentSent}
            disabled={paying || busy}
            className="min-h-11 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {paying ? 'Sending…' : "I've paid"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onView}
          disabled={busy || paying}
          className="min-h-11 rounded-xl border border-brand-primary px-4 py-2 text-sm font-bold text-brand-primary hover:bg-brand-primary hover:text-white disabled:opacity-50"
        >
          {busy ? 'Opening…' : 'View'}
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy || paying}
          className="min-h-11 rounded-xl border border-brand-primary px-4 py-2 text-sm font-bold text-brand-primary hover:bg-brand-primary hover:text-white disabled:opacity-50"
        >
          Download
        </button>
      </div>
    </div>
  );
}

type FinancialDocumentsProps = {
  documents: FinancialDocumentRecord[];
  loading: boolean;
  accessToken: string;
  onRefresh?: () => Promise<void>;
};

export default function FinancialDocuments({
  documents,
  loading,
  accessToken,
  onRefresh,
}: FinancialDocumentsProps) {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('document');
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<FinancialDocumentRecord | null>(null);
  const [pendingDownload, setPendingDownload] = useState<FinancialDocumentRecord | null>(null);
  const [mounted, setMounted] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const viewPaperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || documents.length === 0 || isMobilePdfDevice()) return;
    const timer = window.setTimeout(preloadPdfLibraries, 400);
    return () => window.clearTimeout(timer);
  }, [documents.length, loading]);

  const loadDocument = async (row: FinancialDocumentRecord) => {
    const response = await fetch(
      `/api/account/portal?document=${encodeURIComponent(row.id)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const result = await response.json();
    if (!response.ok || !result.document) {
      throw new Error(result.error || 'Could not load the document.');
    }
    return result.document as FinancialDocumentRecord;
  };

  const openView = async (row: FinancialDocumentRecord) => {
    setFetchingId(row.id);
    try {
      const document = await loadDocument(row);
      setViewing(document);
    } catch (error) {
      console.error('[document view]', error);
      alert('Could not open the document. Please try again.');
    } finally {
      setFetchingId(null);
    }
  };

  const prepareDownload = async (row: FinancialDocumentRecord) => {
    setFetchingId(row.id);
    try {
      if (isMobilePdfDevice()) {
        await downloadMobileServerPdf(row, accessToken);
        return;
      }
      const document = await loadDocument(row);
      setPendingDownload(document);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[document detail]', error);
      alert('Could not load the document. Please try again.');
    } finally {
      setFetchingId(null);
    }
  };

  const downloadFromView = async () => {
    if (!viewing) return;
    setFetchingId(viewing.id);
    try {
      if (isMobilePdfDevice()) {
        await downloadMobileServerPdf(viewing, accessToken);
        return;
      }
      const paper = viewPaperRef.current?.querySelector<HTMLElement>('.document-official');
      if (!paper) throw new Error('Invoice paper not ready.');
      await downloadElementAsPdf(paper, `${viewing.document_number}.pdf`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[document pdf from view]', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Could not download the document. Please try again.',
      );
    } finally {
      setFetchingId(null);
    }
  };

  const submitShippingPayment = async (row: FinancialDocumentRecord) => {
    setPayingId(row.id);
    try {
      const response = await fetch('/api/account/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'shipping_payment_sent',
          documentId: row.id,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Could not tell Snappy about your payment.');
      }
      alert(
        result.message ||
          'Thank you. Snappy will confirm after checking the bank or MoMo account.',
      );
      if (onRefresh) await onRefresh();
      if (viewing?.id === row.id) {
        const refreshed = await loadDocument(row);
        setViewing(refreshed);
      }
    } catch (error) {
      console.error('[shipping payment notice]', error);
      alert(error instanceof Error ? error.message : 'Could not submit payment notice.');
    } finally {
      setPayingId(null);
    }
  };

  useEffect(() => {
    if (!pendingDownload) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled) return;
      const paper = paperRef.current?.querySelector<HTMLElement>('.document-official');
      try {
        if (paper) await downloadElementAsPdf(paper, `${pendingDownload.document_number}.pdf`);
      } catch (error) {
        console.error('[document pdf]', error);
        alert('Could not download the document. Please try again.');
      } finally {
        if (!cancelled) setPendingDownload(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pendingDownload]);

  useEffect(() => {
    if (!requestedId || loading || documents.length === 0 || viewing) return;
    const match = documents.find((row) => row.id === requestedId);
    if (match) void openView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId, loading, documents]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!viewing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [viewing]);

  const { invoices, receipts } = useMemo(
    () => ({
      invoices: documents.filter((row) => row.document_type === 'invoice'),
      receipts: documents.filter((row) => row.document_type === 'receipt'),
    }),
    [documents],
  );

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Loading records…</p>;

  const sections = [
    {
      key: 'invoices',
      title: 'Bills to pay',
      hint: 'Open View to see the bill. After you transfer, tap I\'ve paid on shipping bills.',
      empty: 'Nothing to pay right now.',
      rows: invoices,
    },
    {
      key: 'receipts',
      title: 'Payment receipts',
      hint: 'Proof that Snappy received your money. Keep them safe.',
      empty: 'No payments confirmed yet.',
      rows: receipts,
    },
  ];

  const viewingWaiting =
    viewing &&
    viewing.flow === 'shipping' &&
    viewing.document_type === 'invoice' &&
    shippingPaymentStatus(viewing) === 'awaiting_confirmation';
  const viewingCanPay = viewing ? canMarkShippingPaid(viewing) : false;

  const previewModal =
    viewing && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={
              viewing.document_type === 'receipt' ? 'Receipt preview' : 'Invoice preview'
            }
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/60"
              aria-label="Close preview"
              onClick={() => setViewing(null)}
            />

            <div className="relative z-10 flex max-h-[min(92vh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-slate-100 shadow-2xl sm:rounded-3xl">
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" />

              <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-2 sm:px-5 sm:pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-accent">
                      {viewing.document_type === 'receipt' ? 'Receipt' : 'Invoice'} preview
                    </p>
                    <p className="mt-0.5 break-all text-sm font-bold text-brand-primary">
                      {viewing.document_number}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewing(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                    aria-label="Close"
                  >
                    <i className="ri-close-line text-xl" />
                  </button>
                </div>

                {viewingWaiting ? (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-900">
                    Waiting for Snappy to confirm
                  </p>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {viewingCanPay ? (
                    <button
                      type="button"
                      onClick={() => void submitShippingPayment(viewing)}
                      disabled={payingId === viewing.id}
                      className="col-span-2 min-h-11 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {payingId === viewing.id ? 'Sending…' : "I've paid"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void downloadFromView()}
                    disabled={fetchingId === viewing.id}
                    className="min-h-11 rounded-xl border border-brand-primary bg-white px-4 py-2.5 text-sm font-bold text-brand-primary disabled:opacity-50"
                  >
                    {fetchingId === viewing.id ? 'Saving…' : 'Download PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewing(null)}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5">
                <ScaledDocumentPreview>
                  <FinancialDocumentPaper document={viewing} />
                </ScaledDocumentPreview>
              </div>
            </div>

            <div
              ref={viewPaperRef}
              className="pointer-events-none fixed -left-[10000px] top-0 w-[794px]"
              aria-hidden
            >
              <FinancialDocumentPaper document={viewing} />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">Invoices and receipts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every paper for your product orders, Buy RMB and shipping. Tap View to open a bill, then
          I&apos;ve paid after you transfer shipping money.
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.key} className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="font-bold text-slate-900">
              {section.title}
              <span className="ml-2 text-xs font-semibold text-slate-500">
                {section.rows.length}
              </span>
            </p>
            <p className="text-xs text-slate-500">{section.hint}</p>
          </div>
          {section.rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">{section.empty}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {section.rows.map((row) => (
                <DocumentRow
                  key={row.id}
                  row={row}
                  highlight={row.id === requestedId}
                  busy={fetchingId === row.id || pendingDownload?.id === row.id}
                  paying={payingId === row.id}
                  onView={() => void openView(row)}
                  onDownload={() => void prepareDownload(row)}
                  onPaymentSent={
                    row.flow === 'shipping' && row.document_type === 'invoice'
                      ? () => void submitShippingPayment(row)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {previewModal}

      {pendingDownload ? (
        <div ref={paperRef} className="pointer-events-none fixed -left-[10000px] top-0 w-[794px]">
          <FinancialDocumentPaper document={pendingDownload} />
        </div>
      ) : null}
    </div>
  );
}
