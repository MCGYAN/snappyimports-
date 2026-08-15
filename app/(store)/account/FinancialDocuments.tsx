'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatStoreMoney } from '@/lib/currency';
import { downloadElementAsPdf } from '@/lib/download-pdf';
import FinancialDocumentPaper, {
  type FinancialDocumentRecord,
} from '@/components/FinancialDocumentPaper';

function money(amount: number, currency: string) {
  return currency === 'GHS'
    ? formatStoreMoney(amount)
    : `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default function FinancialDocuments() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('document');
  const [documents, setDocuments] = useState<FinancialDocumentRecord[]>([]);
  const [selected, setSelected] = useState<FinancialDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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
      const rows: FinancialDocumentRecord[] = response.ok ? result.documents || [] : [];
      setDocuments(rows);
      setSelected(rows.find((row) => row.id === requestedId) || rows[0] || null);
      setLoading(false);
    };
    void load();
  }, [requestedId]);

  const download = async () => {
    if (!selected) return;
    const paper = document
      .getElementById('financial-document-print')
      ?.querySelector<HTMLElement>('.document-official');
    if (!paper) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(paper, `${selected.document_number}.pdf`);
    } catch (error) {
      console.error('[document pdf]', error);
      alert('Could not download the document. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Loading records…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">Invoices and receipts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Invoices request payment. Receipts prove that Snappy received payment.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <i className="ri-file-list-3-line text-3xl text-slate-300" />
          <p className="mt-2 font-semibold text-slate-700">No financial records yet</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          <div className="space-y-2">
            {documents.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selected?.id === row.id
                    ? 'border-brand-primary bg-brand-light/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-accent">
                    {row.document_type}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(row.issued_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {row.document_number}
                </p>
                <p className="mt-1 font-bold text-brand-primary">
                  {money(row.amount, row.currency)}
                </p>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                  {selected.document_type === 'receipt'
                    ? 'Proof of payment received by Snappy Imports Global.'
                    : 'Amount requested by Snappy Imports Global.'}
                </p>
                <button
                  type="button"
                  onClick={() => void download()}
                  disabled={downloading}
                  className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {downloading ? 'Preparing…' : 'Download'}
                </button>
              </div>

              {selected.document_type === 'invoice' && selected.due_at ? (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    selected.status === 'expired' || selected.status === 'void'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {selected.status === 'expired' || selected.status === 'void'
                    ? 'This invoice expired. Ask Snappy to issue a fresh rate.'
                    : `Please pay by ${new Date(selected.due_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}.`}
                </div>
              ) : null}

              <article className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <FinancialDocumentPaper document={selected} />
              </article>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
