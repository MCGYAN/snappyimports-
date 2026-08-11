'use client';

import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { buildWhatsAppHref } from '@/lib/snappy-import';
import { SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';

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

const WHAT_WE_DO = [
  {
    title: 'Import from China to Ghana',
    text: 'Cars, gadgets, appliances, equipment, and spare parts. Browse the store or ask us for a quote.',
  },
  {
    title: 'Clear checkout and tracking',
    text: 'Pay by MoMo or invoice. Then follow your order from payment to sourcing, shipping, Ghana clearing, and delivery.',
  },
  {
    title: 'Buy RMB desk',
    text: 'Pay Ghana cedis. Get RMB for your China suppliers at today’s locked buy rate, with an invoice you can keep.',
  },
  {
    title: 'Human support',
    text: 'WhatsApp and phone help for quotes, payment questions, and where your order is right now.',
  },
];

export default function AboutPage() {
  usePageTitle('About Us');
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Snappy Imports Global';
  const whatsApp = buildWhatsAppHref(getSetting('contact_whatsapp'));
  const founderName = SNAPPY_INVOICE_ISSUER.contactName.split(' ')[0] || 'Sampson';
  const founderFullName = SNAPPY_INVOICE_ISSUER.contactName;
  const locationLine = SNAPPY_INVOICE_ISSUER.addressLines.slice(0, 3).join(', ');

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
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Our story</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              Importing should not keep you up at night
            </h2>
            <div className="mt-5 space-y-4 text-left text-base leading-relaxed text-slate-600 md:text-lg">
              <p>
                You see something you want online. Maybe a car for the family. Maybe a phone for
                your shop. Maybe a machine that will help your business grow. You want it here in
                Ghana. The price looks good. The photos look right. Then the questions start.
              </p>
              <p>
                Will the seller disappear after you pay? Will the price change halfway? Will your
                goods get stuck in China, at the port, or in clearing? Who do you call when nobody
                answers? That fear is real. Many people in Ghana have felt it. Some have lost money
                to it.
              </p>
              <p>
                <strong className="font-semibold text-brand-primary">Snappy Imports Global</strong>{' '}
                exists for that worry. We sit between you and China on purpose. We are not a random
                middleman with a temporary WhatsApp number. We are a Ghana-based import company you
                can find, call, and follow up with.
              </p>
              <p>
                Before money moves, we help you understand what you are buying and what it should
                cost. We check the seller and the deal. We explain shipping, timing, and the steps
                ahead in plain language. When you are ready, we create your order, take payment
                through clear channels, and keep you updated as the goods move.
              </p>
              <p>
                From sourcing in China to the ship, to Tema and clearing, to pickup or delivery, you
                should always know where things stand. If something changes, we say so. If you have a
                question, a real person answers. That is how importing becomes calm instead of
                scary.
              </p>
              <p>
                Whether you need one item or many, a family purchase or stock for your shop, the
                goal is the same. Bring good things home. Stay informed. Feel safe, not stuck alone
                with a stranger overseas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who we are */}
      <section className="store-section relative overflow-hidden border-b border-slate-100/80 bg-white">
        <div className="store-container">
          <div className="mx-auto max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Who we are</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              Snappy Imports Global
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-slate-600 md:text-lg">
              <p>
                Snappy Imports Global is a China-to-Ghana import company and online store. We help
                people and businesses in Ghana buy from China with clear prices, honest updates, and
                support you can reach.
              </p>
              <p>
                Our trading name is {SNAPPY_INVOICE_ISSUER.legalName}. Customers also know us as
                Snappy Imports and Snappy Import Ghana. Same team. Same promise. Bring good things
                home without the stress.
              </p>
              <p>
                We source and move vehicles, gadgets, home appliances, equipment, and spare parts.
                You can shop on our website, pay in Ghana cedis, and follow your import from payment
                through China, shipping, Tema clearing, and delivery or pickup in Ghana.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="store-section relative overflow-hidden border-b border-slate-100/80 bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-white">
        <div className="store-container">
          <div className="mx-auto max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Founder</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              Meet {founderName}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600 md:text-lg">
              Snappy Imports Global was founded by{' '}
              <strong className="font-semibold text-brand-primary">{founderFullName}</strong>.
              {founderName} built this business so Ghanaians can import from China with a real person
              on their side. Someone who checks the deal, explains the cost, and stays reachable on
              WhatsApp and phone.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              When you message us, you are talking to a team led by {founderName}. Not a faceless
              middleman. That is the heart of Snappy.
            </p>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="store-section relative overflow-hidden border-b border-slate-100/80 bg-gradient-to-b from-white via-[#f8fafc] to-[#eef2f8]">
        <div className="store-container">
          <div className="max-w-xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">What we do</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              How Snappy helps you
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
              Four practical ways we make China-to-Ghana importing simpler.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10">
            {WHAT_WE_DO.map((item) => (
              <div
                key={item.title}
                className="liquid-glass-card p-5 transition-all duration-300 hover:-translate-y-0.5 sm:p-6"
              >
                <h3 className="font-heading text-base font-bold text-brand-primary sm:text-lg">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="store-section relative overflow-hidden border-b border-slate-100/80 bg-white">
        <div className="store-container">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Where we are</p>
            <h2 className="font-heading text-[1.75rem] font-bold tracking-tight text-brand-primary md:text-[2.25rem]">
              Based in Accra. Serving Ghana.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              Our home base is in Accra at {locationLine}. We serve customers across Ghana. Imports
              move from China into Ghana for clearing, then pickup or delivery.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              Need a quote or an update? Reach us on WhatsApp or phone. We answer like neighbours,
              not like a call centre script.
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
