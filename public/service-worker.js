// Store - Service Worker (v2.4 — faster Next.js navigations)
const CACHE_VERSION = 'store-v2.4';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Only offline shell — do NOT pre-cache live App Router HTML (it goes stale and slows navigations)
const STATIC_ASSETS = [
  '/offline',
  '/favicon.ico',
  '/icon',
];

const DYNAMIC_CACHE_LIMIT = 40;
const IMAGE_CACHE_LIMIT = 80;
const API_CACHE_LIMIT = 30;

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems);
  }
}

function isNextFlightRequest(request, url) {
  if (request.headers.get('RSC') === '1') return true;
  if (request.headers.get('Next-Router-Prefetch') === '1') return true;
  if (request.headers.get('Next-Router-State-Tree')) return true;
  if (url.searchParams.has('_rsc')) return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/x-component')) return true;
  return false;
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Store v2.4...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch(() => Promise.resolve());
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Store v2.4...');
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Never intercept Next.js RSC / soft navigations — let the browser handle them
  if (isNextFlightRequest(request, url)) return;

  if (url.pathname.startsWith('/api/payment')) return;
  if (url.pathname.startsWith('/api/notifications')) return;

  if (url.pathname.startsWith('/admin') && (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin – Connection required</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;}.box{text-align:center;max-width:24rem;padding:2rem;}h1{font-size:1.5rem;color:#1e293b;margin-bottom:0.5rem;}p{color:#64748b;margin-bottom:1.5rem;}a{display:inline-block;background:#2563eb;color:#fff;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;}</style></head><body><div class="box"><h1>Connection required</h1><p>Admin needs an internet connection. Check your network and try again.</p><a href="/admin">Try again</a></div></body></html>';
          return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        })
    );
    return;
  }
  if (url.pathname.startsWith('/admin')) return;

  // Images: cache first
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/) ||
    (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/'))
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
              trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT);
            }
            return response;
          }).catch(() => {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#f3f4f6" width="200" height="200"/><text fill="#9ca3af" font-family="sans-serif" font-size="14" text-anchor="middle" x="100" y="105">Image unavailable</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          });
        });
      })
    );
    return;
  }

  // Storefront API: network first
  if (url.pathname.startsWith('/api/storefront')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
              trimCache(API_CACHE, API_CACHE_LIMIT);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response(JSON.stringify({ error: 'Offline' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Hashed Next static assets: cache first (safe — filenames change on deploy)
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.match(/\.(woff2?|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigations: network only with offline fallback (never serve stale App Router HTML)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match('/offline'))
    );
    return;
  }

  // Default: network only (do not cache arbitrary responses)
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New update from Store',
    icon: '/icon',
    badge: '/icon',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Store',
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
