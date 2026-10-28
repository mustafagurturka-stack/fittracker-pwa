import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL("../service-worker.js",import.meta.url),'utf8').replace('/*__BUILD_ASSETS__*/ []',JSON.stringify(['/assets/app-test.js'])).replace('__BUILD__','test');
const name=/const CACHE_NAME = '([^']+)'/.exec(source)[1],prefix=/const CACHE_PREFIX = '([^']+)'/.exec(source)[1];
const html='<!doctype html><html><body><h1>App ready</h1></body></html>';
const hung=()=>new Promise(()=>{});
function harness({cache='ok',match='ok',put='ok',install='ok',cached=true,network=async()=>{throw Error('offline');},cachedResponse}={}){
 const handlers={},tasks=[],added=[],deleted=[],fetches=[],entries=new Map();
 if(cached)entries.set(name+'|/index.html',cachedResponse||new Response(html));
 const key=request=>typeof request==='string'?request:new URL(request.url).pathname;
 const fail=mode=>{if(mode==='throw')throw Error('CacheStorage unavailable');if(mode==='hang')return hung();};
 const caches={
  keys:async()=>{if(cache!=='ok')return fail(cache);return[prefix+'previous',name,'another-app-cache'];},
  open:async cacheName=>{
   if(cache!=='ok')return fail(cache);
   return{
    match:async request=>{if(match!=='ok')return fail(match);return entries.get(cacheName+'|'+key(request))?.clone();},
    put:async(request,response)=>{if(put!=='ok')return fail(put);entries.set(cacheName+'|'+key(request),response);},
    addAll:async urls=>{added.push(...urls);if(install!=='ok')return fail(install);}
   };
  },delete:async key=>{deleted.push(key);return true;}
 };
 let claimed=0,skipped=0;
 const self={location:{origin:'https://app.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>skipped++,clients:{claim:async()=>claimed++}};
 vm.runInNewContext(source,{self,caches,URL,Response,Headers,AbortController,
  setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,25)),clearTimeout,
  fetch:async(...args)=>{fetches.push(args);return network(...args);}});
 const navigate=async(url='https://app.test/?focus=record')=>{
  let result;handlers.fetch({request:{url,method:'GET',mode:'navigate'},respondWith:p=>result=p,waitUntil:p=>tasks.push(p)});return result;
 };
 const fire=async name=>{let result;handlers[name]({waitUntil:p=>result=p});return result;};
 return{handlers,tasks,added,deleted,fetches,navigate,fire,entries,get claimed(){return claimed;},get skipped(){return skipped;}};
}
test('healthy cached HTML opens without network and preserves app content',async()=>{
 const h=harness({network:hung});assert.equal(await(await h.navigate()).text(),html);assert.equal(h.fetches.length,0);
});
for(const cache of ['throw','hang']){
 test('CacheStorage '+cache+' cannot block an available network navigation',async()=>{
  const h=harness({cache,network:async()=>new Response(html)});
  assert.equal(await(await h.navigate()).text(),html);assert.equal(h.fetches.length,1);
 });
}
for(const match of ['throw','hang']){
 test('cache match '+match+' recovers through the network',async()=>{
  const h=harness({match,network:async()=>new Response(html)});
  assert.equal((await h.navigate()).status,200);assert.equal(h.fetches.length,1);
 });
}
test('cache and network failure always return visible retry HTML, not a rejected promise',async()=>{
 const h=harness({cache:'throw'}),r=await h.navigate();assert.equal(r.status,503);assert.match(await r.text(),/Yeniden dene/);
});
test('network which ignores AbortSignal is still bounded when cache is missing',async()=>{
 const h=harness({cached:false,network:hung}),r=await h.navigate();assert.equal(r.status,503);
});
test('empty cached HTML is rejected and network content repairs the opening',async()=>{
 const h=harness({cachedResponse:new Response(''),network:async()=>new Response(html)});
 assert.equal(await(await h.navigate()).text(),html);assert.equal(h.fetches.length,1);
});
test('redirect-followed HTML is reconstructed without compression metadata and retains CSP',async()=>{
 const response=new Response(html,{headers:{'Content-Encoding':'gzip','Content-Length':'999','Content-Security-Policy':"default-src 'self'"}});
 const h=harness({cachedResponse:response});const r=await h.navigate();
 assert.equal(r.redirected,false);assert.equal(r.headers.get('content-encoding'),null);assert.equal(r.headers.get('content-length'),null);
 assert.equal(r.headers.get('content-security-policy'),"default-src 'self'");assert.equal(await r.text(),html);
});
test('stalled response body becomes a readable retry page',async()=>{
 const h=harness({cached:false,network:async()=>({ok:true,text:hung})});assert.equal((await h.navigate()).status,503);
});
test('cache put hang never delays delivery of a fetched stylesheet',async()=>{
 const h=harness({cached:false,put:'hang',network:async()=>{const r=new Response('body{}');Object.defineProperty(r,'type',{value:'basic'});return r;}});
 let result;h.handlers.fetch({request:{url:'https://app.test/assets/style.css',method:'GET',mode:'cors',destination:'style'},respondWith:p=>result=p,waitUntil:p=>h.tasks.push(p)});
 assert.equal(await(await result).text(),'body{}');await Promise.all(h.tasks);
});
test('installation can activate the recovery worker even when cache storage is unavailable',async()=>{
 for(const config of [{cache:'throw'},{cache:'hang'},{install:'throw'},{install:'hang'}]){
  const h=harness(config);await h.fire('install');assert.equal(h.skipped,1);
 }
 const h=harness();await h.fire('install');assert.ok(h.added.includes('/index.html'));assert.ok(h.added.some(p=>p.endsWith('.js')));
});
test('activation preserves existing and unrelated caches; no account storage or push registration is removed',async()=>{
 const h=harness();await h.fire('activate');assert.equal(h.claimed,1);assert.equal(h.deleted.length,0);
 assert.ok(!source.includes('unregister('));assert.ok(!source.includes('indexedDB.deleteDatabase'));assert.ok(!source.includes('localStorage.clear'));
});
test('private/cross-origin/API/POST requests remain unintercepted',()=>{
 const h=harness();
 for(const request of [
  {url:'https://db.supabase.co/rest/v1/private',method:'GET',mode:'cors',destination:''},
  {url:'https://app.test/api/private',method:'GET',mode:'cors',destination:''},
  {url:'https://app.test/login',method:'POST',mode:'navigate',destination:''}
 ])h.handlers.fetch({request,respondWith:()=>assert.fail('private request intercepted')});
 assert.equal(h.fetches.length,0);
});
test('worker release checks bypass static caches',async()=>{
 const h=harness({network:async()=>new Response('release')});let result;
 h.handlers.fetch({request:{url:'https://app.test/sw.js',method:'GET',mode:'cors',destination:'script'},respondWith:p=>result=p});
 assert.equal(await(await result).text(),'release');assert.equal(h.fetches.length,1);
});

