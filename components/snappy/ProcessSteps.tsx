'use client';

import { Search, MessageCircle, Package, MapPin } from 'lucide-react';

const STEPS = [
  { icon: Search, title: 'Look around', desc: 'Find what you need. Cars, phones, machines, and more.', mobileDesc: 'Browse cars, phones & more.' },
  { icon: MessageCircle, title: 'Ask or order', desc: 'Message us on WhatsApp or buy online when you are ready.', mobileDesc: 'WhatsApp us or buy online.' },
  { icon: Package, title: 'We handle it', desc: 'We source it and ship it from China. You do not have to.', mobileDesc: 'We source & ship from China.' },
  { icon: MapPin, title: 'It arrives home', desc: 'Your import lands in Ghana. You know when and where.', mobileDesc: 'Lands in Ghana. You track it.' },
];

export default function ProcessSteps() {
  return (
    <section className="relative overflow-hidden border-b border-white/30 bg-gradient-to-b from-[#f1f5f9]/50 via-[#eef2f8]/55 to-[#f4f7fb]/40 py-8 md:store-section md:py-16 lg:py-20">
      <div className="pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-brand-primary/5 blur-3xl" aria-hidden />
      <div className="store-container relative">
        <div className="md:max-w-xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent md:text-xs md:tracking-[0.2em]">
            Process
          </p>
          <h2 className="font-heading mt-1 text-[1.35rem] font-bold leading-tight tracking-tight text-brand-primary md:mt-0 md:text-[1.75rem] lg:text-[2.25rem]">
            How it works
          </h2>
          <p className="mt-1 hidden text-sm leading-relaxed text-slate-600 md:mt-2 md:block md:text-base">
            Four steps. No confusion. Easier than you thought.
          </p>
        </div>

        {/* Mobile — vertical timeline */}
        <div className="mt-4 md:hidden">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {i < STEPS.length - 1 && (
                <div
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-brand-accent/40 to-brand-accent/10"
                  aria-hidden
                />
              )}
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(242,107,29,0.35)]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 liquid-glass-card p-3 pb-4 last:border-0">
                <h3 className="font-heading text-[14px] font-bold leading-snug text-brand-primary">
                  {step.title}
                </h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{step.mobileDesc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop grid */}
        <div className="relative mt-8 hidden md:block md:mt-10">
          <div
            className="pointer-events-none absolute left-[12%] right-[12%] top-7 hidden h-px bg-gradient-to-r from-transparent via-brand-accent/25 to-transparent lg:block"
            aria-hidden
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="liquid-glass-card relative p-5 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent text-sm font-bold text-white shadow-[0_4px_12px_rgba(242,107,29,0.35)]">
                    {i + 1}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl liquid-glass-well">
                    <step.icon className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.75} />
                  </span>
                </div>
                <h3 className="font-heading text-[15px] font-bold leading-snug text-brand-primary">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
