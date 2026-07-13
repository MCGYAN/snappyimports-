export default function ShopLoading() {
  return (
    <div className="store-container store-section">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white/70">
            <div className="aspect-square animate-pulse bg-slate-200" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
