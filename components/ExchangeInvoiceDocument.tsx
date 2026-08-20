'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SNAPPY_INVOICE_ISSUER, type BankAccount } from '@/lib/bank-details';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import { formatMoney } from '@/lib/payment-routing';
import { resolvePaymentReference } from '@/lib/payment-reference';
import {
  EXCHANGE_CORRIDORS,
  formatCorridorBuyRate,
  parseExchangeCountryCode,
  resolvePayAccounts,
} from '@/lib/exchange-corridors';
import {
  invoiceAddressClass,
  invoiceBodyClass,
  invoiceCompanyNameClass,
  invoiceLogoClass,
  invoiceOfficialMultiPageClass,
  invoiceOfficialPageClass,
  invoicePaymentFooterClass,
  invoiceTableHeaderClass,
  invoiceTitleClass,
  invoiceTotalAmountClass,
  invoiceTypographyClass,
  invoiceVariantClass,
  resolveInvoicePdfMode,
} from '@/lib/invoice-layout';

type Props = {
  exchange: {
    exchange_number: string;
    created_at: string;
    customer_name?: string;
    email?: string | null;
    phone?: string;
    business_name?: string | null;
    rate?: number;
    amount_from?: number;
    amount_to?: number;
    currency_from?: string;
    currency_to?: string;
    country_code?: string | null;
    due_at?: string | null;
    alipay_account_name?: string | null;
    has_alipay_qr?: boolean;
    metadata?: Record<string, any> | null;
  };
};

