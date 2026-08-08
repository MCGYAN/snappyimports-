'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import ScrollToTop from '@/components/ScrollToTop';
import ErrorBoundary from '@/components/ErrorBoundary';
import NavigationProgress from '@/components/NavigationProgress';
import { CMSProvider } from '@/context/CMSContext';

// Silent PWA registration only. No cookie / install / update popups on first visit.
const PWAInstaller = dynamic(() => import('@/components/PWAInstaller'), { ssr: false });
const OfflineIndicator = dynamic(() => import('@/components/OfflineIndicator'), { ssr: false });

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CMSProvider>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <ScrollToTop />
      <div className="min-h-screen store-site-bg">
        <PWAInstaller />
        <Header />
        <ErrorBoundary>
          <main className="pwa-page-enter pb-[max(5.25rem,env(safe-area-inset-bottom,0px)+4.5rem)] md:pb-0">
            {children}
          </main>
        </ErrorBoundary>
        <Footer />
        <MobileBottomNav />
        <OfflineIndicator />
      </div>
    </CMSProvider>
  );
}
