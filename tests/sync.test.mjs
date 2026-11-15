// Web ve iPhone PWA'yı ayrı depolamalı iki "cihaz" olarak çalıştırır; ikisi aynı
// sahte Supabase bulutunu paylaşır. Gerçek app.js senkron kodu kullanılır.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8')
  .replace(/\ninit\(\);\s*$/, '\n');
const USER = '7d66b456-888d-4833-8309-f1551ea75d4e';
const UNIQUE = { measurements: ['user_id', 'date'], sleep_logs: ['user_id', 'date'] };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function createCloud() {
  const tables = { measurements: [], sleep_logs: [], workout_logs: [], notes: [], app_profiles: [] };
  const cloud = { tables, loseNextResponse: false, delayReads: 0 };
  const uuid = () => globalThis.crypto.randomUUID();

  cloud.client = () => ({
    from(table) {
      const rows = () => tables[table];
      const filters = [];
      let op = 'select';
      let payload = null;
      let options = {};
      const matches = row => filters.every(([col, val]) => String(row[col]) === String(val));
      const run = async () => {
        if (op === 'select') {
          if (cloud.delayReads) await new Promise(r => setTimeout(r, cloud.delayReads));
          return { data: rows().filter(matches).map(r => ({ ...r })), error: null };
        }
        if (op === 'delete') {
          tables[table] = rows().filter(r => !matches(r));
          return { error: null };
        }
        if (op === 'upsert') {
          const keys = (options.onConflict || 'id').split(',');
          const existing = rows().find(r => keys.every(k => String(r[k]) === String(payload[k])));
          if (existing) Object.assign(existing, payload);
          else rows().push({ id: uuid(), created_at: new Date().toISOString(), ...payload });
          if (cloud.loseNextResponse) {
            cloud.loseNextResponse = false;
            throw new Error('Load failed (yanıt telefona ulaşmadı)');
          }
          return { error: null };
        }
        throw new Error(`desteklenmeyen işlem ${op}`);
      };
      const builder = {
        select() { return builder; },
        eq(col, val) { filters.push([col, val]); return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle: async () => { const r = await run(); return { data: r.data?.[0] || null, error: r.error }; },
        upsert(row, opts = {}) { op = 'upsert'; payload = row; options = opts; return builder; },
        delete() { op = 'delete'; return builder; },
        then(resolve, reject) { return run().then(resolve, reject); },
      };
      return builder;
    },
    auth: { onAuthStateChange() {}, getSession: async () => ({ data: { session: null } }) },
  });
  return cloud;
}

function createDevice(cloud, name) {
  const store = new Map();
  const noop = () => {};
  const element = new Proxy({}, { get: (_, key) => (key === 'classList' ? { add: noop, remove: noop, toggle: noop } : noop) });
  const document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, createElement: () => element,
    documentElement: { setAttribute: noop }, body: { appendChild: noop }, hidden: false,
  };
  const ctx = {
    console: { log: noop, warn: noop, error: noop },
    document, navigator: { onLine: true },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    crypto: globalThis.crypto, setTimeout, clearTimeout, setInterval, clearInterval,
    confirm: () => true, alert: noop, prompt: () => null,
    addEventListener: noop,
    supabase: { createClient: () => cloud.client() },
    Uint8Array, Date, Promise, JSON, Math, Intl, Set, Map,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: `app.js (${name})` });
  vm.runInContext(`
    renderAll = () => {}; setStatus = () => {}; setSyncDot = () => {}; renderSettings = () => {}; updateOnlineStatus = () => {};
    state.userId = '${USER}'; state.onboarded = true; state.startDate = '2026-08-02';
  `, ctx);
  const run = code => vm.runInContext(code, ctx);
  return {
    ctx, run,
    sync: () => run('loadAllCloudData({ force: true })'),
    get state() { return run('state'); },
    setOnline(v) { ctx.navigator.onLine = v; },
  };
}

const measurement = { user_id: USER, date: '2026-11-08', weight: 96.4, waist: null };
const sleep = { user_id: USER, date: '2026-11-10', hours: 7.5 };
const workout = { user_id: USER, date: '2026-11-11', type: 'Yürüyüş', duration: 45, note: 'Kategori: Kardiyo' };

test('bir cihazda silinen kayıt diğer cihazdan geri yüklenmez (ölçüm, uyku, antrenman, not)', async () => {
  const cloud = createCloud();
  const web = createDevice(cloud, 'web');
  const pwa = createDevice(cloud, 'pwa');

  web.run(`saveMeasurementLocally(${JSON.stringify(measurement)});
           saveSleepLocally(${JSON.stringify(sleep)});
           saveWorkoutLocally(${JSON.stringify(workout)});
           saveNoteLocally({ user_id: '${USER}', date: '2026-11-11', text: 'diz ağrısı yok' });`);
  await web.sync();
  await pwa.sync();
  assert.equal(pwa.state.measurements.length, 1);
  assert.equal(pwa.state.sleep.length, 1);
  assert.equal(pwa.state.workouts.length, 1);
  assert.equal(pwa.state.notes.length, 1);

  // PWA'da hepsini sil
  await pwa.run('deleteWeight(0)');
  await pwa.run('deleteSleep(0)');
  await pwa.run('deleteWorkout(0)');
  await pwa.run('deleteNote(0)');
  for (const t of ['measurements', 'sleep_logs', 'workout_logs', 'notes']) assert.equal(cloud.tables[t].length, 0, t);

  // Web hâlâ eski kopyaları tutuyor; senkronda geri yüklememeli
  await web.sync();
  for (const t of ['measurements', 'sleep_logs', 'workout_logs', 'notes']) assert.equal(cloud.tables[t].length, 0, `${t} geri geldi`);
  assert.equal(web.state.measurements.length, 0);
  assert.equal(web.state.sleep.length, 0);
  assert.equal(web.state.workouts.length, 0);
  assert.equal(web.state.notes.length, 0);
  // Kaldırılanlar kurtarma listesinde saklanır
  const discarded = JSON.parse(web.ctx.localStorage.getItem(`ft_state_v3_discarded_${USER}`));
  assert.equal(discarded.length, 4);
});

