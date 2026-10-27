/* Read-only monthly statistics. No storage, network or account mutations. */
(function (root) {
  'use strict';
  const validDay = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const number = value => value === null || value === '' || value === undefined ? null :
    Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => Number(value).toLocaleString('tr-TR', {maximumFractionDigits:1});
  function shiftMonth(month, step) {
    const [y,m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(y,m-1+step,1));
    return date.toISOString().slice(0,7);
  }
  function summary(state, month, asOf) {
    if (!validDay(asOf) || !validDay(month+'-01')) throw new Error('Geçersiz tarih');
    const [y,m] = month.split('-').map(Number);
    const days = new Date(Date.UTC(y,m,0)).getUTCDate();
    const current = month === asOf.slice(0,7);
    const endDay = current ? Number(asOf.slice(8)) : days;
    const end = month+'-'+String(endDay).padStart(2,'0');
    const inRange = row => validDay(row?.date) && row.date.startsWith(month+'-') && row.date <= end && row.date <= asOf;
    // IDs represent sessions; identical types on a day may be distinct workouts.
    const seen = new Set();
    const workouts = (state.workouts || []).filter(inRange).filter(row => {
      if (row.id && seen.has(row.id)) return false;
      if (row.id) seen.add(row.id);
      return true;
    });
    const activeDays = new Set(workouts.map(row=>row.date)).size;
    const types = new Map();
    const daily = Array.from({length:days},(_,i)=>({day:i+1,count:0,minutes:0}));
    let minutes=0, timed=0;
    workouts.forEach(row=>{
      const duration=number(row.duration);
      if(duration!==null){minutes+=duration;timed++;}
      const type=String(row.type || 'Diğer');
      types.set(type,(types.get(type)||0)+1);
      const bucket=daily[Number(row.date.slice(8))-1];
      bucket.count++;bucket.minutes+=duration||0;
    });
    const measurementRows=(state.measurements||[]).filter(inRange).sort((a,b)=>a.date.localeCompare(b.date));
    function measure(key) {
      // Last stored value per calendar day; missing values never become zero.
      const byDate=new Map();
      measurementRows.forEach(row=>{const v=number(row[key]);if(v!==null)byDate.set(row.date,v);});
      const entries=[...byDate].sort((a,b)=>a[0].localeCompare(b[0]));
      const first=entries[0], last=entries.at(-1);
      return {count:entries.length, first:first?{date:first[0],value:first[1]}:null,
        last:last?{date:last[0],value:last[1]}:null,
        change:entries.length>=2?Number((last[1]-first[1]).toFixed(2)):null};
    }
    const sleepByDate=new Map();
    (state.sleep||[]).filter(inRange).forEach(row=>{const hours=number(row.hours);if(hours!==null)sleepByDate.set(row.date,hours);});
    const sleep=[...sleepByDate.values()];
    return {month,days,endDay,current,activeDays,sessions:workouts.length,minutes,timed,daily,
      types:[...types].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'tr')),
      weight:measure('weight'),waist:measure('waist'),
      sleepDays:sleep.length,sleepAverage:sleep.length?sleep.reduce((a,b)=>a+b,0)/sleep.length:null};
  }
  function compare(state, month, asOf) {
    const now=summary(state,month,asOf), prevMonth=shiftMonth(month,-1);
    let cutoff=asOf;
    if(now.current){
      const [y,m]=prevMonth.split('-').map(Number);
      cutoff=prevMonth+'-'+String(Math.min(now.endDay,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0');
    }
    const previous=summary(state,prevMonth,cutoff);
    return {now,previous,delta:now.activeDays-previous.activeDays};
  }
  function markup(state, month, asOf) {
    const {now:s,previous,delta}=compare(state,month,asOf);
    const label=new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
    const card=(title,value,note)=>'<article class="monthly-stat"><span>'+title+'</span><strong>'+value+'</strong><small>'+note+'</small></article>';
    const change=(entry,unit)=>entry.change===null?'En az iki farklı günde ölçüm gerekli':
      (entry.change>0?'+':'')+fmt(entry.change)+' '+unit+' · '+esc(entry.first.date.slice(8))+ '–'+esc(entry.last.date.slice(8))+'. gün';
    const max=Math.max(1,...s.types.map(row=>row[1]));
    const rows=s.types.map(([name,count])=>'<div class="monthly-type"><div><span>'+esc(name)+'</span><strong>'+count+'</strong></div><div class="monthly-track"><span style="width:'+Math.round(count/max*100)+'%"></span></div></div>').join('');
    return '<div class="monthly-heading"><div><span class="monthly-eyebrow">AYLIK İSTATİSTİKLER</span><h2>'+esc(label)+'</h2></div><button type="button" class="monthly-button" data-month-current>Bu ay</button></div>'+
      '<div class="monthly-picker"><button type="button" class="monthly-button" data-month-step="-1" aria-label="Önceki ay">‹</button><label>Ay seç<input type="month" aria-label="İstatistik ayı" value="'+month+'" max="'+asOf.slice(0,7)+'"></label><button type="button" class="monthly-button" data-month-step="1" aria-label="Sonraki ay" '+(month>=asOf.slice(0,7)?'disabled':'')+'>›</button></div>'+
      '<p class="monthly-hint">'+(s.current?'Ay devam ediyor · 1–'+s.endDay+'. gün':'Ayın tamamı')+' · Yalnızca kaydettiğiniz veriler kullanılır.</p>'+
      '<div class="monthly-stats">'+card('Aktif gün',s.activeDays,'Antrenman kaydı olan farklı gün')+card('Antrenman',s.sessions,'Aynı gündeki ayrı seanslar dahil')+card('Toplam süre',s.timed?fmt(s.minutes)+' dk':'—',s.timed?s.timed+' süreli kayıt':'Süre kaydı yok')+
      card('Ortalama uyku',s.sleepAverage===null?'—':fmt(s.sleepAverage)+' sa',s.sleepDays+' günün uyku kaydı')+'</div>'+
      '<div class="monthly-columns"><section class="monthly-box"><h3>Ayın hareket ritmi</h3><div class="monthly-days" aria-label="Günlük antrenman sayıları">'+s.daily.map(d=>'<span class="monthly-day '+(d.count?'has-activity':'')+(d.day>s.endDay?' future':'')+'" aria-label="'+d.day+'. gün: '+d.count+' antrenman" title="'+d.day+'. gün · '+d.count+' antrenman · '+fmt(d.minutes)+' dk">'+d.day+(d.count?'<b>'+d.count+'</b>':'')+'</span>').join('')+'</div><p class="monthly-hint">Mavi günlerde antrenman kaydı var. Diğer günler başarısızlık anlamına gelmez.</p></section>'+
      '<section class="monthly-box"><h3>Antrenman dağılımı</h3>'+(rows||'<p class="monthly-hint">Bu ay henüz antrenman kaydı yok.</p>')+'</section></div>'+
      '<div class="monthly-columns"><section class="monthly-box"><h3>Ölçüm özeti</h3><p>Kilo: <strong>'+(s.weight.last?fmt(s.weight.last.value)+' kg':'—')+'</strong></p><p class="monthly-hint">'+change(s.weight,'kg')+'</p><p>Bel: <strong>'+(s.waist.last?fmt(s.waist.last.value)+' cm':'—')+'</strong></p><p class="monthly-hint">'+change(s.waist,'cm')+'</p><p class="monthly-hint">Değişim, bu ayın ilk ve son kayıtlı ölçümü arasındadır.</p></section>'+
      '<section class="monthly-box"><h3>Önceki ayla karşılaştırma</h3><p>'+(s.sessions&&previous.sessions?'<strong>'+(delta>0?delta+' gün daha fazla':delta<0?Math.abs(delta)+' gün daha az':'Aynı sayıda gün')+'</strong> antrenman kaydı var.':'Karşılaştırma için iki dönemde de antrenman kaydı gerekli.')+'</p><p class="monthly-hint">'+(s.current?'Her iki ayın ilk '+s.endDay+' günü (kısa ayın sonuna kadar) karşılaştırılır.':'İki tam ay karşılaştırılır.')+' Kayıt olmayan günler değerlendirilmez.</p></section></div>'+
      (!s.sessions&&!s.sleepDays&&!s.weight.count&&!s.waist.count?'<p class="monthly-empty">Bu ay henüz kayıt yok. Günlük kayıtlarını ekledikçe özetin burada oluşacak.</p>':'')+
      '<p class="monthly-hint">Cihazdaki mevcut kayıtlar gösterilir. Çevrimdışı değişiklikler eşitlenince diğer cihazda da görünür.</p>';
  }
  root.FitMonthly={summary,compare,shiftMonth,markup};
})(typeof window!=='undefined'?window:globalThis);

