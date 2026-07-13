import { Suspense } from 'react';
import OrderHubPage from './OrderHubClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
          Loading order…
        </div>
      }
    >
      <OrderHubPage />
    </Suspense>
  );
}
