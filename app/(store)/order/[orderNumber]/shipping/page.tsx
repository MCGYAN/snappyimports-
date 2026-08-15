import { Suspense } from 'react';
import ShippingDetailsClient from './ShippingDetailsClient';

export default function ShippingDetailsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-slate-500">Loading shipment…</p>}>
      <ShippingDetailsClient />
    </Suspense>
  );
}
