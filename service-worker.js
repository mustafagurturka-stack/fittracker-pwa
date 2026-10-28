const CACHE_PREFIX = 'fittracker-pro-';
const CACHE_NAME = 'fittracker-pro-recovery-20261028-3';
const BUILD_ASSETS = /*__BUILD_ASSETS__*/ ['/styles/main.css?v=178.1-compare','/scripts/vendor/supabase-2.112.3.js','/scripts/monthly.js?v=20261028','/scripts/app.js?v=277.14-compare','/manifest.json?v=277.7','/icons/icon-192.png?v=229','/icons/icon-512.png?v=229'];
const SHELL = ['/index.html', ...BUILD_ASSETS];
// CacheStorage is optional: its failures must never reject a page navigation.
function cacheAttempt(task, ms = 700) {
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(undefined), ms); });
  return Promise.race([Promise.resolve().then(task).catch(() => undefined), timeout])
    .finally(() => clearTimeout(timer));
}
async function boundedFetch(request, ms = 8000) {
  const controller = new AbortController();
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Network deadline')); }, ms);
  });
  try { return await Promise.race([fetch(request, {signal:controller.signal, cache: 'no-store'}), expired]); }
  finally { clearTimeout(timer); }
}
const unavailable = () => new Response('<!doctype html><html lang="tr"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Açılış bekleniyor</title><body style="margin:0;background:#f6f7f8;color:#243444;font:16px system-ui;padding:24px;line-height:1.6"><h1>Uygulama açılamadı</h1><p>Bağlantı veya uygulama dosyaları yanıt vermedi. Kayıtlarınız silinmedi.</p><button onclick="location.reload()" style="min-height:44px;padding:10px 18px">Yeniden dene</button><p>Açılış onarımı: 2026.10.28.3</p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
async function readableDocument(response) {
  if (!response?.ok) return undefined;
  const text = await response.text();
  if (!/<!doctype\s+html|<html[\s>]/i.test(text) || !/<body[\s>]/i.test(text)) return undefined;
  // Reconstruct redirect-followed cached HTML safely; retain security headers.
  const headers = new Headers(response.headers);
  for (const key of ['content-encoding','content-length','transfer-encoding']) headers.delete(key);
  headers.set('Content-Type','text/html; charset=utf-8');
  return new Response(text,{status:200,headers});
}
async function cachedDocument() {
  return cacheAttempt(async()=>{
    const keys = await caches.keys();
    const own = [CACHE_NAME,...keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).reverse().slice(0,2)];
    for(const key of own) {
      try {
        const cache = await caches.open(key);
        const response = await cache.match('/index.html');
        const document = await readableDocument(response);
        if(document) return document;
      } catch { /* Try another app-owned shell; never clear account storage. */ }
    }
  },1000);
}
async function staticMatch(request) {
  return cacheAttempt(async()=>{
    const keys = await caches.keys();
    for(const key of [CACHE_NAME,...keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).reverse().slice(0,2)]) {
      try {const match=await (await caches.open(key)).match(request);if(match?.ok)return match;}catch{}
    }
  });
}
self.addEventListener('install',event=>{
  // addAll is atomic, but storage/network failures must not trap the recovery
  // worker in "installing". An empty cache uses the bounded network fallback.
  event.waitUntil(cacheAttempt(()=>caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)),8000).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  // Keep existing caches during recovery; never unregister push subscriptions.
  event.waitUntil(Promise.resolve(self.clients.claim()).catch(()=>{}));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE'||event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if (['/app-version.json','/sw.js'].includes(url.pathname) || url.pathname === '/service-worker.js') {
    event.respondWith(boundedFetch(request));return;
  }
  if(request.mode==='navigate') {
    event.respondWith((async()=>{
      const cached=await cachedDocument();
      if(cached)return cached;
      try {
        const response=await boundedFetch(request);
        const document=await cacheAttempt(()=>readableDocument(response),5000);
        if(document)return document;
      }catch{/* Network and cache can both fail; always return readable HTML. */}
      return unavailable();
    })());
    return;
  }
  if(!['script','style','image','font'].includes(request.destination)&&!SHELL.some(asset=>new URL(asset,self.location.origin).pathname===url.pathname))return;
  event.respondWith((async()=>{
    const cached=await staticMatch(request);
    if(cached)return cached;
    try {
      const response=await boundedFetch(request);
      // Deliver the resource before optional cache writes; a stuck disk must not
      // hold stylesheet/module delivery and Safari's loading indicator open.
      if(response.ok&&response.type==='basic') {
        event.waitUntil(cacheAttempt(()=>caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone()))));
      }
      return response;
    }catch{return Response.error();}
  })());
});


