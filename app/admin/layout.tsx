'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SITE_LOGO_PATH } from '@/lib/brand';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Module Filtering State
  const [enabledModules, setEnabledModules] = useState<string[]>([]);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (pathname === '/admin/login') {
        setIsLoading(false);
        return;
      }

      if (!session) {
        router.push('/admin/login');
        return;
      }

      // Ensure auth cookie is set (in case user already had a session from before)
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;

      // Check user role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        console.error('Failed to fetch user profile');
        router.push('/admin/login');
        return;
      }

      // Only allow admin role (no staff)
      if (profile.role !== 'admin') {
        console.warn('User does not have admin role');
        document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
        await supabase.auth.signOut();
        router.push('/admin/login?error=unauthorized');
        return;
      }

      setUser(session.user);
      setUserRole(profile.role);
      setIsAuthenticated(true);
      setIsLoading(false);
    }

    checkAuth();

    // Keep cookie in sync when session refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
      }
      if (event === 'SIGNED_OUT') {
        document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
        document.cookie = 'sb-refresh-token=; path=/; max-age=0; SameSite=Lax; Secure';
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Fetch Modules Effect
  useEffect(() => {
    async function fetchModules() {
      try {
        const { data, error } = await supabase.from('store_modules').select('id, enabled');
        if (error) {
          console.warn('Error fetching modules:', error);
          return;
        }
        if (data) {
          setEnabledModules(data.filter((m: any) => m.enabled).map((m: any) => m.id));
        }
      } catch (err) {
        console.warn('Fetch modules failed:', err);
      }
    }
    fetchModules();
  }, []);

  // Screen size check for initial state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        // Only set to false if it's currently true? 
        // Actually, let's just default to open on desktop, closed on mobile on mount only
      }
    };

    // Set initial state based on width
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }

    // Optional: Auto-close on resize to mobile? For now, leave as is.
  }, []);

  const handleLogout = async () => {
    // Clear auth cookies set during login
    document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
    document.cookie = 'sb-refresh-token=; path=/; max-age=0; SameSite=Lax; Secure';
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center store-site-bg text-brand-primary/60">Loading Admin...</div>;
  }

  const menuItems = [
    {
      title: 'Dashboard',
      icon: 'ri-dashboard-line',
      path: '/admin',
      exact: true
    },
    {
      title: 'Orders',
      icon: 'ri-shopping-bag-line',
      path: '/admin/orders',
      badge: ''
    },
    {
      title: 'POS System',
      icon: 'ri-store-3-line',
      path: '/admin/pos'
    },
    {
      title: 'Products',
      icon: 'ri-box-3-line',
      path: '/admin/products'
    },
    {
      title: 'Categories',
      icon: 'ri-folder-line',
      path: '/admin/categories'
    },
    {
      title: 'Customers',
      icon: 'ri-group-line',
      path: '/admin/customers'
    },
    {
      title: 'Reviews',
      icon: 'ri-chat-smile-2-line',
      path: '/admin/reviews'
    },
    {
      title: 'Inventory',
      icon: 'ri-stack-line',
      path: '/admin/inventory'
    },
    {
      title: 'Analytics',
      icon: 'ri-bar-chart-line',
      path: '/admin/analytics'
    },
    {
      title: 'Coupons',
      icon: 'ri-coupon-2-line',
      path: '/admin/coupons'
    },
    {
      title: 'Customer Insights',
      icon: 'ri-user-search-line',
      path: '/admin/customer-insights',
      moduleId: 'customer-insights'
    },
    {
      title: 'Notifications',
      icon: 'ri-notification-3-line',
      path: '/admin/notifications',
      moduleId: 'notifications'
    },
    {
      title: 'SMS Debugger',
      icon: 'ri-message-2-line',
      path: '/admin/test-sms'
    },

    {
      title: 'Blog',
      icon: 'ri-article-line',
      path: '/admin/blog',
      moduleId: 'blog'
    },
    {
      title: 'Modules',
      icon: 'ri-puzzle-line',
      path: '/admin/modules'
    },
  ];

  const visibleMenuItems = menuItems.filter(item => {
    // @ts-ignore
    if (!item.moduleId) return true;
    // @ts-ignore
    return enabledModules.includes(item.moduleId);
  });

  // Special layout for Login Page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen store-site-bg">

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden glass-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile: Transform / Desktop: Width transition */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen liquid-glass border-r border-white/50 transition-all duration-300
          w-64
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${isSidebarOpen ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden'}
          lg:translate-x-0
        `}
      >
        <div className="h-full px-4 py-6 overflow-y-auto flex flex-col">
          <Link href="/admin" className="mb-8 block shrink-0 px-2">
            <Image
              src={SITE_LOGO_PATH}
              alt="Snappy Imports Global"
              width={220}
              height={111}
              priority
              className="h-auto w-full max-w-[200px] object-contain"
            />
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-widest text-brand-accent">
              Admin Dashboard
            </span>
          </Link>

          <nav className="space-y-1">
            {visibleMenuItems.map((item) => {
              const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)} // Close on mobile click
                  className={`group flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 transition-all duration-300 ${isActive
                    ? 'border-l-4 border-brand-accent bg-brand-primary/5 font-semibold text-brand-accent'
                    : 'text-brand-primary/70 hover:-translate-y-[1px] hover:bg-brand-primary/5 hover:text-brand-primary hover:shadow-sm'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className={`${item.icon} flex h-5 w-5 items-center justify-center text-xl ${isActive ? 'admin-nav-icon-active' : 'admin-nav-icon-idle group-hover:text-brand-primary'}`} />
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-white/50 pt-8">
            <Link
              href="/"
              target="_blank"
              onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
              className="flex cursor-pointer items-center space-x-3 rounded-lg px-4 py-3 text-brand-primary/80 transition-colors hover:bg-brand-primary/5 hover:text-brand-accent"
            >
              <i className="ri-external-link-line flex h-5 w-5 items-center justify-center text-xl text-brand-accent" />
              <span>View Store</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ml-0 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <header className="sticky top-0 z-30 border-b border-white/50 liquid-glass pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center justify-between gap-3 px-3 py-3 md:px-4 md:py-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-brand-primary transition-colors hover:bg-brand-primary/5 hover:text-brand-accent"
                aria-label="Toggle menu"
              >
                <i className={`${isSidebarOpen ? 'ri-menu-fold-line' : 'ri-menu-unfold-line'} text-xl`}></i>
              </button>
              <Link href="/admin" className="min-w-0 truncate font-heading text-sm font-bold text-brand-primary md:text-lg">
                <span className="md:hidden">Dashboard</span>
                <span className="hidden md:inline">Dashboard Overview</span>
              </Link>
            </div>

            <div className="flex shrink-0 items-center space-x-1 md:space-x-2 lg:space-x-4">
              <button className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-brand-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-primary/5 hover:text-brand-accent">
                <i className="ri-notification-3-line text-xl"></i>
                <span className="absolute top-2 right-2 w-2 h-2 bg-brand-accent rounded-full border-2 border-white"></span>
              </button>

              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex cursor-pointer items-center space-x-2 rounded-lg px-2 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-primary/5 lg:space-x-3 lg:px-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary font-semibold text-white shadow-sm lg:h-9 lg:w-9">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold capitalize text-brand-primary">{userRole || 'Admin'}</p>
                    <p className="max-w-[100px] truncate text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <i className="ri-arrow-down-s-line hidden text-brand-primary/60 sm:block" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-white/50 liquid-glass-card shadow-lg">
                    <button
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center space-x-3 border-t border-white/40 px-4 py-3 text-left transition-colors hover:bg-brand-primary/5"
                    >
                      <i className="ri-logout-box-line text-red-600 w-5 h-5 flex items-center justify-center"></i>
                      <span className="text-red-600">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
