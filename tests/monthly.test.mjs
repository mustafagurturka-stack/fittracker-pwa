import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/monthly.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source,context);
const {summary,compare,shiftMonth,markup}=context.FitMonthly;
const workout=(date,duration=30,type='Kuvvet',id)=>({date,duration,type,id});

test('counts sessions, distinct active days and valid minutes within selected month only',()=>{
 const s=summary({workouts:[workout('2026-10-01'),workout('2026-10-01',20),workout('2026-10-02',null),workout('2026-09-30'),workout('2026-10-28'),workout('2026-10-99')]},'2026-10','2026-10-27');
 assert.equal(s.sessions,3);assert.equal(s.activeDays,2);assert.equal(s.minutes,50);assert.equal(s.timed,2);assert.equal(s.daily.length,31);
});
test('ID duplication is removed without conflating separate same-day same-type sessions',()=>{
 const s=summary({workouts:[workout('2026-10-01',30,'A','one'),workout('2026-10-01',30,'A','one'),workout('2026-10-01',30,'A','two')]},'2026-10','2026-10-27');
 assert.equal(s.sessions,2);assert.equal(s.types[0][1],2);
});
test('month boundaries, leap years and December rollover are correct',()=>{
 assert.equal(shiftMonth('2026-01',-1),'2025-12');assert.equal(shiftMonth('2026-12',1),'2027-01');
 assert.equal(summary({},'2024-02','2026-10-27').days,29);
 assert.equal(summary({},'2025-02','2026-10-27').days,28);
 assert.throws(()=>summary({},'2026-13','2026-10-27'));
});
test('current month comparison uses equal elapsed date ranges and omits future plans',()=>{
 const data={workouts:[workout('2026-10-01'),workout('2026-10-27'),workout('2026-09-01'),workout('2026-09-28')]};
 const c=compare(data,'2026-10','2026-10-27');
 assert.equal(c.previous.sessions,1);assert.equal(c.now.sessions,2);assert.equal(c.delta,1);
 const short=compare({},'2026-03','2026-03-31');assert.equal(short.previous.endDay,28);
});
test('past months compare complete months instead of today day-of-month',()=>{
 const c=compare({workouts:[workout('2026-08-31'),workout('2026-09-30')]},'2026-09','2026-10-05');
 assert.equal(c.now.sessions,1);assert.equal(c.previous.sessions,1);assert.equal(c.previous.endDay,31);
});
test('measurements are sorted, missing and zero values ignored; change requires two different days',()=>{
 const s=summary({measurements:[{date:'2026-10-20',weight:98,waist:null},{date:'2026-10-01',weight:100,waist:105},{date:'2026-10-15',weight:null,waist:0}]},'2026-10','2026-10-27');
 assert.equal(s.weight.change,-2);assert.equal(s.waist.change,null);assert.equal(s.waist.last.value,105);
 assert.equal(summary({measurements:[{date:'2026-10-01',weight:100},{date:'2026-10-01',weight:99}]},'2026-10','2026-10-27').weight.change,null);
});
test('sleep average divides by recorded days, never by every day of month',()=>{
 const s=summary({sleep:[{date:'2026-10-01',hours:8},{date:'2026-10-03',hours:6},{date:'2026-10-04',hours:null}]},'2026-10','2026-10-27');
 assert.equal(s.sleepAverage,7);assert.equal(s.sleepDays,2);
 assert.equal(summary({},'2026-10','2026-10-27').sleepAverage,null);
});
test('empty month has honest placeholders, not fabricated measurements or failure scores',()=>{
 const html=markup({},'2026-10','2026-10-27');
 assert.ok(html.includes('henüz kayıt yok'));assert.ok(html.includes('iki dönemde de en az bir'));
 assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'));assert.ok(!html.includes('0 kg'));
});
test('record labels are escaped and source state remains unchanged',()=>{
 const state={workouts:[workout('2026-10-02',30,'<img src=x onerror=alert(1)>')],measurements:[{date:'2026-10-02',weight:90}]};
 const before=JSON.stringify(state);
 const html=markup(state,'2026-10','2026-10-27');
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
 assert.equal(JSON.stringify(state),before);
});
test('monthly asset loads before app and is precached with versioned release assets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
 assert.ok(html.indexOf('/scripts/monthly.js')<html.indexOf('/scripts/app.js'));
 for(const path of ['/scripts/monthly.js?v=20261028.2','/scripts/app.js?v=277.15-safari','/styles/main.css?v=178.2-safari']){assert.ok(html.includes(path));assert.ok(sw.includes(path));}
 assert.ok(html.includes('id="monthlyOverview"'));assert.ok(html.includes('Haftalık detayları göster'));
 assert.ok(!source.includes('localStorage'));assert.ok(!source.includes('fetch('));
});
test('month navigation and rendering integration refresh after data changes without writing records',()=>{
 const app=readFileSync(new URL('../scripts/app.js',import.meta.url),'utf8');
 const fragment=app.slice(app.indexOf('let selectedStatisticsMonth'),app.indexOf('function renderAll()'));
 const host={innerHTML:''},weekly={open:false};let chartCalls=0;
 const ctx=vm.createContext({window:{FitMonthly:context.FitMonthly},document:{getElementById:()=>host,querySelector:()=>weekly},state:{workouts:[]},today:()=>'2026-10-27',requestAnimationFrame:fn=>fn(),renderMeasurementChart:()=>chartCalls++,renderProgressCharts:()=>chartCalls++});
 vm.runInContext(fragment,ctx);ctx.renderMonthlyOverview();
 assert.ok(host.innerHTML.includes('Ekim 2026'));
 host.onclick({target:{closest:()=>({disabled:false,hasAttribute:key=>key==='data-month-step',dataset:{monthStep:'-1'}})}});
 assert.ok(host.innerHTML.includes('Eylül 2026'));
 weekly.open=true;weekly.ontoggle();assert.equal(chartCalls,2);
 host.onchange({target:{dataset:{statMonth:'true'},value:'2026-10'}});
 ctx.state.workouts.push(workout('2026-10-02'));ctx.renderMonthlyOverview();
 assert.ok(host.innerHTML.includes('1 süreli kayıt'));
 host.onchange({target:{dataset:{statMonth:'true'},value:'2026-11'}});assert.ok(host.innerHTML.includes('Ekim 2026'));
});


