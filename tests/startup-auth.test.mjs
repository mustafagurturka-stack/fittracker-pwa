import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../scripts/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function checkAuthSession() {');
const end=source.indexOf('function setupAuthListener()',start);
async function check(result){
 let shown=0,failed=0,continued=0;const statuses=[];
 const window={startupFailure:()=>failed++};
 vm.runInNewContext('let activeSessionLoad=null;'+source.slice(start,end),{
   window,db:{auth:{getSession:()=>Promise.resolve(result.value)}},
   withTimeout:async()=>result,setStatus:(...s)=>statuses.push(s),updateOnlineStatus(){},showAuth:()=>shown++,
   continueWithSession:async()=>{continued++;},
 });
 await window.retryStartup();return{shown,failed,continued,statuses};
}
test('auth timeout never assumes signed-out status or clears local health data',async()=>{
 const r=await check({timedOut:true,error:new Error('offline')});
 assert.equal(r.shown,0);assert.equal(r.failed,1);assert.equal(r.continued,0);
 assert.ok(r.statuses.some(s=>s[0].includes('silinmedi')));
});
test('verified SDK session opens local records; real null session opens login',async()=>{
 const signedIn=await check({timedOut:false,value:{data:{session:{user:{id:'a'}}}}});
 assert.equal(signedIn.continued,1);assert.equal(signedIn.failed,0);
 const signedOut=await check({timedOut:false,value:{data:{session:null}}});
 assert.equal(signedOut.shown,1);assert.equal(signedOut.continued,0);
});
test('required SDK is local, optional charts and fonts do not block startup',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('/scripts/vendor/supabase-2.112.3.js'));
 assert.ok(!html.includes('https://cdn.jsdelivr.net/npm/@supabase'));
 assert.match(html,/<script[^>]+chart[^>]+async/);
 assert.ok(html.includes('id="startup-shell"'));assert.ok(html.includes('id="startup-retry"'));
 const vendor=readFileSync(new URL('../scripts/vendor/supabase-2.112.3.js',import.meta.url),'utf8');
 assert.ok(vendor.length>100000);assert.ok(!vendor.startsWith('<!doctype'));
});
