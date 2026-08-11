'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { buildWhatsAppHref } from '@/lib/snappy-import';
import { SNAPPY_INVOICE_ISSUER } from '@/lib/bank-details';

const STEPS = [
  {
    title: 'We source it',
    text: 'Cars, trucks, machines, phones, appliances. We find the right option in China for what you actually need.',
  },
  {
    title: 'We confirm quality',
    text: 'Details get checked before money moves. You should know the condition and the deal, not guess from photos.',
  },
  {
    title: 'We inspect on site',
    text: 'When it matters, inspection happens in China so problems show up early, not after the shipment has left.',
  },
  {
    title: 'We bring it to Ghana',
    text: 'Shipping, Tema clearing support, and updates until you pick up or we arrange delivery.',
  },
];

const VEHICLE_TYPES = ['Saloon cars', 'SUVs', 'Buses', 'Pick-ups', 'Trucks', 'Bulldozers'];

export default function AboutPage() {
  usePageTitle('About Us');
  const { getSetting } = useCMS();
  const whatsApp = buildWhatsAppHref(getSetting('contact_whatsapp'));
  const founderFirst = SNAPPY_INVOICE_ISSUER.contactName.split(' ')[0] || 'Sampson';
  const founderFull = SNAPPY_INVOICE_ISSUER.contactName;
  const street = SNAPPY_INVOICE_ISSUER.addressLines[0];
  const area = SNAPPY_INVOICE_ISSUER.addressLines[1];

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <PageHero
        size="large"
        title="China to Ghana, without the panic"
        subtitle="Clear prices. Real updates. People you can call."
      />

      {/* Story */}
      <section className="border-b border-slate-200/80 bg-white">
        <div className="store-container py-10 sm:py-14 md:py-20">
          <div className="mx-auto max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent sm:text-xs">
              Why Snappy exists
            </p>
            <h2 className="mt-2 font-heading text-[1.625rem] font-bold leading-tight tracking-tight text-brand-primary sm:text-3xl md:text-4xl">
              Too many people lose sleep over China imports
            </h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-slate-600 sm:text-base md:text-lg">
              <p>
                You find a car, a phone, or a machine online. The price looks right. Then the worry
                starts. Will the seller vanish after payment? Will the cost jump later? Will the
                goods get stuck with nobody answering?
              </p>
              <p>
                <span className="font-semibold text-brand-primary">Snappy Imports Global</span> is
                here for that exact problem. We are a Ghana import company ({SNAPPY_INVOICE_ISSUER.legalName})
                that sits between you and China. You get a named team, clear payment, and follow-up
                you can rely on.
              </p>
              <p>
                We are especially known for vehicles from China. We also handle gadgets, appliances,
                equipment, and spare parts. Shop on the site or message us for a quote. Either way,
                you should know what happens next.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Process: mobile-first vertical timeline */}
      <section className="border-b border-slate-200/80 bg-[#eef2f7]">
        <div className="store-container py-10 sm:py-14 md:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent sm:text-xs">
              How we work
            </p>
            <h2 className="mt-2 font-heading text-[1.625rem] font-bold leading-tight tracking-tight text-brand-primary sm:text-3xl md:text-4xl">
              Source, check, inspect, deliver
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base">
              This is the work behind the flyer and the store. Not just a price. Care before the
              goods leave China.
            </p>
          </div>

          <ol className="mt-8 space-y-0 md:mt-10 md:grid md:grid-cols-2 md:gap-x-10 md:gap-y-0 md:space-y-0 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="relative border-l-2 border-brand-accent/35 pl-5 pb-8 last:pb-0 md:border-l-0 md:border-t-2 md:pl-0 md:pt-5 md:pb-0"
              >
                <span className="absolute -left-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent md:left-0 md:top-[-9px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-accent">
                  Step {index + 1}
                </p>
                <h3 className="mt-1.5 font-heading text-lg font-bold text-brand-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Flyer: image first on mobile */}
      <section className="overflow-hidden bg-brand-primary">
        <div className="store-container py-10 sm:py-14 md:py-20">
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="order-1 mx-auto w-full max-w-sm sm:max-w-md lg:order-2 lg:max-w-none">
              <div className="overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl shadow-black/25 sm:p-2">
                <Image
                  src="/images/snappy-vehicle-flyer.png"
                  alt="Snappy Imports Global vehicle flyer for China car deals"
                  width={900}
                  height={1200}
                  className="h-auto w-full rounded-xl object-contain"
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 420px, 480px"
                />
              </div>
            </div>

            <div className="order-2 lg:order-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent sm:text-xs">
                Vehicles from China
              </p>
              <h2 className="mt-2 font-heading text-[1.625rem] font-bold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
                Car deals people in Ghana actually ask for
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/80 sm:text-base md:text-lg">
                Saloons, SUVs, buses, pick-ups, trucks, bulldozers. We source them, confirm what you
                are getting, and support inspection so you are not buying blind.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {VEHICLE_TYPES.map((type) => (
                  <li
                    key={type}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    {type}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/shop"
                  className="btn-interactive inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-accent px-5 py-3 text-sm font-bold text-white sm:w-auto"
                >
                  See products
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {whatsApp ? (
                  <a
                    href={whatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-interactive inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/25 px-5 py-3 text-sm font-semibold text-white sm:w-auto"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp a quote
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder + place */}
      <section className="border-b border-slate-200/80 bg-white">
        <div className="store-container py-10 sm:py-14 md:py-20">
          <div className="mx-auto max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent sm:text-xs">
              People and place
            </p>
            <h2 className="mt-2 font-heading text-[1.625rem] font-bold leading-tight tracking-tight text-brand-primary sm:text-3xl md:text-4xl">
              Led by {founderFirst}. Based in Accra.
            </h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-slate-600 sm:text-base md:text-lg">
              <p>
                Snappy Imports Global was started by{' '}
                <span className="font-semibold text-brand-primary">{founderFull}</span>. When you
                message the business, you reach a team he leads. Not a faceless inbox.
              </p>
              <p>
                Our Accra base is on {street}, {area}. We serve customers across Ghana. Goods move
                from China into Ghana for clearing, then pickup or delivery.
              </p>
              <p>
                You can also use our Buy RMB desk when you need to pay a China supplier in RMB while
                settling in cedis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#eef2f7]">
        <div className="store-container py-10 sm:py-14 md:py-16">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-heading text-xl font-bold text-brand-primary sm:text-2xl">
              Ready when you are
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base">
              Browse the shop, or send a WhatsApp. We will tell you the next step in plain language.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/shop"
                className="btn-interactive inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-6 py-3 text-[15px] font-semibold text-white sm:w-auto"
              >
                Start shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
              {whatsApp ? (
                <a
                  href={whatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-interactive inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-brand-primary sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4 text-brand-accent" />
                  Talk to us
                </a>
              ) : (
                <Link
                  href="/contact"
                  className="btn-interactive inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold text-brand-primary sm:w-auto"
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
