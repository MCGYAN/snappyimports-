'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatStoreMoney } from '@/lib/currency';
import { downloadElementAsPdf } from '@/lib/download-pdf';
import FinancialDocumentPaper, {
  type FinancialDocumentRecord,
} from '@/components/FinancialDocumentPaper';

const FLOW_LABELS: Record<string, string> = {
  shop: 'Product order',
  rmb: 'Buy RMB',
  shipping: 'Shipping to Ghana',
};

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

function DocumentRow({
  row,
  highlight,
  busy,
  onDownload,
}: {
  row: FinancialDocumentRecord;
  highlight: boolean;
  busy: boolean;
  onDownload: () => void;
}) {
  const receipt = row.document_type === 'receipt';
  const expired = isExpired(row);
  const line = receipt
    ? `Paid ${longDate(row.paid_at || row.issued_at)}`
    : expired
      ? 'This price expired. Ask Snappy for a fresh one.'
      : row.due_at
        ? `Pay by ${longDate(row.due_at)}`
        : `Sent ${longDate(row.issued_at)}`;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
        highlight ? 'bg-brand-light/40' : 'bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">
          {FLOW_LABELS[row.flow] || 'Payment'}
          {row.data?.reference ? ` ${row.data.reference}` : ''}
        </p>
        <p className={`mt-0.5 text-xs ${expired ? 'text-red-600' : 'text-slate-500'}`}>
          {line}. Document {row.document_number}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-brand-primary">{money(row.amount, row.currency)}</span>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="rounded-xl border border-brand-primary px-4 py-2 text-sm font-bold text-brand-primary hover:bg-brand-primary hover:text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Download'}
        </button>
      </div>
    </div>
  );
}

export default function FinancialDocuments() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('document');
  const [documents, setDocuments] = useState<FinancialDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<FinancialDocumentRecord | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setLoading(false);
      await fetch('/api/orders/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      }).catch(() => null);
      const response = await fetch('/api/account/portal', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      setDocuments(response.ok ? result.documents || [] : []);
      setLoading(false);
    };
    void load();
  }, []);

  // The paper only exists while a download is running, so the page stays a
  // simple list instead of a wall of invoice sheets.
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const run = async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled) return;
      const paper = paperRef.current?.querySelector<HTMLElement>('.document-official');
      try {
        if (paper) await downloadElementAsPdf(paper, `${pending.document_number}.pdf`);
      } catch (error) {
        console.error('[document pdf]', error);
        alert('Could not download the document. Please try again.');
      } finally {
        if (!cancelled) setPending(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pending]);

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
      hint: 'These ask you for money. Pay before the date shown.',
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">Invoices and receipts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every paper for your product orders, Buy RMB and shipping. Tap Download to save a copy.
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
                  busy={pending?.id === row.id}
                  onDownload={() => setPending(row)}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {pending ? (
        <div ref={paperRef} className="pointer-events-none fixed -left-[10000px] top-0 w-[794px]">
          <FinancialDocumentPaper document={pending} />
        </div>
      ) : null}
    </div>
  );
}
