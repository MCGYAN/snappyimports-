'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SNAPPY_INVOICE_ISSUER, type BankAccount } from '@/lib/bank-details';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import {
  invoicePaymentFooterClass,
  invoicePaymentFooterMultiClass,
  type InvoicePdfMode,
} from '@/lib/invoice-layout';

function accountColumnTitle(account: BankAccount): string {
  if (account.channel === 'momo') {
    return account.bank ? `Mobile Money (${account.bank})` : 'Mobile Money';
  }
  return account.branch ? `${account.bank} (${account.branch})` : account.bank;
}

function InlineCopy({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      alert(`Copy this: ${value}`);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      data-html2canvas-ignore="true"
      className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-medium text-white/70 underline-offset-2 hover:text-white hover:underline print:hidden"
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

export type InvoicePaymentFooterProps = {
  accounts: BankAccount[];
  holder?: string;
  title?: string;
  note?: string;
  pdfMode?: InvoicePdfMode;
  withCopy?: boolean;
  /** Pin to the page bottom for single-page PDF capture. */
  pinned?: boolean;
};

export default function InvoicePaymentFooter({
  accounts,
  holder,
  title = 'Payment details:',
  note,
  pdfMode = 'single',
  withCopy = false,
  pinned = false,
}: InvoicePaymentFooterProps) {
  const accountHolder = holder || accounts[0]?.holder || SNAPPY_INVOICE_ISSUER.legalName;

  const wrapperClass = withCopy
    ? 'pt-2 leading-normal'
    : pinned
      ? pdfMode === 'multi'
        ? invoicePaymentFooterMultiClass
        : invoicePaymentFooterClass
      : pdfMode === 'multi'
        ? invoicePaymentFooterMultiClass
        : 'mt-3 pt-2 leading-normal';

  return (
    <div
      {...(pinned ? { 'data-invoice-footer': '' } : {})}
      className={wrapperClass}
    >
      <p className="font-bold uppercase tracking-wide">{title}</p>
      <p className="mt-1">Account holder: {accountHolder}</p>
      {note ? <p className="mt-0.5 text-[10px] text-slate-600">{note}</p> : null}

      <div
        className="mt-2 grid overflow-hidden rounded-sm border border-slate-800 bg-[#2b2b2b] text-[9px] leading-tight text-white"
        style={{ gridTemplateColumns: `repeat(${accounts.length + 1}, minmax(0, 1fr))` }}
      >
        {accounts.map((account) => (
          <div
            key={`${account.bank}-${account.accountNumber}`}
            className="flex min-h-[52px] flex-col justify-center border-r border-white/20 px-2.5 py-2"
          >
            <p className="font-semibold">{accountColumnTitle(account)}</p>
            <p className="mt-1 font-bold tabular-nums tracking-wide">{account.accountNumber}</p>
            {withCopy ? <InlineCopy value={account.accountNumber} /> : null}
          </div>
        ))}
        <div className="flex min-h-[52px] items-center justify-center bg-[#353535] px-2 py-1.5">
          <img
            src={SITE_LOGO_LIGHT_BG_PATH}
            alt={SNAPPY_INVOICE_ISSUER.brand}
            className="h-9 w-auto max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
