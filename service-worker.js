'use strict';

// ── CACHE VERSION ──
// Versiyonu her deploy'da artır → eski cache otomatik temizlenir.
const CACHE_VERSION  = 'ft-v2';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE  = `${CACHE_VERSION}-runtime`;
const MAX_RUNTIME_ITEMS = 50;

// Precache edilecek kritik dosyalar
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html',
];

// ── INSTALL ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // Yeni SW hemen aktif olsun
  );
});

// ── ACTIVATE ──
// Eski cache'leri temizle; yeni SW tüm sekmeleri kontrol alsın.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Yalnızca aynı origin ve GET isteklerini handle et
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Navigasyon isteği → Network first, hata durumunda offline.html
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Statik assetler (precache'de varsa) → Cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Diğer → Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── STRATEJİLER ──

/** Network first; ağ başarısız olursa cache ya da offline.html döner. */
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, networkResponse.clone());
    await pruneCache(cache, MAX_RUNTIME_ITEMS);
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/offline.html');
  }
}

/** Cache first; yoksa ağdan çek ve cache'e ekle. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/** Cache'den hemen dön, arka planda güncelle. */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(async response => {
      await cache.put(request, response.clone());
      await pruneCache(cache, MAX_RUNTIME_ITEMS);
      return response;
    })
    .catch(() => null);

  return cached || networkFetch;
}

async function pruneCache(cache, maxItems) {
  const keys = await cache.keys();
  while (keys.length > maxItems) {
    const oldest = keys.shift();
    if (!oldest) break;
    await cache.delete(oldest);
  }
}

// ── YARDIMCI ──

/** Statik asset mi? (js, css, font, icon vs.) */
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/i.test(pathname);
}

// ── PUSH BİLDİRİMLERİ (ileride kullanım için hazır) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'FitTracker', {
      body:    data.body || '',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url === target && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(target);
    })
  );
});
