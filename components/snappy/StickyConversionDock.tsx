'use client';

import { useCMS } from '@/context/CMSContext';
import { MessageCircle, Phone } from 'lucide-react';
import { buildTelHref, buildWhatsAppHref } from '@/lib/snappy-import';
import { cn } from '@/lib/cn';

export default function StickyConversionDock() {
  const { getSetting } = useCMS();
  const wa = getSetting('contact_whatsapp') || '';
  const phone = getSetting('contact_phone') || '';
  const waHref = buildWhatsAppHref(wa);
  const telHref = buildTelHref(phone);

  if (!waHref && !telHref) return null;

  return (
    <div
      className={cn(
        'fixed right-3 z-[45] hidden flex-col gap-3 sm:right-5 md:flex',
        'bottom-[max(1.25rem,env(safe-area-inset-bottom,0px)+0.5rem)] md:bottom-8'
      )}
      aria-label="Quick contact"
    >
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-green-900/20 transition-transform hover:scale-105 active:scale-95"
          title="Chat on WhatsApp"
        >
          <MessageCircle className="h-7 w-7" strokeWidth={2} />
        </a>
      )}
      {telHref && (
        <a
          href={telHref}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg shadow-black/25 transition-transform hover:scale-105 active:scale-95"
          title="Call us"
        >
          <Phone className="h-6 w-6" strokeWidth={2} />
        </a>
      )}
    </div>
  );
}