function formatAmount(n: number): string {
  return (n || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
      className="ml-1 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline print:hidden"
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function PaymentAccountsBlock({
  accounts,
  countryName,
  withCopy,
  pinnedBottom,
}: {
  accounts: BankAccount[];
  countryName: string;
  withCopy?: boolean;
  pinnedBottom?: boolean;
}) {
  const footerClass = pinnedBottom
    ? invoicePaymentFooterClass
    : withCopy
      ? 'mt-3 pt-2 leading-normal'
      : 'mt-2 pt-1.5 leading-normal';

  return (
    <div
      {...(pinnedBottom ? { 'data-invoice-footer': '' } : {})}
      className={footerClass}
    >
      <p className="font-bold uppercase tracking-wide">Payment details ({countryName}):</p>
      <p className="mt-1">
        Account holder: {accounts[0]?.holder || SNAPPY_INVOICE_ISSUER.legalName}
      </p>
      <p className="mt-0.5 text-[10px]">
        Pay only these {countryName} accounts for this Buy RMB invoice.
      </p>
      <div className={withCopy ? 'mt-1 space-y-1.5' : 'mt-1.5 space-y-1.5'}>
        {accounts.map((acc) => (
          <p key={`${acc.bank}-${acc.accountNumber}`} className="leading-normal">
            {acc.channel === 'momo' ? 'Mobile Money' : 'Bank'}: {acc.bank}
            {acc.branch ? ` (${acc.branch})` : ''}
            {acc.registeredName ? `, Reg: ${acc.registeredName}` : ''}, Account No.:{' '}
            <span className="font-semibold tabular-nums tracking-wide">{acc.accountNumber}</span>
            {withCopy ? <InlineCopy value={acc.accountNumber} /> : null}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function ExchangeInvoiceDocument({ exchange }: Props) {
  const country = parseExchangeCountryCode(
    exchange.country_code || exchange.metadata?.country_code,
  );
  const meta = EXCHANGE_CORRIDORS[country];
  const currency = exchange.currency_from || meta.currencyCode;
  const amountFrom = Number(exchange.amount_from || 0);
  const amountTo = Number(exchange.amount_to || 0);
  const rate = Number(exchange.rate || 0);
  const paymentRef = resolvePaymentReference(
    exchange.metadata?.payment_ref,
    exchange.exchange_number,
  );
  const description = `Buy RMB, ${meta.name} (${formatCorridorBuyRate(rate, country, 4)})`;
  const accounts = resolvePayAccounts(
    { country_code: country, pay_accounts: [] },
    exchange.metadata?.pay_accounts,
  );
  const pdfMode = resolveInvoicePdfMode(1);
  const isSinglePage = pdfMode === 'single';

  return (
    <div id="exchange-invoice-print" className="bg-white text-slate-900">
      <div className={`invoice-screen ${invoiceTypographyClass}`}>
        <div className="flex flex-col gap-3 border-b border-black pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className={invoiceLogoClass}
            />
            <div>
              <p className={invoiceCompanyNameClass}>{SNAPPY_INVOICE_ISSUER.brand}</p>
              <div className={`mt-0.5 ${invoiceAddressClass}`}>
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', ')}</p>
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(2).join(', ')}</p>
                <p>
                  {SNAPPY_INVOICE_ISSUER.contactName}, {SNAPPY_INVOICE_ISSUER.phones.join(' / ')}
                </p>
                <p>{SNAPPY_INVOICE_ISSUER.email}</p>
              </div>
            </div>
          </div>
          <p className={invoiceTitleClass}>INVOICE</p>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 sm:gap-8">
          <div>
            <p className="font-bold uppercase tracking-wide">Bill to</p>
            <p className="mt-0.5 font-semibold">{exchange.customer_name || 'Customer'}</p>
            {exchange.business_name ? <p>{exchange.business_name}</p> : null}
            {exchange.email ? <p>{exchange.email}</p> : null}
            {exchange.phone ? <p>{exchange.phone}</p> : null}
            {paymentRef ? (
              <p className="mt-1.5">
                Transfer code (optional):{' '}
                <span className="font-mono font-bold">{paymentRef}</span>
                <InlineCopy value={paymentRef} />
              </p>
            ) : null}
          </div>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Invoice No.:</td>
                <td className="py-px text-right">{exchange.exchange_number}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Pay-in country:</td>
                <td className="py-px text-right">{meta.name}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Issue date:</td>
                <td className="py-px text-right">
                  {new Date(exchange.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
              {exchange.due_at ? (
                <tr>
                  <td className="whitespace-nowrap py-px pr-3 font-semibold">Due date:</td>
                  <td className="py-px text-right">
                    {new Date(exchange.due_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Service:</td>
                <td className="py-px text-right">Buy RMB</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className={`border-b-2 border-black text-left ${invoiceTableHeaderClass}`}>
              <th className="py-1.5 pr-2 font-bold uppercase">Description</th>
              <th className="py-1.5 text-center font-bold uppercase">Qty</th>
              <th className="py-1.5 text-right font-bold uppercase">Unit ({meta.unitLabel})</th>
              <th className="py-1.5 pl-2 text-right font-bold uppercase">Amount ({meta.unitLabel})</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="py-1.5 pr-2">
                <span className="font-medium">{description}</span>
                <span className={`block ${invoiceVariantClass}`}>
                  You receive {formatAmount(amountTo)} RMB
                  {exchange.has_alipay_qr
                    ? ` via Alipay${exchange.alipay_account_name ? ` (${exchange.alipay_account_name})` : ''}`
                    : ''}
                </span>
              </td>
              <td className="py-1.5 text-center">1</td>
              <td className="py-1.5 text-right">{formatAmount(amountFrom)}</td>
              <td className="py-1.5 pl-2 text-right font-medium">{formatAmount(amountFrom)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          <table className="w-full max-w-[18rem] border-collapse">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Payment method:</td>
                <td className="py-px text-right">Bank / MoMo ({meta.name})</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">RMB to receive:</td>
                <td className="py-px text-right">{formatAmount(amountTo)} RMB</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap pt-2 pr-3 font-bold">TOTAL DUE ({currency})</td>
                <td className={`pt-2 text-right ${invoiceTotalAmountClass}`}>
                  {formatMoney(amountFrom, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaymentAccountsBlock accounts={accounts} countryName={meta.name} withCopy />
      </div>

      <div
        className={`invoice-official hidden ${invoiceTypographyClass} ${
          isSinglePage ? invoiceOfficialPageClass : invoiceOfficialMultiPageClass
        }`}
        data-invoice-mode={pdfMode}
        {...(isSinglePage ? { 'data-invoice-a4': '' } : {})}
      >
        <div className={isSinglePage ? invoiceBodyClass : undefined}>
        <div className="flex items-start justify-between gap-6 border-b border-black pb-3">
          <div className="flex items-start gap-4">
            <img
              src={SITE_LOGO_LIGHT_BG_PATH}
              alt={SNAPPY_INVOICE_ISSUER.brand}
              className={invoiceLogoClass}
            />
            <div>
              <p className={invoiceCompanyNameClass}>{SNAPPY_INVOICE_ISSUER.brand}</p>
              <div className={`mt-0.5 ${invoiceAddressClass}`}>
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 2).join(', ')}</p>
                <p>{SNAPPY_INVOICE_ISSUER.addressLines.slice(2).join(', ')}</p>
                <p>
                  {SNAPPY_INVOICE_ISSUER.contactName}, {SNAPPY_INVOICE_ISSUER.phones.join(' / ')}
                </p>
                <p>{SNAPPY_INVOICE_ISSUER.email}</p>
              </div>
            </div>
          </div>
          <p className={invoiceTitleClass}>INVOICE</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold uppercase tracking-wide">Bill to</p>
            <p className="mt-0.5 font-semibold">{exchange.customer_name || 'Customer'}</p>
            {exchange.business_name ? <p>{exchange.business_name}</p> : null}
            {exchange.email ? <p>{exchange.email}</p> : null}
            {exchange.phone ? <p>{exchange.phone}</p> : null}
            {paymentRef ? (
              <p className="mt-1.5">
                Transfer code (optional):{' '}
                <span className="font-mono font-bold">{paymentRef}</span>
              </p>
            ) : null}
          </div>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Invoice No.:</td>
                <td className="py-px text-right">{exchange.exchange_number}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Pay-in country:</td>
                <td className="py-px text-right">{meta.name}</td>
              </tr>
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Issue date:</td>
                <td className="py-px text-right">
                  {new Date(exchange.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
              {exchange.due_at ? (
                <tr>
                  <td className="whitespace-nowrap py-px pr-3 font-semibold">Due date:</td>
                  <td className="py-px text-right">
                    {new Date(exchange.due_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="whitespace-nowrap py-px pr-3 font-semibold">Service:</td>
                <td className="py-px text-right">Buy RMB</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="mt-3 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 font-bold uppercase">Description</th>
              <th className="py-1.5 text-center font-bold uppercase">Quantity</th>
              <th className="py-1.5 text-right font-bold uppercase">Unit ({meta.unitLabel})</th>
              <th className="py-1.5 text-right font-bold uppercase">Amount ({meta.unitLabel})</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="py-1 pr-2">
                <span className="font-medium">{description}</span>
                <span className="block text-[10px]">
                  You receive {formatAmount(amountTo)} RMB
                  {exchange.has_alipay_qr
                    ? ` via Alipay${exchange.alipay_account_name ? ` (${exchange.alipay_account_name})` : ''}`
                    : ''}
                </span>
              </td>
              <td className="py-1 text-center">1</td>
              <td className="py-1 text-right">{formatAmount(amountFrom)}</td>
              <td className="py-1 text-right font-medium">{formatAmount(amountFrom)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          <div className="w-64 space-y-0.5 text-[11px]">
            <div className="flex items-start justify-between gap-6">
              <span className="whitespace-nowrap font-semibold">Payment method:</span>
              <span className="text-right">Bank / MoMo ({meta.name})</span>
            </div>
            <div className="flex items-start justify-between gap-6">
              <span className="whitespace-nowrap font-semibold">RMB to receive:</span>
              <span className="text-right">{formatAmount(amountTo)} RMB</span>
            </div>
            <div className="flex items-start justify-between gap-6 pt-2">
              <span className="whitespace-nowrap font-bold">TOTAL DUE ({currency})</span>
              <span className={`text-right ${invoiceTotalAmountClass}`}>{formatMoney(amountFrom, currency)}</span>
            </div>
          </div>
        </div>
        </div>

        <PaymentAccountsBlock accounts={accounts} countryName={meta.name} pinnedBottom />
      </div>

      <style jsx global>{`
        @media print {
          #exchange-invoice-print .invoice-screen {
            display: none !important;
          }
          #exchange-invoice-print .invoice-official {
            display: block !important;
            position: relative !important;
            overflow: visible !important;
          }
          #exchange-invoice-print .invoice-official[data-invoice-mode='single'] {
            height: 1043px !important;
            overflow: hidden !important;
          }
          #exchange-invoice-print .invoice-official[data-invoice-mode='single'] [data-invoice-footer] {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 12px !important;
            padding-bottom: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}