test('walking is separated from other workouts without counting it twice',()=>{
 const s=summary({workouts:[workout('2026-10-01',30,'Yürüyüş'),workout('2026-10-02',20,'  YÜRÜYÜŞ  '),workout('2026-10-01',40,'Kuvvet'),workout('2026-10-03',50,'Halı saha maçı')]},'2026-10','2026-10-28');
 assert.equal(s.walking.sessions,2);assert.equal(s.walking.minutes,50);assert.equal(s.walking.days,2);
 assert.equal(s.training.sessions,2);assert.equal(s.training.minutes,90);
 assert.equal(s.sessions,s.walking.sessions+s.training.sessions);
});
test('measurement comparisons use last values across two periods, not within selected month',()=>{
 const data={measurements:[{date:'2026-09-03',weight:104,waist:110},{date:'2026-09-25',weight:102,waist:108},{date:'2026-09-30',weight:101,waist:107},{date:'2026-10-02',weight:101,waist:106},{date:'2026-10-24',weight:100,waist:105}]};
 const c=compare(data,'2026-10','2026-10-28');
 const weight=context.FitMonthly.measurementComparison(c.now,c.previous,'weight');
 const waist=context.FitMonthly.measurementComparison(c.now,c.previous,'waist');
 assert.equal(weight.delta,-2);assert.equal(weight.previous.date,'2026-09-25');assert.equal(weight.now.date,'2026-10-24');assert.equal(waist.delta,-3);
 const html=markup(data,'2026-10','2026-10-28');
 assert.ok(html.includes('2 kg azalış'));assert.ok(html.includes('3 cm azalış'));assert.ok(html.includes('25 Eyl'));assert.ok(html.includes('24 Eki'));
});
test('one measurement in each month is enough and missing previous measurement is not zero',()=>{
 const c=compare({measurements:[{date:'2026-09-12',weight:100},{date:'2026-10-11',weight:101,waist:98}]},'2026-10','2026-10-28');
 assert.equal(context.FitMonthly.measurementComparison(c.now,c.previous,'weight').delta,1);
 assert.equal(context.FitMonthly.measurementComparison(c.now,c.previous,'waist').delta,null);
});
test('no previous activity records never produces infinite percentage or asserts inactivity',()=>{
 const html=markup({workouts:[workout('2026-10-02',30,'Yürüyüş')]},'2026-10','2026-10-28');
 assert.ok(html.includes('yüzde karşılaştırması yapılmadı'));assert.ok(!html.includes('Infinity'));
 assert.ok(html.includes('iki dönemde de en az bir'));assert.ok(!html.includes('monthly-days'));
 assert.ok(!html.includes('type="month"'));assert.ok(html.includes('data-stat-month="true"'));
});
test('year boundary and early-month cutoffs apply to both walking and measurements',()=>{
 const c=compare({workouts:[workout('2025-12-01',40,'Yürüyüş'),workout('2025-12-02',40,'Yürüyüş'),workout('2026-01-01',20,'Yürüyüş')],measurements:[{date:'2025-12-02',weight:95},{date:'2026-01-01',weight:94}]},'2026-01','2026-01-01');
 assert.equal(c.previous.month,'2025-12');assert.equal(c.previous.walking.sessions,1);assert.equal(c.now.walking.sessions,1);
 assert.equal(context.FitMonthly.measurementComparison(c.now,c.previous,'weight').delta,null);
});

