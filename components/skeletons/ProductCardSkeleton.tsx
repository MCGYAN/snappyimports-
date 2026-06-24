export default function ProductCardSkeleton() {
  return (
    <div className="liquid-glass-card flex h-full animate-pulse flex-col overflow-hidden p-3 sm:p-4">
      <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-xl liquid-glass-well">
        <div
          className="absolute inset-0 animate-shimmer bg-gradient-to-r from-white/30 via-white/60 to-white/30"
          style={{ backgroundSize: '200% 100%' }}
        />
      </div>

      <div className="flex flex-grow flex-col space-y-3">
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 rounded bg-white/40" />
          <div className="h-4 w-1/2 rounded bg-white/30" />
        </div>

        <div className="flex gap-1.5">
          <div className="h-4 w-4 rounded-full bg-white/40" />
          <div className="h-4 w-4 rounded-full bg-white/40" />
          <div className="h-4 w-4 rounded-full bg-white/40" />
        </div>

        <div className="flex items-baseline gap-2">
          <div className="h-5 w-20 rounded bg-white/45" />
          <div className="h-4 w-12 rounded bg-white/30" />
        </div>

        <div className="mt-auto pt-2 lg:hidden">
          <div className="h-10 w-full rounded-lg liquid-glass-well" />
        </div>
      </div>
    </div>
  );
}
