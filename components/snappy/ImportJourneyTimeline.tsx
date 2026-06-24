'use client';

const STAGES = [
  'Pending',
  'Processing',
  'Sourced',
  'Warehouse (China)',
  'Export prep',
  'Shipped',
  'In transit',
  'Arrived (Tema)',
  'Clearing',
  'Ready for delivery',
];

const MOBILE_MILESTONES = [
  { label: 'Order received' },
  { label: 'Sourced in China' },
  { label: 'Shipped' },
  { label: 'Cleared' },
  { label: 'Delivered' },
];

export default function ImportJourneyTimeline() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0B1F3A] via-[#0d2747] to-[#061224] py-8 md:py-20">
      <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-3xl" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(242,107,29,0.12),transparent)]"
        aria-hidden
      />

      <div className="store-container relative">
        <div className="md:max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent md:text-xs md:tracking-[0.2em]">
            Tracking
          </p>
          <h2 className="font-heading mt-1 text-[1.35rem] font-bold leading-tight tracking-tight text-white md:text-[1.75rem] lg:text-[2.25rem]">
            Never wonder where your order is
          </h2>
          <p className="mt-1 hidden text-sm leading-relaxed text-white/70 md:mt-2 md:block md:text-base">
            Every step is clear. From China to Ghana to your door.
          </p>
        </div>

        {/* Mobile — 5-step progress track */}
        <div className="mt-5 md:hidden">
          <div className="relative flex justify-between">
            <div className="absolute left-2 right-2 top-[11px] h-0.5 bg-white/15" aria-hidden />
            <div className="absolute left-2 top-[11px] h-0.5 w-[88%] bg-gradient-to-r from-brand-accent via-brand-accent/80 to-brand-accent/40" aria-hidden />
            {MOBILE_MILESTONES.map((m, i) => (
              <div key={m.label} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / MOBILE_MILESTONES.length}%` }}>
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand-accent text-[9px] font-bold text-white ring-2 ring-[#0B1F3A]">
                  {i + 1}
                </span>
                <span className="mt-2 max-w-[4.5rem] text-center text-[9px] font-semibold leading-tight text-white/90">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] text-white/45">
            Full status in your account · steps vary by product
          </p>
        </div>

        {/* Desktop — pill chips */}
        <div className="relative mt-8 hidden md:mt-10 md:block">
          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />
          <div className="flex flex-wrap justify-center gap-2.5">
            {STAGES.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-2.5 backdrop-blur-xl transition-colors duration-300 hover:border-brand-accent/30 hover:bg-white/[0.1]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-accent text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-white/90">{label}</span>
                </div>
                {i < STAGES.length - 1 && (
                  <span className="text-white/20" aria-hidden>
                    ·
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-white/40">
            Steps may vary by product. Your account shows your real status.
          </p>
        </div>
      </div>
    </section>
  );
}
