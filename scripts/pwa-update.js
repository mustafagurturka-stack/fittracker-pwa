/* An update is offered, never forced: drafts and persisted queues stay untouched. */
(function(root) {
  'use strict';
  let started=false;
  function start() {
    if(started || !('serviceWorker' in navigator)) return;
    started=true;
    const wasControlled=Boolean(navigator.serviceWorker.controller);
    function offerUpdate() {
      if(!wasControlled || document.getElementById('pwa-update-notice')) return;
      const notice=document.createElement('aside');
      notice.id='pwa-update-notice';notice.setAttribute('role','status');
      const text=document.createElement('p');
      text.textContent='Yeni sürüm hazır. Açık formlarını kaydettikten sonra yenileyebilirsin.';
      const button=document.createElement('button');
      button.type='button';button.textContent='Yeni sürümü aç';
      button.onclick=()=>{
        if(root.confirm('Kaydetmediğin form bilgileri yenilenince kapanır. Devam edilsin mi?')) root.location.reload();
      };
      notice.append(text,button);
      const status=document.getElementById('statusBar');
      if(status) status.insertAdjacentElement('afterend',notice);
      else document.body.prepend(notice);
    }
    navigator.serviceWorker.addEventListener('controllerchange',offerUpdate);
    // Do not wait for window.load: optional fonts/chart/network must not delay installation.
    navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'}).then(reg=>{
      let lastCheck=Date.now();
      function check() {
        if(document.hidden || !navigator.onLine || Date.now()-lastCheck<30000) return;
        lastCheck=Date.now();reg.update().catch(()=>{});
      }
      document.addEventListener('visibilitychange',check);
      root.addEventListener('online',check);
    }).catch(()=>{ /* Ordinary web use remains available without a service worker. */ });
  }
  root.FitPwaUpdates={start};
})(window);

