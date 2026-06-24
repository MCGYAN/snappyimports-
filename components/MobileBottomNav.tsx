'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useCMS } from '@/context/CMSContext';
import {
  buildTelHref,
  buildWhatsAppHref,
  resolveContactPhone,
  resolveContactWhatsApp,
} from '@/lib/snappy-import';
import type { LucideIcon } from 'lucide-react';
import { Home, LayoutGrid, Phone, User, MessageCircle } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { getSetting } = useCMS();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const waHref = buildWhatsAppHref(resolveContactWhatsApp(getSetting('contact_whatsapp')));
  const telHref = buildTelHref(resolveContactPhone(getSetting('contact_phone')));

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) setIsVisible(false);
      else setIsVisible(true);
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out md:hidden ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-label="Mobile navigation"
    >
      <div className="mobile-bottom-bar">
        <div
          className="grid grid-cols-5 items-end pt-0.5"
          style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
        >
          <MobileItem href="/" label="Home" active={isActive('/')} icon={Home} />
          <MobileItem href="/shop" label="Shop" active={isActive('/shop')} icon={LayoutGrid} />
          <div className="relative flex flex-col items-center justify-end pb-1">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="-mt-5 mb-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-brand-accent text-white shadow-md shadow-brand-accent/30 active:scale-95"
              aria-label="Chat on WhatsApp"
            >
              <MessageCircle className="h-5 w-5" strokeWidth={2} />
            </a>
            <span className="text-[10px] font-medium text-slate-500">WhatsApp</span>
          </div>
          <a
            href={telHref}
            className="flex flex-col items-center justify-center py-2 text-slate-500 active:opacity-70"
            aria-label="Call"
          >
            <Phone className="h-5 w-5" strokeWidth={1.75} />
            <span className="mt-0.5 text-[10px] font-medium">Call</span>
          </a>
          <MobileItem href="/account" label="Account" active={isActive('/account')} icon={User} />
        </div>
      </div>
    </nav>
  );
}

function MobileItem({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center justify-center border-t-2 py-2 transition-colors ${
        active ? 'border-brand-accent text-brand-primary' : 'border-transparent text-slate-400'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
      <span className="mt-0.5 text-[10px] font-medium">{label}</span>
    </Link>
  );
}
