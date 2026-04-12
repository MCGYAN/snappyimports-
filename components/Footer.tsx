"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useCMS } from '@/context/CMSContext';
import { useState, useEffect } from 'react';
import { Facebook, Instagram, Twitter, Youtube, CreditCard } from 'lucide-react';

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

  const siteName = getSetting('site_name') || 'Sambatek';
  const siteTagline = getSetting('site_tagline') || 'Securing your world with advanced technology.';
  const contactPhone = getSetting('contact_phone') || '';
  const contactAddress = getSetting('contact_address') || '';
  const siteLogo = getSetting('site_logo') || '/logo.png';
  // Socials (prefer CMS, fall back to hard-coded links you provided)
  const socialFacebook = getSetting('social_facebook') || 'https://www.facebook.com/samuel.mbah.967';
  const socialInstagram = getSetting('social_instagram') || 'https://www.instagram.com/joelyrix?igsh=cTVkemY5ZHllYXUw';
  const socialTikTok = getSetting('social_tiktok') || 'https://www.tiktok.com/@joelyrix?_r=1&_t=ZS-94lgb0VN2Is';
  const socialTwitter = getSetting('social_twitter') || '';
  const socialYoutube = getSetting('social_youtube') || '';

  return (
    <footer className="relative mt-16 z-0">
      <div className="absolute inset-0 bg-[#001733] rounded-t-[2.5rem] -z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      <div className="text-white pt-14 pb-24 lg:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

            {/* Brand */}
            <div className="lg:col-span-1 space-y-5">
              <Link href="/" className="inline-block group mb-4">
                <Image src={siteLogo} alt={siteName} width={440} height={132} className="h-14 sm:h-20 md:h-24 lg:h-28 w-auto max-w-[220px] sm:max-w-[320px] md:max-w-[440px] object-contain object-left group-hover:opacity-90 transition-opacity" />
              </Link>
              <p className="text-blue-200 leading-relaxed text-sm font-medium">
                {siteTagline}
              </p>
              <p className="text-blue-200/70 text-sm font-medium">{contactAddress}</p>
              {contactPhone ? <a href={`tel:${contactPhone}`} className="text-white/90 text-sm font-bold hover:text-amber-500 transition-colors block">{contactPhone}</a> : null}
              <div className="flex gap-5 pt-3">
                {[
                  { link: socialInstagram, icon: <Instagram className="w-5 h-5" />, label: 'Instagram' },
                { link: socialTikTok, icon: <i className="ri-tiktok-fill text-[18px] leading-none" />, label: 'TikTok' },
                  { link: socialYoutube, icon: <Youtube className="w-5 h-5" />, label: 'YouTube' },
                  { link: socialTwitter, icon: <Twitter className="w-5 h-5" />, label: 'X' },
                  { link: socialFacebook, icon: <Facebook className="w-5 h-5" />, label: 'Facebook' }
                ].filter(s => s.link).map((social, i) => (
                  <a
                    key={i}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-blue-200 hover:bg-amber-500 hover:text-[#001733] transition-all"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Shop */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold tracking-widest text-amber-500 uppercase">Equipment</h4>
              <ul className="space-y-3 text-sm text-blue-200 font-medium">
                <li><Link href="/shop" className="hover:text-amber-500 transition-colors">All Products</Link></li>
                <li><Link href="/categories" className="hover:text-amber-500 transition-colors">All Categories</Link></li>
                {categories.slice(0, 3).map((cat, idx) => (
                  <li key={idx}>
                    <Link href={`/shop?category=${cat.slug}`} className="hover:text-amber-500 transition-colors">{cat.name}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold tracking-widest text-amber-500 uppercase">Support</h4>
              <ul className="space-y-3 text-sm text-blue-200 font-medium">
                <li><Link href="/contact" className="hover:text-amber-500 transition-colors">Contact Technical Support</Link></li>
                <li><Link href="/order-tracking" className="hover:text-amber-500 transition-colors">Track Order</Link></li>
                <li><Link href="/shipping" className="hover:text-amber-500 transition-colors">Shipping & Installation</Link></li>
                <li><Link href="/returns" className="hover:text-amber-500 transition-colors">Returns & Warranty</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold tracking-widest text-amber-500 uppercase">Company</h4>
              <ul className="space-y-3 text-sm text-blue-200 font-medium">
                <li><Link href="/about" className="hover:text-amber-500 transition-colors">About Us</Link></li>
                <li><Link href="/privacy" className="hover:text-amber-500 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-amber-500 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-blue-900 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-blue-300 font-medium">
            <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <div className="flex items-center gap-2 bg-[#002B5E] py-2 px-4 rounded-xl border border-blue-800">
              <CreditCard className="w-4 h-4 text-blue-300" />
              <span className="text-blue-300 font-bold tracking-wide">SECURE PAYMENT</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
