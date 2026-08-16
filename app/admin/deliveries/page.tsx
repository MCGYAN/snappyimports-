import DeliveryRequestsDesk from '@/components/admin/DeliveryRequestsDesk';

export default function AdminDeliveryRequestsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Delivery requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Arrange customer pickup and local delivery after packages are ready in Ghana.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['1', 'Review the request', 'Check the package, preferred day, and phone number.'],
          ['2', 'Call and confirm', 'Agree on the exact pickup time or delivery arrangement.'],
          ['3', 'Complete the handoff', 'Mark the package picked up or delivered only when done.'],
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

      <DeliveryRequestsDesk />
    </div>
  );
}
