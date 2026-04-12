'use client';

import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ShieldCheck, Cpu, LockKeyhole, CheckCircle2, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  usePageTitle('About Us');
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Sambatek';

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="About SaMba TeK"
        subtitle="Advanced security solutions for homes, offices and businesses across Ghana."
        backgroundImages={['/hero%201.jpg', '/hero%202.jpg', '/hero%203.jpg', '/hero4.jpg']}
      />

      {/* Brand Story */}
      <section className="py-20 md:py-28 bg-white overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-sm font-bold tracking-[0.2em] text-[#002B5E] uppercase bg-blue-50 px-4 py-2 rounded-full inline-block mb-6">Our Mission</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#002B5E] mt-3 mb-8 leading-tight">
            Security you can trust. <span className="text-amber-500">Built for Ghana.</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-500 leading-relaxed max-w-3xl mx-auto font-medium">
            <strong>{siteName}</strong> is a Ghanaian technology company specializing in advanced security solutions for homes, offices and commercial properties.
          </p>
        </div>
      </section>

      {/* Expertise & Services */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl bg-[#002B5E] flex items-center justify-center p-8 border-4 border-white">
                <ShieldCheck className="w-full h-full text-white/10 absolute inset-0 m-auto scale-150" />
                <div className="relative z-10 text-center text-white">
                  <Cpu className="w-20 h-20 mx-auto text-amber-500 mb-6" />
                  <h3 className="text-3xl font-bold mb-4">Safer Spaces, Smarter Living</h3>
                  <p className="text-blue-100 text-lg">Durable protection and modern control, installed by professionals.</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-sm font-bold tracking-[0.2em] text-[#002B5E] uppercase">Our Expertise</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#002B5E] mb-6 mt-2 leading-tight">
                Advanced security for homes, offices and commercial properties
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6 text-lg">
                We focus on delivering durable security doors, modern surveillance systems, smart locks and access control technology to improve safety and convenience.
              </p>
              <ul className="space-y-4 text-gray-700">
                <li className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <ShieldCheck className="w-6 h-6 text-amber-500 flex-shrink-0" />
                  <span className="font-semibold">Security Doors & Strong Installations</span>
                </li>
                <li className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <Cpu className="w-6 h-6 text-[#002B5E] flex-shrink-0" />
                  <span className="font-semibold">CCTV & Modern Surveillance Systems</span>
                </li>
                <li className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <LockKeyhole className="w-6 h-6 text-amber-500 flex-shrink-0" />
                  <span className="font-semibold">Smart Locks & Access Control Systems</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 md:py-28 bg-[#002B5E] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-sm font-bold tracking-[0.2em] text-white/50 uppercase">Why Choose Us</span>
          <h2 className="text-3xl md:text-4xl font-extrabold mt-3 mb-16 leading-tight text-white">
            Why customers choose {siteName}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 p-8 rounded-2xl border border-white/10 hover:border-amber-500/50 transition-colors">
              <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto mb-6" />
              <h3 className="text-xl font-bold mb-4">Durable Solutions</h3>
              <p className="text-blue-200">We recommend and install security products designed to last and perform reliably.</p>
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/10 hover:border-amber-500/50 transition-colors">
              <CheckCircle2 className="w-12 h-12 text-amber-500 mx-auto mb-6" />
              <h3 className="text-xl font-bold mb-4">Professional Installation</h3>
              <p className="text-blue-200">Our team installs and configures systems properly for safety, performance and peace of mind.</p>
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/10 hover:border-amber-500/50 transition-colors">
              <LockKeyhole className="w-12 h-12 text-amber-500 mx-auto mb-6" />
              <h3 className="text-xl font-bold mb-4">Local Coverage</h3>
              <p className="text-blue-200">Our goal is to provide reliable security solutions for customers in Accra, Tarkwa and across Ghana.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#002B5E] mb-6">Upgrade Your Security Today</h2>
          <p className="text-gray-500 text-lg mb-10">Browse our security products or contact our team for professional installation and support.</p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-3 bg-[#002B5E] hover:bg-amber-500 hover:text-[#002B5E] text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg text-lg group"
          >
            Explore Solutions <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
