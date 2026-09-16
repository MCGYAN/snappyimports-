'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FinancialDocumentPaper, {
  type FinancialDocumentRecord,
} from '@/components/FinancialDocumentPaper';
import { formatMoney } from '@/lib/payment-routing';
import { supabase } from '@/lib/supabase';

type LineItem = {
  product_name: string;
  quantity: string;
  unit_price: string;
  detail: string;
};

type SavedInvoice = FinancialDocumentRecord & {
  created_at?: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in required');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

function emptyItem(): LineItem {
  return { product_name: '', quantity: '1', unit_price: '', detail: '' };
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB');
}

export default function AdminInvoicesPage() {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [selected, setSelected] = useState<SavedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/invoices', { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load invoices.');
      setInvoices(data.invoices || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const previewDocument = useMemo<FinancialDocumentRecord>(() => {
    const cleaned = items
      .map((item) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Math.max(0, Number(item.unit_price) || 0);
        const productName = item.product_name.trim() || 'Item';
        return {
          product_name: productName,
          quantity,
          unit_price: unitPrice,
          total_price: Number((quantity * unitPrice).toFixed(2)),
          variant_name: item.detail.trim() || null,
        };
      })
      .filter((item) => item.product_name);
    const amount = cleaned.reduce((sum, item) => sum + item.total_price, 0);
    return {
      id: 'preview',
      document_number: 'INV-MAN-PREVIEW',
      document_type: 'invoice',
      flow: 'manual',
      currency,
      amount,
      status: 'active',
      issued_at: new Date().toISOString(),
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      customer_email: customerEmail.trim() || null,
      data: {
        reference: 'INV-MAN-PREVIEW',
        customer_name: customerName.trim() || 'Customer',
        customer_phone: customerPhone.trim() || null,
        notes: notes.trim() || null,
        payment_method: 'invoice',
        items: cleaned,
      },
    };
  }, [customerName, customerEmail, customerPhone, currency, dueAt, notes, items]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function resetForm() {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setDueAt('');
    setNotes('');
    setCurrency('GHS');
    setItems([emptyItem()]);
  }

  async function saveInvoice() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          currency,
          dueAt: dueAt || null,
          notes,
          items: items.map((item) => ({
            product_name: item.product_name,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
            detail: item.detail,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create invoice.');
      setSuccess(`Invoice ${data.invoice.document_number} saved.`);
      resetForm();
      setSelected(data.invoice);
      await loadInvoices();
    } catch (err: any) {
      setError(err?.message || 'Could not create invoice.');
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf(invoice: SavedInvoice) {
    setDownloadingId(invoice.id);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/invoices/${invoice.id}/pdf?download=1`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not download PDF.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.document_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Could not download PDF.');
    } finally {
      setDownloadingId(null);
    }
  }

  const displayDoc = selected || previewDocument;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Invoices</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create a one-off invoice for any customer. The record stays light. The PDF is built when you
          download it, same layout as shop and shipping invoices.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-store-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-primary">Create invoice</h2>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setSelected(null);
                setSuccess('');
              }}
              className="text-sm font-medium text-slate-500 hover:text-brand-primary"
            >
              Clear
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Customer name</span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-accent"
                placeholder="Full name"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-accent"
                placeholder="optional"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Phone</span>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-accent"
                placeholder="optional"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Due date</span>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-accent"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-accent"
              >
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-brand-accent"
                placeholder="Optional note for your records"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Line items</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-sm font-semibold text-brand-accent hover:underline"
              >
                Add item
              </button>
            </div>
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-[minmax(0,1.4fr)_5rem_7rem_minmax(0,1fr)_auto]"
              >
                <input
                  value={item.product_name}
                  onChange={(e) => updateItem(index, { product_name: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                  placeholder="Description"
                />
                <input
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                  placeholder="Qty"
                  inputMode="numeric"
                />
                <input
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, { unit_price: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                  placeholder="Unit price"
                  inputMode="decimal"
                />
                <input
                  value={item.detail}
                  onChange={(e) => updateItem(index, { detail: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-accent"
                  placeholder="Detail / variant"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-lg px-2 text-sm text-slate-500 hover:bg-white hover:text-red-600"
                  aria-label="Remove item"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-brand-primary">
              Total: {formatMoney(previewDocument.amount, currency)}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveInvoice()}
              className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-accent/90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save invoice'}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-brand-primary">
              {selected ? `Saved ${selected.document_number}` : 'Live preview'}
            </h2>
            {selected ? (
              <button
                type="button"
                onClick={() => void downloadPdf(selected)}
                disabled={downloadingId === selected.id}
                className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-60"
              >
                {downloadingId === selected.id ? 'Preparing…' : 'Download PDF'}
              </button>
            ) : null}
          </div>
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-store-card">
            <div className="mx-auto max-w-[794px] origin-top scale-[0.85] sm:scale-100">
              <FinancialDocumentPaper document={displayDoc} />
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-store-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-brand-primary">Recent manual invoices</h2>
          <button
            type="button"
            onClick={() => void loadInvoices()}
            className="text-sm font-medium text-slate-500 hover:text-brand-primary"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No manual invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Invoice</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Issued</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-mono text-xs text-brand-primary">
                      {invoice.document_number}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-800">
                        {String(invoice.data?.customer_name || 'Customer')}
                      </div>
                      {invoice.customer_email ? (
                        <div className="text-xs text-slate-500">{invoice.customer_email}</div>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{formatDate(invoice.issued_at)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-slate-800">
                      {formatMoney(Number(invoice.amount) || 0, invoice.currency || 'GHS')}
                    </td>
                    <td className="py-2.5 pr-3 capitalize text-slate-600">{invoice.status}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(invoice);
                            setSuccess('');
                          }}
                          className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadPdf(invoice)}
                          disabled={downloadingId === invoice.id}
                          className="text-sm font-semibold text-brand-accent hover:underline disabled:opacity-60"
                        >
                          {downloadingId === invoice.id ? '…' : 'PDF'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
