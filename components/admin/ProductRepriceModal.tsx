'use client';

import { useState } from 'react';
import { formatGhsAmount, formatRmbAmount, type ProductRepriceRow } from '@/lib/product-pricing';

type ProductRepriceModalProps = {
  open: boolean;
  buyRmbRate: number;
  changes: ProductRepriceRow[];
  onClose: () => void;
  onApplied: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
};

export default function ProductRepriceModal({
  open,
  buyRmbRate,
  changes,
  onClose,
  onApplied,
  getAuthHeaders,
}: ProductRepriceModalProps) {
  const [applying, setApplying] = useState(false);

  if (!open) return null;

  const applyAll = async () => {
    setApplying(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/products/rmb-reprice', {
        method: 'POST',
        headers,
        body: JSON.stringify({ buy_rmb_rate: buyRmbRate }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Could not update product prices.');
        return;
      }
      onApplied();
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-brand-primary">Update product prices?</h2>
          <p className="mt-1 text-sm text-slate-600">
            {changes.length} product{changes.length === 1 ? '' : 's'} would change at buy rate{' '}
            <span className="font-semibold">{buyRmbRate}</span> RMB per GH¢.
          </p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Product</th>
                <th className="pb-2 pr-3 font-semibold">RMB</th>
                <th className="pb-2 pr-3 font-semibold">Old GH¢</th>
                <th className="pb-2 font-semibold">New GH¢</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-800">{row.name}</td>
                  <td className="py-2.5 pr-3 text-slate-600">¥{formatRmbAmount(row.base_price_rmb)}</td>
                  <td className="py-2.5 pr-3 text-slate-600">GH¢{formatGhsAmount(row.current_price)}</td>
                  <td className="py-2.5 font-semibold text-brand-primary">
                    GH¢{formatGhsAmount(row.new_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void applyAll()}
            disabled={applying || changes.length === 0}
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {applying ? 'Applying…' : 'Apply all'}
          </button>
        </div>
      </div>
    </div>
  );
}
