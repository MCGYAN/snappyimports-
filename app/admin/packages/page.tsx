import Link from 'next/link';
import ShippingOperationsDesk from '@/components/admin/ShippingOperationsDesk';

export default function AdminPackagesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Packages</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Build physical packages from paid items. One package can combine items from several
            orders belonging to the same customer.
          </p>
        </div>
        <Link
          href="/admin/shipping"
          className="rounded-xl border border-brand-primary/20 bg-white px-4 py-2.5 text-sm font-bold text-brand-primary"
        >
          Open Shipping
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['1', 'Choose a customer', 'See unpacked items from all their paid orders.'],
          ['2', 'Build the box', 'Split quantities and combine the items that physically fit.'],
          ['3', 'Measure and save', 'Enter dimensions or CBM. Snappy creates the SHP number.'],
        ].map(([number, title, text]) => (
          <div key={number} className="rounded-2xl border border-slate-200 bg-white p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
              {number}
            </span>
            <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{text}</p>
          </div>
        ))}
      </section>

      <ShippingOperationsDesk mode="packages" />
    </div>
  );
}
