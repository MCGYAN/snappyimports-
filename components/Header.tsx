'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MiniCart from './MiniCart';
import StoreLogo from './StoreLogo';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import {
  clearAuthCookies,
  getAuthCookies,
  getRememberMePreference,
  syncAuthCookies,
} from '@/lib/auth-remember';
import AnnouncementBar from './AnnouncementBar';
import { Search, User, ShoppingCart, Menu, X } from 'lucide-react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();

  useEffect(() => {
    const checkUser = async () => {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const cookies = getAuthCookies();
        if (cookies) {
          const restored = await supabase.auth.setSession(cookies);
          session = restored.data.session;
        }
      }
      setUser(session?.user ?? null);
      if (session) {
        syncAuthCookies(session, getRememberMePreference());
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        syncAuthCookies(session, getRememberMePreference());
      } else if (event === 'SIGNED_OUT') {
        // Do not clear on a brief null INITIAL_SESSION (common on Safari).
        clearAuthCookies();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // When the window grows wide enough again, close the compact menu and search drawer.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const onChange = () => {
      if (media.matches) {
        setIsMobileMenuOpen(false);
        setIsSearchOpen(false);
      }
    };
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/shop' },
    { label: 'Categories', href: '/categories' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];
  const serviceLinks = [
    { label: 'Buy RMB', shortLabel: 'RMB', href: '/exchange', primary: false },
    {
      label: 'China Warehouse',
      shortLabel: 'Warehouse',
      href: user
        ? '/account?tab=warehouse'
        : '/auth/login?next=%2Faccount%3Ftab%3Dwarehouse',
      primary: true,
    },
  ];

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/shop?search=${encodeURIComponent(query)}`);
    setIsSearchOpen(false);
  };

  const openCompactSearch = () => {
    setIsMobileMenuOpen(false);
    setIsSearchOpen(true);
  };

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-50 w-full flex flex-col font-sans pt-[env(safe-area-inset-top,0px)]">
        <div className="mobile-nav-bar text-white xl:glass-panel-dark xl:shadow-store-lg">
          <div className="store-container">
            <div className="flex min-h-[4.25rem] items-center justify-between gap-2 py-2 sm:min-h-[5.5rem] sm:gap-3 sm:py-0 xl:gap-4">
              <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-white active:opacity-70 xl:hidden"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setIsMobileMenuOpen(true);
                  }}
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" strokeWidth={1.75} />
                </button>
                <StoreLogo priority className="group max-w-[9.5rem] sm:max-w-none" />
              </div>

              <div className="mx-2 hidden min-w-0 flex-1 items-center justify-center gap-3 overflow-hidden xl:flex 2xl:mx-4 2xl:gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="relative shrink-0 py-2 text-xs font-bold uppercase tracking-wider text-white/80 transition-all after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-0 after:bg-brand-accent after:transition-all hover:text-white hover:after:w-full 2xl:text-sm"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex shrink-0 items-center gap-2">
                  {serviceLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-bold uppercase tracking-wide transition ${
                        link.primary
                          ? 'bg-brand-accent text-white hover:bg-[#e85f12]'
                          : 'border border-white/25 bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <span className="2xl:hidden">{link.shortLabel}</span>
                      <span className="hidden 2xl:inline">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                <div className="relative hidden w-full max-w-[12rem] 2xl:block 2xl:max-w-[18rem]">
                  <form onSubmit={handleSearchSubmit} className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full rounded-full border border-white/15 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/70 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/30 transition-colors shadow-inner"
                    />
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
                      strokeWidth={2}
                    />
                  </form>
                </div>

                <button
                  type="button"
                  onClick={() => (isSearchOpen ? setIsSearchOpen(false) : openCompactSearch())}
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-white active:opacity-70 2xl:hidden"
                  aria-label={isSearchOpen ? 'Close search' : 'Open search'}
                  aria-expanded={isSearchOpen}
                >
                  {isSearchOpen ? (
                    <X className="h-5 w-5" strokeWidth={1.75} />
                  ) : (
                    <Search className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </button>

                <Link
                  href={user ? '/account' : '/auth/login'}
                  className="hidden items-center gap-2 text-white transition-colors hover:text-brand-accent group sm:flex"
                  aria-label="Account"
                >
                  <User className="h-5 w-5 transition-transform group-hover:scale-110" strokeWidth={1.75} />
                  <span className="hidden text-sm font-medium 2xl:inline">Account</span>
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    className="group relative flex h-10 w-10 shrink-0 items-center justify-center text-white active:opacity-70 sm:w-auto sm:gap-2 sm:px-1"
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label="Cart"
                  >
                    <ShoppingCart
                      className="h-5 w-5 transition-transform group-hover:scale-110"
                      strokeWidth={1.75}
                    />
                    {cartCount > 0 && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent text-[10px] font-bold text-white shadow-sm sm:-right-1 sm:-top-1">
                        {cartCount}
                      </span>
                    )}
                    <span className="hidden text-sm font-medium 2xl:inline">Basket</span>
                  </button>
                  <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
                </div>
              </div>
            </div>

            {isSearchOpen && (
              <div className="border-t border-white/10 px-4 pb-3 pt-3 2xl:hidden">
                <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                  <input
                    type="search"
                    enterKeyHint="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-base text-white placeholder:text-white/60 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/30 shadow-inner"
                    autoFocus
                  />
                  <Search className="pointer-events-none absolute left-4 h-5 w-5 text-white/60" />
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] xl:hidden">
          <div
            className="absolute inset-0 bg-brand-primary/40"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 top-0 flex w-[88%] max-w-sm flex-col liquid-glass animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between border-b border-white/10 glass-panel-dark px-4 py-4">
              <StoreLogo />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center text-white active:opacity-70"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" strokeWidth={1.75} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="mobile-editorial-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {serviceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`mobile-editorial-nav-link ${
                    link.primary ? 'font-bold text-brand-accent' : ''
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/account"
                className="mobile-editorial-nav-link flex items-center gap-2 border-b-0 pt-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <User className="h-5 w-5 text-brand-accent" strokeWidth={1.75} />
                My account
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
