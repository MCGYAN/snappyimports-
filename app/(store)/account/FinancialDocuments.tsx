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

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type MobilePdfLink = {
  url: string;
  filename: string;
  documentNumber?: string;
  documentType?: string;
};

async function fetchMobilePdfLink(
  row: FinancialDocumentRecord,
  accessToken: string,
): Promise<MobilePdfLink> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('/api/account/document-pdf', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: row.id }),
        cache: 'no-store',
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.url) {
        const message = result?.error || 'Could not create the PDF link.';
        if (response.status >= 500 && attempt < 2) {
          await delay(350 * (attempt + 1));
          continue;
        }
        throw new Error(message);
      }

      return {
        url: String(result.url),
        filename: String(result.filename || `${row.document_number}.pdf`),
        documentNumber: result.documentNumber,
        documentType: result.documentType,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Could not create the PDF link.');
      if (attempt < 2) {
        await delay(350 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError || new Error('Could not create the PDF link.');
}

type MobilePdfDelivery = {
  status: 'opened';
  link: MobilePdfLink;
};

/**
 * Mobile PDF delivery via a real HTTPS link (not a blob).
 * Blob tabs go blank in Chrome, and file-share to Telegram freezes iPhones.
 */
async function downloadMobileServerPdf(
  row: FinancialDocumentRecord,
  accessToken: string,
): Promise<MobilePdfDelivery> {
  // Keep the tap gesture: open the tab before any await.
  const previewWindow = window.open('about:blank', '_blank');

  try {
    const link = await fetchMobilePdfLink(row, accessToken);

    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = link.url;
    } else {
      window.location.assign(link.url);
    }

    return { status: 'opened', link };
  } catch (error) {
    try {
      previewWindow?.close();
    } catch {
      /* ignore */
    }
    throw error;
  }
}

async function shareMobilePdfLink(
  link: MobilePdfLink,
  row: FinancialDocumentRecord,
): Promise<'shared' | 'copied'> {
  const title =
    (link.documentType || row.document_type) === 'receipt' ? 'Payment receipt' : 'Invoice';
  const text = `${title} ${link.documentNumber || row.document_number} from Snappy Imports Global`;

  if (typeof navigator.share === 'function') {
    try {
      const payload: ShareData = { title, text, url: link.url };
      if (typeof navigator.canShare !== 'function' || navigator.canShare(payload)) {
        await navigator.share(payload);
        return 'shared';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  await navigator.clipboard.writeText(link.url);
  return 'copied';
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
  const [mobilePdfLink, setMobilePdfLink] = useState<MobilePdfLink | null>(null);
  const [mobilePdfRow, setMobilePdfRow] = useState<FinancialDocumentRecord | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
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
    setMobilePdfLink(null);
    setMobilePdfRow(null);
    try {
      if (isMobilePdfDevice()) {
        const result = await downloadMobileServerPdf(row, accessToken);
        setMobilePdfLink(result.link);
        setMobilePdfRow(row);
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
    setMobilePdfLink(null);
    setMobilePdfRow(null);
    try {
      if (isMobilePdfDevice()) {
        const result = await downloadMobileServerPdf(viewing, accessToken);
        setMobilePdfLink(result.link);
        setMobilePdfRow(viewing);
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

  const sendPdfLink = async () => {
    if (!mobilePdfLink || !mobilePdfRow) return;
    setShareBusy(true);
    try {
      const result = await shareMobilePdfLink(mobilePdfLink, mobilePdfRow);
      if (result === 'copied') {
        alert('Link copied. Paste it in Telegram.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[document pdf share link]', error);
      alert('Could not share the link. Please try again.');
    } finally {
      setShareBusy(false);
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

                {mobilePdfLink ? (
                  <div className="mt-2 space-y-2 rounded-xl bg-sky-50 px-3 py-2 text-center">
                    <p className="text-sm font-semibold text-sky-950">
                      PDF opened. To send on Telegram without freezing, tap Send link (not the PDF file).
                    </p>
                    <button
                      type="button"
                      onClick={() => void sendPdfLink()}
                      disabled={shareBusy}
                      className="min-h-10 w-full rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {shareBusy ? 'Opening…' : 'Send link'}
                    </button>
                  </div>
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

      {mobilePdfLink ? (
        <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-950">
            PDF opened. To send on Telegram without freezing, tap Send link (not the PDF file).
          </p>
          <button
            type="button"
            onClick={() => void sendPdfLink()}
            disabled={shareBusy}
            className="min-h-11 w-full rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
          >
            {shareBusy ? 'Opening…' : 'Send link'}
          </button>
        </div>
      ) : null}

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
