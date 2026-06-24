'use client';

import Image from 'next/image';
import Link from 'next/link';
import AnimatedSection from './AnimatedSection';
import { useCMS } from '@/context/CMSContext';

export default function WhoWeAreSection() {
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Snappy Import Ghana';

  return (
    <section className="py-20 bg-brand-surface overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          <AnimatedSection className="order-2 lg:order-1">
            <h2 className="text-3xl md:text-4xl text-brand-primary mb-6">
              Who we are
            </h2>
            <div className="space-y-4 text-lg text-brand-foreground/70 leading-relaxed">
              <p>
                <strong>{siteName}</strong> helps you import from China to Ghana. We handle the hard part so you do not have to.
              </p>
              <p>
                Cars, phones, machines. You always know what is happening. No stress. No guessing.
              </p>
              <div className="pt-4">
                <Link
                  href="/about"
                  className="inline-flex items-center text-brand-primary font-semibold hover:text-brand-accent transition-colors group"
                >
                  <span className="border-b border-transparent group-hover:border-brand-accent transition-colors">Our story</span>
                  <i className="ri-arrow-right-line ml-2 transition-transform group-hover:translate-x-1"></i>
                </Link>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection className="order-1 lg:order-2 relative" delay={200}>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative group">
              <Image
                src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800"
                alt={`${siteName} imports`}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-brand-primary/20 group-hover:bg-transparent transition-colors duration-300"></div>
            </div>

            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl max-w-xs hidden md:block animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center text-brand-accent">
                  <i className="ri-ship-line text-xl"></i>
                </div>
                <div>
                  <p className="font-bold text-brand-primary">Port-ready</p>
                  <p className="text-sm text-brand-foreground/60">Clearing and delivery help</p>
                </div>
              </div>
            </div>
          </AnimatedSection>

        </div>
      </div>
    </section>
  );
}