test('yanıtı kaybolan kayıt tekrar gönderilince kopya oluşmaz', async () => {
  const cloud = createCloud();
  const pwa = createDevice(cloud, 'pwa');
  pwa.run(`saveWorkoutLocally(${JSON.stringify(workout)})`);
  cloud.loseNextResponse = true;
  const first = await pwa.sync();
  assert.equal(first.ok, false);
  assert.equal(cloud.tables.workout_logs.length, 1);
  await pwa.sync();
  await pwa.sync();
  assert.equal(cloud.tables.workout_logs.length, 1);
  assert.equal(pwa.state.workouts.length, 1);
  assert.equal(pwa.run('getPendingSyncCount()'), 0);
});

test('çevrimdışı düzenleme kaybolmaz ve diğer cihaza ulaşır', async () => {
  const cloud = createCloud();
  const web = createDevice(cloud, 'web');
  const pwa = createDevice(cloud, 'pwa');
  pwa.run(`saveWorkoutLocally(${JSON.stringify(workout)})`);
  await pwa.sync();

  pwa.setOnline(false);
  pwa.ctx.prompt = (msg) => (msg.includes('mesafe') ? '' : '60');
  await pwa.run('editWorkout(0)');
  assert.equal(cloud.tables.workout_logs[0].duration, 45);

  pwa.setOnline(true);
  await pwa.sync();
  assert.equal(cloud.tables.workout_logs[0].duration, 60);
  assert.equal(pwa.state.workouts[0].duration, 60);
  await web.sync();
  assert.equal(web.state.workouts[0].duration, 60);
  assert.equal(cloud.tables.workout_logs.length, 1);
});

test('senkron sürerken eklenen kayıt kaybolmaz ve ardından gönderilir', async () => {
  const cloud = createCloud();
  const pwa = createDevice(cloud, 'pwa');
  cloud.delayReads = 30;
  const running = pwa.sync();
  await tick();
  pwa.run(`saveSleepLocally(${JSON.stringify(sleep)}); requestSync();`);
  await running;
  assert.equal(pwa.state.sleep.length, 1, 'yerel kayıt listeden düştü');
  cloud.delayReads = 0;
  await new Promise(r => setTimeout(r, 120));
  assert.equal(cloud.tables.sleep_logs.length, 1);
});

test('aynı gün iki cihazdan girilen ölçüm tek kayıt olur', async () => {
  const cloud = createCloud();
  const web = createDevice(cloud, 'web');
  const pwa = createDevice(cloud, 'pwa');
  web.run(`saveMeasurementLocally(${JSON.stringify(measurement)})`);
  pwa.run(`saveMeasurementLocally(${JSON.stringify({ ...measurement, weight: 96.1 })})`);
  await web.sync();
  await pwa.sync();
  await web.sync();
  assert.equal(cloud.tables.measurements.length, 1);
  assert.equal(cloud.tables.measurements[0].weight, 96.1);
  assert.equal(web.state.measurements[0].weight, 96.1);
});

test('eski sürümden kalan "local-…" kayıt bir kez ve kalıcı kimlikle gönderilir', async () => {
  const cloud = createCloud();
  const web = createDevice(cloud, 'web');
  web.run(`state.workouts = [{ id: 'local-workout-1700000000000', date: '2026-11-12', type: 'Yürüyüş', duration: 30, note: '' }];
           state.syncMeta.pendingWorkouts = ['local-workout-1700000000000'];`);
  await web.sync();
  await web.sync();
  assert.equal(cloud.tables.workout_logs.length, 1);
  assert.match(web.state.workouts[0].id, /^[0-9a-f-]{36}$/);
  assert.equal(web.state.workouts[0].id, cloud.tables.workout_logs[0].id);
});

test('başka cihazda eklenen kayıt gelir, bekleyen yerel değişiklik ezilmez', async () => {
  const cloud = createCloud();
  const web = createDevice(cloud, 'web');
  const pwa = createDevice(cloud, 'pwa');
  web.run(`saveSleepLocally(${JSON.stringify(sleep)})`);
  await web.sync();
  pwa.setOnline(false);
  pwa.run(`saveSleepLocally(${JSON.stringify({ ...sleep, hours: 6 })})`);
  pwa.setOnline(true);
  await pwa.sync();
  assert.equal(cloud.tables.sleep_logs.length, 1);
  assert.equal(cloud.tables.sleep_logs[0].hours, 6);
  await web.sync();
  assert.equal(web.state.sleep[0].hours, 6);
});
