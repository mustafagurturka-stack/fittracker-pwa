import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('scripts/pwa-update.js');
function harness(controlled=true){
 const listeners={},domListeners={},nodes=[];let registered=0,reloads=0,confirmed=false,updates=0,clock=0;
 const element=tag=>({tag,children:[],setAttribute(){},append(...children){this.children.push(...children);}});
 const document={hidden:false,body:{prepend:node=>nodes.push(node)},getElementById:id=>nodes.find(node=>node.id===id)||null,
  createElement:element,addEventListener:(name,fn)=>domListeners[name]=fn};
 const navigator={onLine:true,serviceWorker:{controller:controlled?{}:null,addEventListener:(name,fn)=>listeners[name]=fn,
  register:(path,options)=>{registered++;assert.equal(path,'/service-worker.js');assert.equal(options.updateViaCache,'none');return Promise.resolve({update:()=>{updates++;return Promise.resolve();}});}}};
 const window={confirm:()=>confirmed,location:{reload:()=>reloads++},addEventListener:(name,fn)=>listeners['window:'+name]=fn};
 vm.runInNewContext(source,{window,document,navigator,Date:{now:()=>clock}});
 return{window,document,navigator,listeners,domListeners,nodes,registered:()=>registered,reloads:()=>reloads,updates:()=>updates,setConfirm:value=>confirmed=value,setClock:value=>clock=value};
}
test('worker registration starts without waiting for load and remains idempotent',async()=>{
 const h=harness();h.window.FitPwaUpdates.start();h.window.FitPwaUpdates.start();
 assert.equal(h.registered(),1);assert.equal(h.listeners['window:load'],undefined);
 await Promise.resolve();assert.equal(typeof h.domListeners.visibilitychange,'function');
});
test('new worker offers a non-overlapping notice and never reloads a draft automatically',()=>{
 const h=harness();h.window.FitPwaUpdates.start();h.listeners.controllerchange();h.listeners.controllerchange();
 assert.equal(h.nodes.length,1);assert.equal(h.reloads(),0);
 const button=h.nodes[0].children[1];button.onclick();assert.equal(h.reloads(),0);
 h.setConfirm(true);button.onclick();assert.equal(h.reloads(),1);
});
test('initial installation does not misleadingly offer an update',()=>{
 const h=harness(false);h.window.FitPwaUpdates.start();h.listeners.controllerchange();
 assert.equal(h.nodes.length,0);assert.equal(h.reloads(),0);
});
test('foreground update checks are throttled and skipped while offline',async()=>{
 const h=harness();h.window.FitPwaUpdates.start();await Promise.resolve();
 h.setClock(31000);h.domListeners.visibilitychange();assert.equal(h.updates(),1);
 h.domListeners.visibilitychange();assert.equal(h.updates(),1);
 h.setClock(62000);h.navigator.onLine=false;h.domListeners.visibilitychange();assert.equal(h.updates(),1);
});
test('entry resources and Turkish fonts are same-origin, versioned and precached',()=>{
 const html=read('index.html'),css=read('styles/local-fonts.css'),sw=read('service-worker.js');
 assert.ok(!html.includes('fonts.googleapis.com'));assert.ok(!html.includes('cdn.jsdelivr.net'));
 assert.ok(html.includes('/scripts/vendor/chart-4.5.1.umd.min.js'));
 assert.ok(html.includes('/scripts/pwa-update.js?v=20261028.2'));
 assert.ok(html.includes('/styles/local-fonts.css?v=5.3.0'));
 for(const match of css.matchAll(/url\(\.\/(fonts\/[^)]+)\)/g)){
  assert.ok(sw.includes('/styles/'+match[1]));const bytes=readFileSync(new URL('../styles/'+match[1],import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'wOF2');
 }
 assert.ok(css.includes('latin-ext'));assert.equal((css.match(/font-display: swap/g)||[]).length,6);
 assert.ok(sw.includes('/scripts/vendor/chart-4.5.1.umd.min.js'));assert.ok(sw.includes('/scripts/pwa-update.js?v=20261028.2'));
 const chart=read('scripts/vendor/chart-4.5.1.umd.min.js');const ctx={};vm.runInNewContext(chart,ctx);assert.equal(ctx.Chart.version,'4.5.1');
});
test('month selector and navigation occupy separate rows, with no native month input',()=>{
 const css=read('styles/main.css'),monthly=read('scripts/monthly.js');
 assert.ok(monthly.includes('mreport-month-nav'));assert.ok(!monthly.includes('type="month"'));
 assert.match(css,/#monthlyOverview \.mreport-picker\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/#monthlyOverview \.mreport-month-nav\{[^}]*repeat\(2,minmax\(0,1fr\)\)/);
});

