"use client";

import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import StoreLogo from '@/components/StoreLogo';
import { useState, useEffect } from 'react';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';

const linkClass =
  'text-white/80 transition-colors active:text-white max-lg:text-[13px] lg:hover:text-white lg:hover:translate-x-1 lg:transition-all lg:duration-300';

const mobileHeadingClass =
  'mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-accent lg:mb-4 lg:text-sm lg:tracking-widest';

export default function Footer() {
  const { getSetting } = useCMS();
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/storefront/categories');
        if (res.ok) {
          const data = await res.json();
          if (data) setCategories(data);
        }
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    };
    fetchCategories();
  }, []);

  const siteName = getSetting('site_name') || 'Store';
  const siteTagline = getSetting('site_tagline') || 'Importing is no longer stressful. We handle the hard part so you do not have to.';
  const contactAddress = getSetting('contact_address') || '';
  const socialFacebook = getSetting('social_facebook') || '';
  const socialInstagram = getSetting('social_instagram') || '';
  const socialTikTok = getSetting('social_tiktok') || '';
  const socialTwitter = getSetting('social_twitter') || '';
  const socialYoutube = getSetting('social_youtube') || '';

  const socials = [
    { link: socialInstagram, icon: <Instagram className="h-4 w-4" />, label: 'Instagram' },
    { link: socialTikTok, icon: <i className="ri-tiktok-fill text-[15px] leading-none" />, label: 'TikTok' },
    { link: socialYoutube, icon: <Youtube className="h-4 w-4" />, label: 'YouTube' },
    { link: socialTwitter, icon: <Twitter className="h-4 w-4" />, label: 'X' },
    { link: socialFacebook, icon: <Facebook className="h-4 w-4" />, label: 'Facebook' },
  ].filter((s) => s.link);

  return (
    <footer className="relative z-0 mt-8 bg-brand-primary text-white lg:mt-16 lg:rounded-t-[2.5rem]">
      <div className="store-container pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-6 lg:pb-10 lg:pt-14">
        {/* Brand block */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5 lg:block lg:border-0 lg:pb-0">
          <div className="min-w-0 flex-1">
            <StoreLogo size="sm" className="mb-2 lg:mb-4" />
            <p className="max-w-sm text-xs leading-snug text-white/70 lg:text-sm lg:leading-relaxed lg:text-white/75">
              {siteTagline}
            </p>

            {contactAddress ? (
              <p className="mt-3 line-clamp-2 text-xs text-white/55 lg:hidden">{contactAddress}</p>
            ) : null}
          </div>

          {socials.length > 0 ? (
            <div className="flex shrink-0 gap-2 lg:mt-4">
              {socials.map((social, i) => (
                <a
                  key={i}
                  href={social.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-8 w-8 items-center justify-center border border-white/20 text-white/85 active:border-brand-accent active:text-brand-accent lg:h-9 lg:w-9 lg:hover:border-brand-accent lg:hover:bg-brand-accent lg:hover:text-white"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {/* Links — 2 columns on mobile, 4 on desktop */}
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 sm:gap-x-8 lg:mt-12 lg:grid-cols-4 lg:gap-12">
          {contactAddress ? (
            <div className="hidden lg:block">
              <p className="text-sm text-white/60">{contactAddress}</p>
            </div>
          ) : null}

          <div>
            <h4 className={mobileHeadingClass}>Browse</h4>
            <ul className="space-y-1.5 text-sm lg:space-y-2.5">
              <li><Link href="/shop" className={linkClass}>Featured products</Link></li>
              <li><Link href="/categories" className={linkClass}>All categories</Link></li>
              {categories.slice(0, 2).map((cat, idx) => (
                <li key={idx}>
                  <Link href={`/shop?category=${cat.slug}`} className={linkClass}>{cat.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={mobileHeadingClass}>Support</h4>
            <ul className="space-y-1.5 text-sm lg:space-y-2.5">
              <li><Link href="/contact" className={linkClass}>Contact us</Link></li>
              <li><Link href="/order-tracking" className={linkClass}>Track order</Link></li>
              <li><Link href="/shipping" className={linkClass}>Shipping</Link></li>
              <li><Link href="/returns" className={linkClass}>Returns</Link></li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <h4 className={mobileHeadingClass}>Company</h4>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm sm:block sm:space-y-2.5">
              <li><Link href="/about" className={linkClass}>About</Link></li>
              <li><Link href="/privacy" className={linkClass}>Privacy</Link></li>
              <li><Link href="/terms" className={linkClass}>Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-1 border-t border-white/10 pt-4 text-[11px] text-white/50 lg:mt-12 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:pt-6 lg:text-xs">
          <p>&copy; {new Date().getFullYear()} {siteName}</p>
          <p className="text-white/55 lg:text-white/60">Secure payment at checkout</p>
        </div>
      </div>
    </footer>
  );
}
