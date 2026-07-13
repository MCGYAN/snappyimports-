import { Suspense } from 'react';
import ExchangeInvoiceClient from './ExchangeInvoiceClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading…</div>}>
      <ExchangeInvoiceClient />
    </Suspense>
  );
}
