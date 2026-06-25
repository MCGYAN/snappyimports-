'use client';

import { Info } from 'lucide-react';
import {
  getImportTypeLabel,
  IMPORT_TYPE_DESCRIPTIONS,
  type ImportTypeValue,
} from '@/lib/product-commerce';

interface ImportDetailsCardProps {
  importType: ImportTypeValue;
  importNotes?: string;
  priceLabel?: string;
}

export default function ImportDetailsCard({ importType, importNotes, priceLabel }: ImportDetailsCardProps) {
  if (!importType && !importNotes?.trim()) return null;

  const typeLabel = importType ? getImportTypeLabel(importType) : '';
  const typeDescription = importType ? IMPORT_TYPE_DESCRIPTIONS[importType] : '';

  return (
    <div className="mb-8 rounded-xl border border-brand-primary/10 bg-brand-light/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Info className="h-5 w-5 shrink-0 text-brand-accent" />
        <h3 className="text-lg font-bold text-brand-primary">Import details</h3>
      </div>

      {typeLabel ? (
        <p className="text-sm font-semibold text-brand-primary">{typeLabel}</p>
      ) : null}

      {typeDescription ? (
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{typeDescription}</p>
      ) : null}

      {priceLabel ? (
        <p className="mt-3 text-xs text-gray-500">
          Listed price ({priceLabel}) — confirm final landed cost with us before you pay.
        </p>
      ) : null}

      {importNotes?.trim() ? (
        <div className="mt-4 rounded-lg border border-white/80 bg-white/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{importNotes}</p>
        </div>
      ) : null}
    </div>
  );
}
