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
  const fmt = value => Number(value).toLocaleString('tr-TR', {maximumFractionDigits:2});
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
    const group = rows => ({
      sessions:rows.length,
      days:new Set(rows.map(row=>row.date)).size,
      minutes:rows.reduce((sum,row)=>sum+(number(row.duration)||0),0),
      timed:rows.filter(row=>number(row.duration)!==null).length
    });
    const isWalk = row => ['yürüyüş','yuruyus','walking','walk'].includes(String(row.type||'').trim().toLocaleLowerCase('tr-TR'));
    const walking = group(workouts.filter(isWalk));
    const training = group(workouts.filter(row=>!isWalk(row)));
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
    return {month,days,endDay,current,walking,training,activeDays,sessions:workouts.length,minutes,timed,daily,
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
  const monthLabel = month => new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
  const dateLabel = date => new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const difference = (current,previous,unit) => {
    const delta=Number((current-previous).toFixed(2));
    return delta===0?'Değişmedi':fmt(Math.abs(delta))+' '+unit+' '+(delta>0?'artış':'azalış');
  };
  function measurementComparison(now,previous,key) {
    const a=now[key].last,b=previous[key].last;
    return {now:a,previous:b,delta:a&&b?Number((a.value-b.value).toFixed(2)):null};
  }
  function activityCard(title,now,previous,currentLabel,previousLabel,note) {
    const value=g=>g.sessions+' kayıt';
    const minutes=g=>g.timed?fmt(g.minutes)+' dk'+(g.timed<g.sessions?' · eksik süre':''):'Süre kaydı yok';
    const comment=!now.sessions&&!previous.sessions?'İki dönemde de kayıt yok; hareket düzeyi hakkında çıkarım yapılmadı.':
      !previous.sessions?'Önceki dönemde kayıt yok. Bu dönemde '+now.sessions+' kayıt girdin; yüzde karşılaştırması yapılmadı.':
      !now.sessions?'Bu dönemde henüz kayıt yok. Önceki dönemde '+previous.sessions+' kayıt vardı; bu, hiç hareket etmediğin anlamına gelmez.':
      now.sessions===previous.sessions?'Kayıt sayısı önceki dönemle aynı.':
      'Önceki döneme göre '+Math.abs(now.sessions-previous.sessions)+' '+(now.sessions>previous.sessions?'daha fazla':'daha az')+' kayıt girdin.';
    const complete=now.sessions&&previous.sessions&&now.timed===now.sessions&&previous.timed===previous.sessions;
    return '<article class="mreport-card"><header><span class="mreport-icon" aria-hidden="true">'+(title==='Yürüyüş'?'↗':'◆')+'</span><div><h3>'+title+'</h3><p>'+note+'</p></div></header>'+
      '<div class="mreport-values"><div><span>'+esc(previousLabel)+'</span><strong>'+value(previous)+'</strong><small>'+minutes(previous)+'</small><small>'+previous.days+' farklı gün</small></div><span class="mreport-arrow" aria-hidden="true">→</span><div><span>'+esc(currentLabel)+'</span><strong>'+value(now)+'</strong><small>'+minutes(now)+'</small><small>'+now.days+' farklı gün</small></div></div>'+
      '<p class="mreport-delta">'+(now.sessions||previous.sessions?difference(now.sessions,previous.sessions,'kayıt'):'Karşılaştırılacak kayıt yok')+'</p>'+
      '<p class="mreport-comment">'+comment+(complete?' Toplam sürede '+difference(now.minutes,previous.minutes,'dk').toLocaleLowerCase('tr-TR')+'.':'')+'</p></article>';
  }
  function measureCard(title,data,unit,currentLabel,previousLabel) {
    const cell=(entry,label)=>'<div><span>'+esc(label)+'</span><strong>'+(entry?fmt(entry.value)+' <em>'+unit+'</em>':'—')+'</strong><small>'+(entry?dateLabel(entry.date):'Ölçüm kaydı yok')+'</small></div>';
    const comment=data.delta===null?'Karşılaştırma için iki dönemde de en az bir '+title.toLocaleLowerCase('tr-TR')+' ölçümü gerekli. Eksik değer sıfır sayılmaz.':
      data.delta===0?'İki dönemin son kayıtlı ölçümleri aynı.':
      'Son kayıtlı '+title.toLocaleLowerCase('tr-TR')+' ölçümün önceki döneme göre '+fmt(Math.abs(data.delta))+' '+unit+' '+(data.delta>0?'artmış':'azalmış')+'.';
    return '<article class="mreport-card"><header><span class="mreport-icon" aria-hidden="true">'+(unit==='kg'?'±':'↔')+'</span><div><h3>'+title+'</h3><p>Her dönemin son kayıtlı ölçümü</p></div></header><div class="mreport-values">'+cell(data.previous,previousLabel)+'<span class="mreport-arrow" aria-hidden="true">→</span>'+cell(data.now,currentLabel)+'</div><p class="mreport-delta">'+(data.delta===null?'Karşılaştırma için ölçüm eksik':difference(data.now.value,data.previous.value,unit))+'</p><p class="mreport-comment">'+comment+'</p></article>';
  }
  function markup(state, month, asOf) {
    const {now:s,previous}=compare(state,month,asOf);
    const currentLabel=monthLabel(month), previousLabel=monthLabel(previous.month);
    // Standard select avoids native month-field sizing bugs in installed iOS PWAs.
    let earliest=shiftMonth(asOf.slice(0,7),-11);
    for(const row of [...(state.workouts||[]),...(state.measurements||[]),...(state.sleep||[])]) {
      if(validDay(row?.date)&&row.date>='2000-01-01'&&row.date.slice(0,7)<earliest)earliest=row.date.slice(0,7);
    }
    if(month<earliest)earliest=month;
    const options=[];
    for(let m=asOf.slice(0,7);m>=earliest;m=shiftMonth(m,-1)) options.push('<option value="'+m+'" '+(m===month?'selected':'')+'>'+esc(monthLabel(m))+'</option>');
    const period=s.current?'1–'+s.endDay+' '+currentLabel+' ile 1–'+previous.endDay+' '+previousLabel:
      currentLabel+' ile '+previousLabel+' · iki tam ay';
    const typeRows=s.types.map(([type,count])=>'<li><span>'+esc(type)+'</span><strong>'+count+' kayıt</strong></li>').join('');
    return '<div class="mreport-heading"><div><span class="mreport-eyebrow">AYLIK KARŞILAŞTIRMA</span><h2>'+esc(currentLabel)+'</h2></div><button type="button" class="mreport-button" data-month-current>Bu ay</button></div>'+
      '<label class="mreport-label" for="statisticsMonth">İstatistik ayı</label><div class="mreport-picker"><button type="button" class="mreport-button" data-month-step="-1" aria-label="Önceki ay" '+(month<='2000-01'?'disabled':'')+'>‹</button><select id="statisticsMonth" data-stat-month="true" aria-label="İstatistik ayı">'+options.join('')+'</select><button type="button" class="mreport-button" data-month-step="1" aria-label="Sonraki ay" '+(month>=asOf.slice(0,7)?'disabled':'')+'>›</button></div>'+
      '<div class="mreport-period"><strong>'+(s.current?'Ay devam ediyor · eşit gün aralığı':'Tam ay karşılaştırması')+'</strong><p>'+esc(period)+'</p><p>Etkinlik sayıları kayıtlarını, ölçümler ise belirtilen tarihteki son değerleri gösterir.</p></div>'+
      '<div class="mreport-grid">'+activityCard('Antrenman',s.training,previous.training,currentLabel,previousLabel,'Yürüyüş hariç tüm antrenman kayıtları')+
      activityCard('Yürüyüş',s.walking,previous.walking,currentLabel,previousLabel,'Yalnızca yürüyüş olarak kaydedilen etkinlikler')+
      measureCard('Kilo',measurementComparison(s,previous,'weight'),'kg',currentLabel,previousLabel)+measureCard('Bel',measurementComparison(s,previous,'waist'),'cm',currentLabel,previousLabel)+'</div>'+
      '<details class="mreport-details"><summary>Diğer aylık kayıtlar</summary><div><p>'+s.activeDays+' aktif gün · '+s.sessions+' toplam etkinlik kaydı</p><p>'+(s.timed?fmt(s.minutes)+' dk · '+s.timed+' süreli kayıt':'Süre kaydı yok')+'</p><p>Ortalama uyku: '+(s.sleepAverage===null?'—':fmt(s.sleepAverage)+' saat')+' · '+s.sleepDays+' kayıtlı gün</p>'+(typeRows?'<ul aria-label="Antrenman türleri">'+typeRows+'</ul>':'<p>Bu ay henüz kayıt yok.</p>')+'</div></details>'+
      '<p class="mreport-footnote">Yorumlar yalnızca girilmiş kayıtları karşılaştırır; eksik kayıtlar hareketsizlik olarak değerlendirilmez. Kilo ve bel değişimi tek başına bir sağlık değerlendirmesi değildir. Eşitlenmemiş kayıtlar cihazlar arasında geçici olarak farklı görünebilir.</p>';
  }
  root.FitMonthly={summary,compare,shiftMonth,markup,measurementComparison};
})(typeof window!=='undefined'?window:globalThis);


