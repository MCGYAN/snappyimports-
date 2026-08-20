'use client';

import type { ReactNode } from 'react';

/** Readable on-screen paper frame. Same invoice structure as desktop, full width. */
export default function ScaledDocumentPreview({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      {children}
    </div>
  );
}
