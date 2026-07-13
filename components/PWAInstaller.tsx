'use client';

import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Global store for install prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

    if (deferredPrompt) setCanInstall(true);

    const handler = () => setCanInstall(!!deferredPrompt);
    window.addEventListener('pwa-prompt-ready', handler);
    return () => window.removeEventListener('pwa-prompt-ready', handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt = null;
    }
    return outcome === 'accepted';
  }, []);

  return { canInstall, isInstalled, install };
}

export default function PWAInstaller() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    // Capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event('pwa-prompt-ready'));
    };

    // Track installation
    const handleInstalled = () => {
      setIsInstalled(true);
      deferredPrompt = null;
      console.log('[PWA] App installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    // Register service worker after first paint so it doesn't compete with page load
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker
          .register('/service-worker.js', { scope: '/' })
          .then((registration) => {
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000);

            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (!newWorker) return;

              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  window.dispatchEvent(new CustomEvent('sw-update-available', {
                    detail: { registration }
                  }));
                }
              });
            });
          })
          .catch(() => {});
      };

      if (document.readyState === 'complete') {
        setTimeout(registerSW, 2500);
      } else {
        window.addEventListener('load', () => setTimeout(registerSW, 2500), { once: true });
      }

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  // Add standalone mode class to body
  useEffect(() => {
    if (isInstalled) {
      document.body.classList.add('pwa-standalone');
      document.documentElement.classList.add('pwa-standalone');
    }
  }, [isInstalled]);

  return null;
}
