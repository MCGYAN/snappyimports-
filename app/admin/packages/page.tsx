import { Suspense } from 'react';
import AdminPackagesClient from './PackagesClient';

export default function AdminPackagesPage() {
  return (
    <Suspense
      fallback={<p className="py-10 text-center text-sm text-slate-500">Loading packages…</p>}
    >
      <AdminPackagesClient />
    </Suspense>
  );
}
