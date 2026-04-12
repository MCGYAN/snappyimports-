'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import AnnouncementBar from './AnnouncementBar';
import { Search, User, ShoppingCart, Menu, X } from 'lucide-react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'Sambatek';
  const headerLogo = getSetting('site_logo') || '/logo.png?v=official';

  useEffect(() => {
    // Auth logic
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

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

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    ...categories.slice(0, 3).map(c => ({ label: c.name, href: `/shop?category=${c.slug}` })),
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const secondaryChips = [
    ...categories.map(c => ({ label: c.name, href: `/shop?category=${c.slug}`, active: false })),
    { label: 'All Categories', href: '/categories', active: false },
  ];

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-50 w-full flex flex-col font-sans">
        {/* TOP HEADER */}
        <div className="bg-[#002B5E] text-white">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20 gap-4">

              {/* Left: Mobile Menu & Logo */}
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  className="lg:hidden p-2 -ml-2 text-white hover:text-amber-400 transition-colors"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <Link href="/" className="flex items-center select-none group" aria-label={siteName}>
                  <Image src={headerLogo} alt={siteName} width={520} height={140} className="h-14 sm:h-14 md:h-20 w-auto max-w-[260px] sm:max-w-[300px] md:max-w-[420px] lg:max-w-[520px] object-contain object-left group-hover:opacity-90 transition-opacity" priority unoptimized={headerLogo.includes('logo.png')} />
                </Link>
              </div>

              {/* Center: Search Bar (Desktop) */}
              <div className="hidden lg:block flex-1 max-w-2xl mx-8">
                <form onSubmit={handleSearch}>
                  <div className="relative group">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search security products..."
                      className="w-full bg-white text-[#002B5E] rounded-md py-2.5 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium placeholder-[#002B5E]/60 shadow-inner"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#002B5E] hover:text-[#001733] transition-colors"
                      aria-label="Search"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 sm:gap-6">
                <Link
                  href={user ? "/account" : "/auth/login"}
                  className="hidden sm:flex items-center gap-2 text-white hover:text-amber-400 transition-colors"
                >
                  <User className="w-6 h-6" />
                  <span className="font-medium text-sm">Your Account</span>
                </Link>

                <div className="relative">
                  <button
                    className="flex items-center gap-2 text-white hover:text-amber-400 transition-colors group"
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label="Cart"
                  >
                    <div className="relative">
                      <ShoppingCart className="w-6 h-6" />
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-[#002B5E] shadow-sm transform group-hover:scale-110 transition-transform">
                          {cartCount}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:inline font-medium text-sm">My Basket</span>
                  </button>
                  <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
                </div>
              </div>
            </div>

            {/* Mobile Search Bar */}
            <div className="pb-4 lg:hidden">
              <form onSubmit={handleSearch}>
                <div className="relative flex">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search security products..."
                    className="w-full bg-white text-[#002B5E] rounded-md py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium placeholder-[#002B5E]/60"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#002B5E]"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Center Navigation Items (Desktop) */}
            <div className="hidden lg:flex items-center justify-center space-x-8 pb-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold uppercase tracking-wider text-white/90 hover:text-amber-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* SECONDARY BAR */}
        <div className="bg-[#E6F0FA] shadow-sm border-b border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3 overflow-x-auto scrollbar-hide">
            <div className="flex space-x-3 whitespace-nowrap">
              {secondaryChips.map((chip, idx) => (
                <Link
                  key={idx}
                  href={chip.href}
                  className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm ${chip.active
                    ? 'bg-white text-[#002B5E] border-2 border-amber-500'
                    : 'bg-white text-gray-700 border border-transparent hover:border-blue-300 hover:text-[#002B5E]'
                    }`}
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 bg-[#002B5E] flex items-center justify-between">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center" aria-label={siteName}>
                <Image src={headerLogo} alt={siteName} width={360} height={108} className="h-16 w-auto max-w-[340px] object-contain object-left" unoptimized={headerLogo.includes('logo.png')} />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 text-white/80 hover:text-white"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-lg font-medium text-gray-800 hover:bg-[#E6F0FA] hover:text-[#002B5E] rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-gray-200 my-4"></div>
              <Link
                href="/account"
                className="flex items-center gap-3 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <User className="w-5 h-5 text-gray-500" />
                My Account
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}