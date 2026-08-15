'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatStoreMoney } from '@/lib/currency';

function money(amount: number, currency: string) {
  return currency === 'GHS'
    ? formatStoreMoney(amount)
    : `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default function FinancialDocuments() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('document');
  const [documents, setDocuments] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      const rows = response.ok ? result.documents || [] : [];
      setDocuments(rows);
      setSelected(rows.find((row: any) => row.id === requestedId) || rows[0] || null);
      setLoading(false);
    };
    void load();
  }, [requestedId]);

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
            {documents.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => setSelected(document)}
                className={`w-full rounded-xl border p-3 text-left ${
                  selected?.id === document.id
                    ? 'border-brand-primary bg-brand-light/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-accent">
                    {document.document_type}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(document.issued_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {document.document_number}
                </p>
                <p className="mt-1 font-bold text-brand-primary">
                  {money(document.amount, document.currency)}
                </p>
              </button>
            ))}
          </div>

          {selected ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 print:fixed print:inset-0 print:z-[999] print:overflow-visible print:rounded-none print:border-0 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                    Official {selected.document_type}
                  </p>
                  <h3 className="mt-1 text-xl font-black text-brand-primary">
                    {selected.document_number}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Snappy Imports Global</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-primary print:hidden"
                >
                  Print or save PDF
                </button>
              </div>

              <div className="grid gap-4 py-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Reference</p>
                  <p className="mt-1 font-semibold">{selected.data?.reference || 'Snappy payment'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">
                    {selected.document_type === 'receipt' ? 'Paid on' : 'Issued on'}
                  </p>
                  <p className="mt-1 font-semibold">
                    {new Date(selected.paid_at || selected.issued_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p
                    className={`mt-1 font-bold ${
                      selected.status === 'paid' ? 'text-emerald-700' : 'text-brand-primary'
                    }`}
                  >
                    {selected.status.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {selected.document_type === 'invoice' && selected.due_at ? (
                <div
                  className={`mb-5 rounded-xl px-4 py-3 text-sm ${
                    selected.status === 'expired'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {selected.status === 'expired'
                    ? 'This invoice expired. Ask Snappy to issue a fresh rate.'
                    : `Please pay by ${new Date(selected.due_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}.`}
                </div>
              ) : null}

              {Array.isArray(selected.data?.items) && selected.data.items.length > 0 ? (
                <div className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {selected.data.items.map((item: any, index: number) => (
                    <div key={`${item.product_name}-${index}`} className="flex justify-between gap-4 p-3 text-sm">
                      <span>
                        {item.product_name} × {item.quantity}
                      </span>
                      <strong>{money(item.total_price || 0, selected.currency)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {selected.flow === 'shipping' ? (
                <div className="mb-5 rounded-xl bg-slate-50 p-4 text-sm">
                  <p>
                    Package: <strong>{selected.data?.package_name}</strong>
                  </p>
                  <p className="mt-1">
                    CBM: <strong>{Number(selected.data?.cbm || 0).toFixed(3)}</strong>
                  </p>
                  <p className="mt-1">
                    Calculation:{' '}
                    <strong>
                      {Number(selected.data?.cbm || 0).toFixed(3)} × $
                      {Number(selected.data?.usd_per_cbm || 0).toFixed(2)} = $
                      {Number(selected.data?.shipping_usd || 0).toFixed(2)}
                    </strong>
                  </p>
                  <p className="mt-1">
                    USD to GHS rate: <strong>{Number(selected.data?.usd_to_ghs || 0).toFixed(2)}</strong>
                  </p>
                </div>
              ) : null}

              <div className="flex items-end justify-between gap-4 border-t-2 border-brand-primary pt-5">
                <div>
                  <p className="text-xs text-slate-400">
                    {selected.document_type === 'receipt' ? 'Amount received' : 'Amount due'}
                  </p>
                  {selected.document_type === 'receipt' ? (
                    <p className="mt-1 text-sm font-semibold text-emerald-700">Payment confirmed</p>
                  ) : null}
                </div>
                <p className="text-2xl font-black text-brand-primary">
                  {money(selected.amount, selected.currency)}
                </p>
              </div>
            </article>
          ) : null}
        </div>
      )}
    </div>
  );
}
