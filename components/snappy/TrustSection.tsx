'use client';

import { ShieldCheck, BadgeDollarSign, Truck, BellRing } from 'lucide-react';

const ITEMS = [
  {
    icon: ShieldCheck,
    title: 'Trusted sellers',
    text: 'We check suppliers before you pay.',
    mobileText: 'Checked suppliers before you pay.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Clear pricing',
    text: 'Every fee is spelled out early. No hidden costs later.',
    mobileText: 'Full cost up front. No surprises.',
  },
  {
    icon: Truck,
    title: 'Door delivery',
    text: 'We move it from China to your door in Ghana.',
    mobileText: 'China to your door in Ghana.',
  },
  {
    icon: BellRing,
    title: 'Live updates',
    text: 'You get updates at every step. No chasing us on WhatsApp.',
    mobileText: 'Updates at every step.',
  },
];

export default function TrustSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/30 bg-gradient-to-b from-white/40 via-[#f8fafc]/50 to-[#f1f5f9]/35 py-8 md:store-section md:py-16 lg:py-20">
      <div className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full bg-brand-accent/5 blur-3xl" aria-hidden />
      <div className="store-container relative">
        {/* Mobile header — tight */}
        <div className="md:hidden">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">Trust</p>
          <h2 className="font-heading mt-1 text-[1.35rem] font-bold leading-tight tracking-tight text-brand-primary">
            Why people trust us
          </h2>
        </div>

        {/* Desktop header */}
        <div className="hidden max-w-xl md:block">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Trust</p>
          <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
            Why people trust us
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
            Importing should feel simple. We make sure it does.
          </p>
        </div>

        {/* Mobile — horizontal snap rail */}
        <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-hide md:hidden">
          {ITEMS.map((item) => (
            <div
              key={item.title}
              className="w-[78vw] max-w-[17.5rem] shrink-0 snap-start liquid-glass-card p-3.5"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10">
                  <item.icon className="h-4 w-4 text-brand-accent" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-[14px] font-bold leading-snug text-brand-primary">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{item.mobileText}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop grid */}
        <div className="mt-8 hidden md:mt-10 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {ITEMS.map((item, i) => (
            <div
              key={item.title}
              className="liquid-glass-card group p-6 transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl liquid-glass-well">
                  <item.icon className="h-5 w-5 text-brand-accent" strokeWidth={1.75} />
                </span>
                <span className="font-heading text-2xl font-black tabular-nums text-brand-primary/10 transition-colors group-hover:text-brand-accent/25">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="font-heading text-base font-bold leading-snug text-brand-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
