'use client';

import Link from 'next/link';
import { MessageCircle, ArrowUpRight, Phone } from 'lucide-react';

interface ImportCtaProps {
  whatsAppHref?: string;
  telHref?: string;
  contactPhone?: string;
}

export default function ImportCta({ whatsAppHref, telHref, contactPhone }: ImportCtaProps) {
  return (
    <section className="relative overflow-hidden border-t border-white/30 bg-gradient-to-b from-[#f4f7fb]/45 via-white/35 to-[#f8fafc]/50 py-8 md:store-section md:py-16 lg:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(242,107,29,0.06),transparent)]" aria-hidden />
      <div className="store-container relative">
        {/* Mobile — compact, edge-friendly */}
        <div className="md:hidden">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">Get started</p>
          <h3 className="font-heading mt-1 text-[1.2rem] font-bold leading-snug text-brand-primary">
            Want to import something?
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
            Send a photo on WhatsApp. We tell you what happens next.
          </p>

          <div className="mt-4 space-y-2.5">
            {whatsAppHref ? (
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-interactive flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                Message on WhatsApp
              </a>
            ) : (
              <Link
                href="/contact"
                className="btn-interactive flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                Message on WhatsApp
              </Link>
            )}

            {telHref && contactPhone ? (
              <a
                href={telHref}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/50 liquid-glass text-[14px] font-semibold text-brand-primary"
              >
                <Phone className="h-4 w-4 text-brand-accent" />
                Call {contactPhone}
              </a>
            ) : (
              <Link
                href="/contact"
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-white/50 liquid-glass text-[14px] font-semibold text-brand-primary"
              >
                Or send us a message
                <ArrowUpRight className="h-3.5 w-3.5 text-brand-accent" />
              </Link>
            )}
          </div>
        </div>

        {/* Desktop */}
        <div className="liquid-glass-card relative mx-auto hidden max-w-2xl overflow-hidden p-8 md:block md:p-10">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-accent/10 blur-2xl" aria-hidden />

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Get started</p>
          <h3 className="font-heading mt-2 text-2xl font-bold leading-snug text-brand-primary">
            Got something you want to import?
          </h3>
          <p className="mt-2 max-w-lg text-base leading-relaxed text-slate-600">
            Send us a photo or short message on WhatsApp. We will tell you what happens next.
          </p>

          <div className="mt-6 flex flex-row items-center gap-5">
            {whatsAppHref ? (
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-interactive inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(37,211,102,0.35)] hover:bg-[#20bd5a]"
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                Message on WhatsApp
                <ArrowUpRight className="h-4 w-4 opacity-80" />
              </a>
            ) : (
              <Link
                href="/contact"
                className="btn-interactive inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(37,211,102,0.35)] hover:bg-[#20bd5a]"
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                Message on WhatsApp
                <ArrowUpRight className="h-4 w-4 opacity-80" />
              </Link>
            )}

            <p className="text-sm text-slate-500">
              {telHref && contactPhone ? (
                <>
                  Or call{' '}
                  <a
                    href={telHref}
                    className="font-semibold text-brand-primary underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
                  >
                    {contactPhone}
                  </a>
                </>
              ) : (
                <>
                  Or{' '}
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-0.5 font-semibold text-brand-primary underline-offset-2 transition-colors hover:text-brand-accent hover:underline"
                  >
                    send us a message
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
