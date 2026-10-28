const CACHE_PREFIX = 'fittracker-pro-';
const CACHE_NAME = 'fittracker-pro-monthly-20261028-static';
const BUILD_ASSETS = /*__BUILD_ASSETS__*/ ['/styles/main.css?v=178.1-compare','/scripts/vendor/supabase-2.112.3.js','/scripts/monthly.js?v=20261028','/scripts/app.js?v=277.14-compare','/manifest.json?v=277.7','/icons/icon-192.png?v=229','/icons/icon-512.png?v=229'];
const SHELL = ['/index.html', ...BUILD_ASSETS];
async function boundedFetch(request, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(request, {signal:controller.signal, cache:'no-store'}); }
  finally { clearTimeout(timer); }
}
const unavailable = () => new Response('<!doctype html><html lang="tr"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bağlantı bekleniyor</title><body style="font:16px system-ui;padding:24px;line-height:1.6"><h1>Bağlantı bekleniyor</h1><p>Uygulama dosyaları alınamadı. Kayıtlarınız silinmedi. İnternet bağlantınızı kontrol edip tekrar deneyin.</p><button onclick="location.reload()" style="min-height:44px;padding:10px 18px">Yeniden dene</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
self.addEventListener('install', event => {
  // Installation succeeds only when the matching HTML AND its bundled assets exist.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const own = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX));
    const previous = own.filter(key => key !== CACHE_NAME).slice(-1)[0];
    await Promise.all(own.filter(key => key !== CACHE_NAME && key !== previous).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
async function staticMatch(request) {
  const own = (await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX));
  for (const key of [CACHE_NAME, ...own.filter(k => k !== CACHE_NAME).reverse()]) {
    const response = await (await caches.open(key)).match(request);
    if (response) return response;
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache Supabase/Auth/API responses, POSTs, other apps or external origins.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE_NAME)).match('/index.html');
      // Current cache is a coherent installed build. Do not overwrite it with
      // a new deployment's HTML before its worker has precached the matching JS.
      if (cached) return cached;
      try { const response = await boundedFetch(request); return response.ok ? response : unavailable(); }
      catch { return unavailable(); }
    })());
    return;
  }
  if (!['script','style','image','font'].includes(request.destination) && !SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await staticMatch(request);
    if (cached) return cached;
    try {
      const response = await boundedFetch(request);
      if (response.ok && response.type === 'basic') {
        try { await (await caches.open(CACHE_NAME)).put(request, response.clone()); } catch { /* Quota cannot block delivery. */ }
      }
      return response;
    } catch { return Response.error(); }
  })());
});



