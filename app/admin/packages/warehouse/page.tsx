import Link from 'next/link';
import WarehouseFreightDesk from '@/components/admin/WarehouseFreightDesk';

export default function AdminWarehouseFreightPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Freight forwarding</p>
          <h1 className="mt-1 text-2xl font-bold text-brand-primary">China warehouse</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Publish the receiving address and import warehouse spreadsheets by customer shipping mark.
          </p>
        </div>
        <Link
          href="/admin/packages"
          className="rounded-xl border border-brand-primary/20 bg-white px-4 py-2.5 text-sm font-bold text-brand-primary"
        >
          Back to packages
        </Link>
      </div>

      <WarehouseFreightDesk />
    </div>
  );
}
