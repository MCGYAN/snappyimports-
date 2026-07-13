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
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Transfer code (optional)
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="font-mono text-2xl font-black tracking-wide text-brand-primary">{code}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-primary print:hidden"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Add this on your transfer so we match your payment faster.
      </p>
      {supportId ? (
        <p className="mt-1 text-xs text-slate-400">
          Support id: <span className="font-mono">{supportId}</span>
        </p>
      ) : null}
    </div>
  );
}
