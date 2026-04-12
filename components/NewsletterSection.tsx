"use client";

import { useState } from 'react';

// Newsletter Component
export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmitStatus('success');
      setEmail('');
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 mb-16">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-3xl overflow-hidden shadow-2xl relative border border-white/5">

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.06),transparent)]" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between p-10 md:p-12 lg:p-14 gap-10">

          <div className="text-center lg:text-left max-w-md">
            <span className="text-[10px] font-semibold tracking-[0.25em] text-white/50 uppercase">Newsletter</span>
            <h3 className="text-2xl md:text-3xl font-serif text-white mt-3 mb-4 leading-tight">
              Stay in the <span className="italic text-white/80">loop</span>
            </h3>
            <p className="text-white/60 text-sm leading-relaxed font-light">
              New arrivals, exclusive offers and updates. No spam — just the good stuff.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 min-w-0 bg-white/10 border border-white/20 text-white placeholder-white/40 px-4 py-3 rounded-xl focus:ring-2 focus:ring-white/20 focus:border-white/30 text-sm font-light transition-all"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-white text-gray-900 font-medium px-5 py-3 rounded-xl transition-all hover:bg-white/95 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-sm whitespace-nowrap"
              >
                {isSubmitting ? <i className="ri-loader-4-line animate-spin" /> : 'Join'}
              </button>
            </form>
          </div>

        </div>

        {submitStatus === 'success' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 text-gray-900 px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <i className="ri-checkbox-circle-line mr-2" /> Thanks for joining.
          </div>
        )}
      </div>
    </div>
  );
}
