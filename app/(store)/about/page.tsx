'use client';

import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { buildWhatsAppHref } from '@/lib/snappy-import';

const OUTCOMES = [
  {
    number: '01',
    title: 'You feel calm',
    text: 'You know who you are paying. You know what things cost. No scary surprises.',
  },
  {
    number: '02',
    title: 'You feel in control',
    text: 'We tell you when your order moves. China. The ship. Ghana. Your door.',
  },
  {
    number: '03',
    title: 'You feel proud',
    text: 'Your car, phone, or machine shows up. You did it. Your family sees it too.',
  },
];

const PROMISES = [
  {
    title: 'We check first',
    text: 'We look at the seller before you send money. Bad deals stop early.',
  },
  {
    title: 'We say the full price',
    text: 'You see the real cost up front. No hidden fees that show up later.',
  },
  {
    title: 'We stay with you',
    text: 'Call or WhatsApp us. Real people answer. Not a robot. Not silence.',
  },
];

export default function AboutPage() {
  usePageTitle('About Us');
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Snappy Import';
  const whatsApp = buildWhatsAppHref(getSetting('contact_whatsapp'));

  return (
    <div className="min-h-screen bg-brand-surface">
      <PageHero
        size="large"
        title="We help you bring good things home"
        subtitle="From China to Ghana. With clear prices, real updates, and people you can talk to."
      />

      {/* Story */}
      <section className="store-section relative overflow-hidden border-b border-slate-100/80 bg-gradient-to-b from-white via-[#f8fafc] to-[#f1f5f9]">
        <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-brand-accent/5 blur-3xl" aria-hidden />
        <div className="store-container relative">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Our story</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              Importing should not keep you up at night
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              You see something you want online. Maybe a car. Maybe a phone. Maybe tools for work.
              You want it here in Ghana. But you also worry. Will the seller disappear? Will the
              price change? Will your order get stuck?
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              <strong className="font-semibold text-brand-primary">{siteName}</strong> exists for
              that worry. We sit between you and China. We check. We explain. We move your order.
              We update you along the way. So you feel safe, not scared.
            </p>
          </div>
        </div>
      </section>

      {/* Emotional outcomes */}
      <section className="store-section relative overflow-hidden border-b border-slate-100/80 bg-gradient-to-b from-[#f1f5f9] via-[#eef2f8] to-[#f4f7fb]">
        <div className="store-container">
          <div className="max-w-xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">The feeling</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              What we want you to feel
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
              Snappy means fast updates and clear answers. Global means we reach China for you.
              The goal is simple: peace of mind from click to delivery.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5 lg:mt-10">
            {OUTCOMES.map((item) => (
              <div
                key={item.number}
                className="liquid-glass-card p-5 transition-all duration-300 hover:-translate-y-0.5 sm:p-6"
              >
                <span className="font-heading text-3xl font-black tabular-nums text-brand-accent/25">
                  {item.number}
                </span>
                <h3 className="mt-3 font-heading text-base font-bold text-brand-primary sm:text-lg">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0B1F3A] via-[#0d2747] to-[#061224] py-12 md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(242,107,29,0.12),transparent)]" aria-hidden />
        <div className="store-container relative">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Our promise</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-white md:text-[2.25rem]">
              Three things you can count on
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70 md:text-base">
              We keep it simple. No big words. No runaround.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5 lg:mt-10">
            {PROMISES.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl sm:p-6"
              >
                <h3 className="font-heading text-base font-bold text-white sm:text-lg">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who we help */}
      <section className="store-section border-b border-white/40 bg-white/25 backdrop-blur-sm">
        <div className="store-container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Who we help</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              Built for real people in Ghana
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              A parent buying a car for the family. A shop owner stocking phones. A builder who
              needs a machine. One item or many, we treat your order like it matters. Because it
              does.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="store-section relative overflow-hidden bg-gradient-to-b from-[#f4f7fb] via-white to-[#f8fafc]">
        <div className="store-container">
          <div className="liquid-glass-card mx-auto max-w-2xl p-6 text-center sm:p-8 md:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Next step</p>
            <h2 className="font-heading mt-2 text-xl font-bold text-brand-primary sm:text-2xl">
              Ready to start?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
              Look around our shop. Or send us a message. We will tell you what happens next. Honest
              and plain.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/shop"
                className="btn-interactive inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-brand-primary px-6 py-3 text-[15px] font-semibold text-white shadow-[0_4px_16px_rgba(11,31,58,0.2)] hover:bg-[#061224]"
              >
                Start an Order
                <ArrowRight className="h-4 w-4" />
              </Link>
              {whatsApp ? (
                <a
                  href={whatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-interactive inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-white/50 liquid-glass px-6 py-3 text-[15px] font-semibold text-brand-primary hover:border-brand-accent/30"
                >
                  <MessageCircle className="h-4 w-4 text-brand-accent" />
                  Talk to us
                </a>
              ) : (
                <Link
                  href="/contact"
                  className="btn-interactive inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-white/50 liquid-glass px-6 py-3 text-[15px] font-semibold text-brand-primary hover:border-brand-accent/30"
                >
                  <MessageCircle className="h-4 w-4 text-brand-accent" />
                  Talk to us
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
