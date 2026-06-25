'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MiniCart from './MiniCart';
import StoreLogo from './StoreLogo';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
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
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/shop' },
    { label: 'Categories', href: '/categories' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/shop?search=${encodeURIComponent(query)}`);
    setIsSearchOpen(false);
  };

  const openMobileSearch = () => {
    setIsMobileMenuOpen(false);
    setIsSearchOpen(true);
  };

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-50 w-full flex flex-col font-sans pt-[env(safe-area-inset-top,0px)]">
        <div className="mobile-nav-bar text-white md:glass-panel-dark md:shadow-store-lg">
          <div className="store-container">
            <div className="flex min-h-[3.5rem] items-center justify-between gap-3 py-2 sm:min-h-20 sm:gap-4 sm:py-0">

              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  className="md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center text-white active:opacity-70"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setIsMobileMenuOpen(true);
                  }}
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6" strokeWidth={1.75} />
                </button>
                <StoreLogo priority className="group" />
              </div>

              <div className="mx-4 hidden min-w-0 flex-1 items-center justify-center gap-6 md:mx-6 md:flex md:gap-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="relative py-2 text-sm font-bold uppercase tracking-wider text-white/80 transition-all after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-0 after:bg-brand-accent after:transition-all hover:text-white hover:after:w-full md:py-2.5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-2 sm:gap-5">
                <div className="hidden md:block relative w-full max-w-[16rem] lg:max-w-[20rem]">
                  <form onSubmit={handleSearchSubmit} className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search products..."
                      className="w-full rounded-full border border-white/15 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/70 focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/30 transition-colors shadow-inner"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" strokeWidth={2} />
                  </form>
                </div>

                <button
                  type="button"
                  onClick={() => (isSearchOpen ? setIsSearchOpen(false) : openMobileSearch())}
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-white active:opacity-70 md:hidden"
                  aria-label={isSearchOpen ? 'Close search' : 'Open search'}
                  aria-expanded={isSearchOpen}
                >
                  {isSearchOpen ? (
                    <X className="w-5 h-5" strokeWidth={1.75} />
                  ) : (
                    <Search className="w-5 h-5" strokeWidth={1.75} />
                  )}
                </button>

                <Link
                  href={user ? "/account" : "/auth/login"}
                  className="hidden sm:flex items-center gap-2 text-white hover:text-brand-accent transition-colors group"
                  aria-label="Account"
                >
                  <User className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={1.75} />
                  <span className="font-medium text-sm hidden xl:inline">Account</span>
                </Link>

                <div className="relative">
                  <button
                    type="button"
                    className="group relative flex h-10 w-10 shrink-0 items-center justify-center text-white active:opacity-70 sm:w-auto sm:gap-2 sm:px-2"
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label="Cart"
                  >
                    <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={1.75} />
                    {cartCount > 0 && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent text-[10px] font-bold text-white shadow-sm sm:-right-1 sm:-top-1">
                        {cartCount}
                      </span>
                    )}
                    <span className="hidden font-medium text-sm xl:inline">Basket</span>
                  </button>
                  <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
                </div>
              </div>
            </div>

            {isSearchOpen && (
              <div className="border-t border-white/10 px-4 pb-3 pt-3 md:hidden">
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
                  <Search className="absolute left-4 h-5 w-5 text-white/60 pointer-events-none" />
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
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
                <X className="w-6 h-6" strokeWidth={1.75} />
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
