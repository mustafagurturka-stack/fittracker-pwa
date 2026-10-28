import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const workerPath = "../service-worker.js";
function harness({cached=true,network=async()=>{throw new Error('offline');},installFails=false}={}){
 const source=readFileSync(new URL(workerPath,import.meta.url),'utf8');
 const configured=source.replace('/*__BUILD_ASSETS__*/ []',JSON.stringify(['/assets/app-test.js'])).replace('__BUILD__','test');
 const name=/const CACHE_NAME = '([^']+)'/.exec(configured)[1];
 const prefix=/const CACHE_PREFIX = '([^']+)'/.exec(configured)[1];
 const handlers={},deleted=[],added=[],fetches=[];const entries=new Map();
 if(cached)entries.set(name+'|/index.html',new Response('cached coherent shell'));
 const caches={
   keys:async()=>[prefix+'older',prefix+'previous',name,'unrelated-app-cache'],
   delete:async key=>{deleted.push(key);return true;},
   open:async cacheName=>({
     addAll:async urls=>{added.push(...urls);if(installFails)throw new Error('incomplete download');},
     match:async request=>entries.get(cacheName+'|'+(typeof request==='string'?request:new URL(request.url).pathname))?.clone(),
     put:async(request,response)=>{entries.set(cacheName+'|'+(typeof request==='string'?request:request.url),response);},
   }),
 };
 const self={location:{origin:'https://app.test'},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting(){},clients:{claim:async()=>{}}};
 vm.runInNewContext(configured,{self,caches,URL,Response,AbortController,setTimeout,clearTimeout,fetch:async(...args)=>{fetches.push(args);return network(...args);}});
 const fire=async(type,event)=>{let task;handlers[type]({...event,waitUntil:p=>task=p});return task;};
 return {handlers,deleted,added,fetches,fire};
}
test('cached navigation opens without waiting on a hanging Wi-Fi request and preserves the query URL',async()=>{
 const h=harness({network:()=>new Promise(()=>{})});let response;
 h.handlers.fetch({request:{url:'https://app.test/?focus=record',method:'GET',mode:'navigate'},respondWith:p=>response=p});
 assert.equal(await (await response).text(),'cached coherent shell');assert.equal(h.fetches.length,0);
});
test('cold offline navigation returns a readable retry page instead of undefined/white screen',async()=>{
 const h=harness({cached:false});let response;
 h.handlers.fetch({request:{url:'https://app.test/',method:'GET',mode:'navigate'},respondWith:p=>response=p});
 const r=await response;assert.equal(r.status,503);assert.match(await r.text(),/Yeniden dene/);
});
test('installation includes build assets and rejects incomplete downloads; cleanup never deletes another app cache',async()=>{
 const h=harness();await h.fire('install',{});assert.ok(h.added.includes('/index.html'));assert.ok(h.added.includes('/scripts/vendor/supabase-2.112.3.js'));assert.ok(h.added.includes('/scripts/app.js?v=277.14-compare'));
 await h.fire('activate',{});assert.equal(h.deleted.length,1);assert.ok(!h.deleted.includes('unrelated-app-cache'));assert.ok(!h.deleted.some(k=>k.endsWith('previous')));
 const bad=harness({installFails:true});await assert.rejects(bad.fire('install',{}));
});
test('Supabase/API/POST requests and cross-origin resources are not cached or intercepted',()=>{
 const h=harness();
 for(const request of [
   {url:'https://db.supabase.co/rest/v1/private',method:'GET',mode:'cors',destination:''},
   {url:'https://app.test/api/private',method:'GET',mode:'cors',destination:''},
   {url:'https://app.test/login',method:'POST',mode:'navigate',destination:''},
 ])h.handlers.fetch({request,respondWith:()=>assert.fail('private request intercepted')});
 assert.equal(h.fetches.length,0);
});


