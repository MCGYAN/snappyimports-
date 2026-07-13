'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  code: string;
  /** Longer id kept for support only */
  supportId?: string;
  className?: string;
};

export default function PaymentReferenceHint({ code, supportId, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      alert(`Copy this code: ${code}`);
    }
  };

  return (
    <div className={className}>
      <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">
        Transfer code (optional)
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-white px-3 py-1.5 shadow-sm border border-slate-200">
          <p className="font-mono text-xl font-black tracking-wide text-brand-primary">{code}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-4 text-xs font-bold text-white transition-colors hover:bg-brand-primary/90 print:hidden"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">
        Add this on your transfer so we match your payment faster.
      </p>
      {supportId ? (
        <p className="mt-2 text-[11px] font-medium text-slate-400">
          Support id: <span className="font-mono">{supportId}</span>
        </p>
      ) : null}
    </div>
  );
}
