'use strict';

// Ã¢â€â‚¬Ã¢â€â‚¬ SUPABASE Ã¢â€â‚¬Ã¢â€â‚¬
const SUPABASE_URL = 'https://wqbnghfduryuwcjrffyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8ZycJCD6a6qdgYbfPqh6Sg_FaYY_XMb';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'fittracker-pro-auth',
  },
});

console.log('Supabase hazÄ±r:', db);

// Ã¢â€â‚¬Ã¢â€â‚¬ CONSTANTS Ã¢â€â‚¬Ã¢â€â‚¬
const PANELS = ['pHome', 'pWeight', 'pDaily', 'pProgress', 'pSettings'];
const BN_IDS = ['bn0', 'bn1', 'bn2', 'bn3', 'bn4'];
const STORAGE_KEY = 'ft_state_v2';
const START_DATE = '2026-05-31';
const WEEKLY_MEASURE_DAY = 0;
const SLEEP_TARGET = 49;
const WORKOUT_TARGET = 180;
const VERIFIED_WEEK_TOTALS = {
  '2026-05-31': { sleep: 53.5, workouts: 265, sleepNights: 7 },
  '2026-06-07': { sleep: 55, workouts: 202.5, sleepNights: 7 },
};

const WORKOUT_CATALOG = {
  Kuvvet: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D', 'Core'],
  Kardiyo: ['Y\u00fcr\u00fcy\u00fc\u015f', 'Bisiklet', 'GrowwithJo', 'Di\u011fer Kardiyo'],
};
const LEGACY_WORKOUT_CATEGORY_MAP = {
  'Core Temel': 'Kuvvet',
  'Core / Tabata': 'Kuvvet',
  'Kar\u0131n B\u00f6lgesi': 'Kuvvet',
  'Bel ve Stabilizasyon': 'Kuvvet',
  'Plank Serisi': 'Kuvvet',
  'Squat Odakl\u0131': 'Kuvvet',
  'Deadlift Odakl\u0131': 'Kuvvet',
  '\u00dcst V\u00fccut': 'Kuvvet',
  'Alt V\u00fccut': 'Kuvvet',
  'Sabah Ya\u011f Yak\u0131m': 'Kardiyo',
  'GrowWithJo': 'Kardiyo',
  'GrowWithJo Challenge': 'Kardiyo',
  'GrowwithJo': 'Kardiyo',
  'Squat Challenge': 'Kardiyo',
  'Deadlift Challenge': 'Kardiyo',
  'Core Challenge': 'Kardiyo',
  'HIIT Challenge': 'Kardiyo',
  '30 G\u00fcn Challenge': 'Kardiyo',
  'Ko\u015fu': 'Kardiyo',
  'Eliptik': 'Kardiyo',
  'HIIT': 'Kardiyo',
  'Zone 2 Kardiyo': 'Kardiyo',
  'Esneme': 'Kardiyo',
  'Mobility': 'Kardiyo',
  'Yoga': 'Kardiyo',
  'Foam Rolling': 'Kardiyo',
  'Aktif Dinlenme': 'Kardiyo',
};

const MOTIVATIONS = [
  'BugÃ¼n kÃ¼Ã§Ã¼k bir adÄ±m at, yarÄ±n farkÄ± hissedeceksin.',
  'MÃ¼kemmel olmak zorunda deÄŸilsin; devam etmek yeterli.',
  'Her kayÄ±t, hedefe biraz daha yaklaÅŸtÄ±ÄŸÄ±nÄ±n kanÄ±tÄ±.',
  'BugÃ¼n kendine yatÄ±rÄ±m yaptÄ±ÄŸÄ±n bir gÃ¼n olsun.',
  'Disiplin, motivasyonun azaldÄ±ÄŸÄ± gÃ¼nlerde seni taÅŸÄ±r.',
  'Uyku, hareket ve istikrar: deÄŸiÅŸimin Ã¼Ã§ anahtarÄ±.',
  'VÃ¼cudun emeÄŸini hatÄ±rlar; bugÃ¼n boÅŸa gitmez.',
  'KÃ¼Ã§Ã¼k kazanÄ±mlar bÃ¼yÃ¼k dÃ¶nÃ¼ÅŸÃ¼mlerin temelidir.',
  'BugÃ¼n devam edersen, yarÄ±n daha gÃ¼Ã§lÃ¼ baÅŸlarsÄ±n.',
  'Hedef uzak gÃ¶rÃ¼nse de sÄ±radaki adÄ±m Ã§ok yakÄ±n.',
];

// Ã¢â€â‚¬Ã¢â€â‚¬ STATE Ã¢â€â‚¬Ã¢â€â‚¬
let state = {
  theme: 'light',
  userId: '',
  userEmail: '',
  onboarded: false,
  name: '',
  startDate: START_DATE,
  startWeight: null,
  startWaist: null,
  measurements: [],
  weights: [],
  nutrition: [],
  workouts: [],
  notes: [],
  sleep: [],
  deletedRecords: {
    measurements: [],
    sleep: [],
    workouts: [],
    notes: [],
  },
  goalWeight: 85,
  milestones: [95, 85],
  preferences: {
    measureReminder: true,
    dailyReminder: false,
  },
  syncMeta: {
    lastSuccess: '',
    lastAttempt: '',
    lastError: '',
    pendingMeasurements: [],
    pendingSleep: [],
    pendingProfile: false,
  },
};

let measurementChart = null;
let sleepChart = null;
let workoutChart = null;
let authMode = 'signIn';
let dailyView = 'week';

function withTimeout(promise, ms = 10000, label = 'Ä°ÅŸlem') {
  let timer;
  const timeout = new Promise(resolve => {
    timer = window.setTimeout(() => {
      resolve({ timedOut: true, error: new Error(`${label} zaman aÅŸÄ±mÄ±na uÄŸradÄ±`) });
    }, ms);
  });

  return Promise.race([
    Promise.resolve(promise).then(value => ({ timedOut: false, value })).catch(error => ({ timedOut: false, error })),
    timeout,
  ]).finally(() => window.clearTimeout(timer));
}
let activeSessionLoad = null;
let cloudSyncInProgress = false;

function ensureSyncMeta() {
  if (!state.syncMeta || typeof state.syncMeta !== 'object') state.syncMeta = {};
  state.syncMeta = {
    lastSuccess: state.syncMeta.lastSuccess || '',
    lastAttempt: state.syncMeta.lastAttempt || '',
    lastError: state.syncMeta.lastError || '',
    pendingMeasurements: Array.isArray(state.syncMeta.pendingMeasurements) ? state.syncMeta.pendingMeasurements : [],
    pendingSleep: Array.isArray(state.syncMeta.pendingSleep) ? state.syncMeta.pendingSleep : [],
    pendingProfile: Boolean(state.syncMeta.pendingProfile),
  };
  return state.syncMeta;
}

function markPendingSync(type, key) {
  if (!key) return;
  const syncMeta = ensureSyncMeta();
  const bucket = type === 'measurements' ? syncMeta.pendingMeasurements : syncMeta.pendingSleep;
  if (!bucket.includes(key)) bucket.push(key);
}

function clearPendingSync(type, key) {
  const syncMeta = ensureSyncMeta();
  const bucketName = type === 'measurements' ? 'pendingMeasurements' : 'pendingSleep';
  syncMeta[bucketName] = syncMeta[bucketName].filter(item => item !== key);
}

function getPendingSyncCount() {
  const syncMeta = ensureSyncMeta();
  const localWorkouts = (state.workouts || []).filter(item => String(item?.id || '').startsWith('local-workout-')).length;
  const localNotes = (state.notes || []).filter(item => String(item?.id || '').startsWith('local-note-')).length;
  const deletionBuckets = Object.values(state.deletedRecords || {})
    .reduce((total, bucket) => total + (Array.isArray(bucket) && bucket.length ? 1 : 0), 0);

  return syncMeta.pendingMeasurements.length + syncMeta.pendingSleep.length + Number(syncMeta.pendingProfile) + localWorkouts + localNotes + deletionBuckets;
}

function formatSyncTimestamp(value) {
  if (!value) return 'HenÃ¼z yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'HenÃ¼z yok';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getSyncErrorMessage(error) {
  return String(error?.message || error?.details || error || 'Bilinmeyen senkron hatasÄ±');
}

async function runSyncStage(label, task) {
  try {
    return await task();
  } catch (error) {
    throw new Error(`${label}: ${getSyncErrorMessage(error)}`);
  }
}

function recordSyncSuccess(type = '', key = '') {
  const syncMeta = ensureSyncMeta();
  if (type && key) clearPendingSync(type, key);
  syncMeta.lastSuccess = new Date().toISOString();
  syncMeta.lastError = '';
  stateSave();
  setSyncDot('ok');
  renderSettings();
}

function recordSyncError(error) {
  const syncMeta = ensureSyncMeta();
  syncMeta.lastError = getSyncErrorMessage(error);
  stateSave();
  setSyncDot('err');
  renderSettings();
}
// Ã¢â€â‚¬Ã¢â€â‚¬ HELPERS Ã¢â€â‚¬Ã¢â€â‚¬
function today() {
  return new Date().toISOString().slice(0, 10);
}

function getSuggestedMeasureDate() {
  const latest = getSortedMeasurements().at(-1);

  if (latest?.date) {
    const parts = parseIsoDateParts(latest.date);
    if (parts) {
      const next = new Date(parts.year, parts.month - 1, parts.day);
      next.setDate(next.getDate() + 7);
      return toLocalIsoDate(next);
    }
  }

  const date = new Date();
  const diff = (date.getDay() - WEEKLY_MEASURE_DAY + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

function getUserId() {
  return state.userId;
}

function hasActiveUser() {
  return Boolean(getUserId());
}

function canUseCloud() {
  return Boolean(navigator.onLine && hasActiveUser());
}

function getStateStorageKey() {
  return state.userId ? `${STORAGE_KEY}_${state.userId}` : `${STORAGE_KEY}_anonymous`;
}

function getWorkoutCategory(type) {
  return Object.entries(WORKOUT_CATALOG)
    .find(([, items]) => items.includes(type))?.[0] || LEGACY_WORKOUT_CATEGORY_MAP[type] || 'Kuvvet';
}

function updateWorkoutTypes() {
  const categoryInput = document.getElementById('workoutCategoryInput');
  const typeInput = document.getElementById('workoutTypeInput');
  if (!categoryInput || !typeInput) return;

  const items = WORKOUT_CATALOG[categoryInput.value] || WORKOUT_CATALOG.Kuvvet;
  const current = typeInput.value;
  typeInput.innerHTML = items
    .map(item => `<option value="${item}">${item}</option>`)
    .join('');

  if (items.includes(current)) {
    typeInput.value = current;
  }

  updateWorkoutGuidance();
}

function getWorkoutGuidance(category = 'Kuvvet', type = '') {
  const guide = {
    Kuvvet: {
      title: 'Kuvvet plan\u0131',
      text: 'Full Body A/B/C/D rotasyonunu s\u00fcrd\u00fcr. Core se\u00e7ene\u011fini k\u0131sa destek b\u00f6l\u00fcm\u00fc gibi girerek ana kuvvet g\u00fcn\u00fcne ekleyebilirsin.',
    },
    Kardiyo: {
      title: 'Kardiyo plan\u0131',
      text: 'Y\u00fcr\u00fcy\u00fc\u015f, bisiklet, GrowwithJo veya di\u011fer kardiyo seanslar\u0131n\u0131 burada tut. Tempoyu zorluk alan\u0131yla ay\u0131rman yeterli.',
    },
  };
  const selected = guide[category] || guide.Kuvvet;
  const suffix = type ? ` Se\u00e7ili program: ${type}.` : '';
  return {
    title: selected.title,
    text: `${selected.text}${suffix}`,
  };
}

function updateWorkoutGuidance() {
  const el = document.getElementById('workoutGuidance');
  if (!el) return;

  const category = document.getElementById('workoutCategoryInput')?.value || 'Kuvvet';
  const type = document.getElementById('workoutTypeInput')?.value || '';
  const guidance = getWorkoutGuidance(category, type);

  el.innerHTML = `
    <strong>${guidance.title}</strong>
    <span>${guidance.text}</span>
  `;
}

function getWorkoutIntensityFromNote(note = '') {
  const match = String(note).match(/Zorluk:\s*(Kolay|Orta|Zor)/i);
  return match ? match[1] : 'Orta';
}

function getWorkoutCategoryFromNote(note = '', type = '') {
  const match = String(note).match(/Kategori:\s*([^Â·]+)/i);
  return match ? match[1].trim() : getWorkoutCategory(type);
}

function getCleanWorkoutNote(note = '') {
  return String(note)
    .replace(/^Kategori:\s*[^Â·]+Â·\s*/i, '')
    .replace(/^Zorluk:\s*(Kolay|Orta|Zor)\s*Â·\s*/i, '')
    .replace(/^Kategori:\s*[^Â·]+\s*/i, '')
    .replace(/^Zorluk:\s*(Kolay|Orta|Zor)\s*/i, '')
    .trim();
}

function formatDecimal(value, digits = 1) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function formatMinutes(value) {
  return formatDecimal(Number(value || 0), 1);
}

function getShortWeekday(date) {
  return new Date(`${date}T12:00:00`)
    .toLocaleDateString('tr-TR', { weekday: 'short' });
}

function getSleepQuality(hours) {
  const value = Number(hours || 0);
  if (value >= 7 && value <= 9) return 'Hedefte';
  if (value > 9) return 'YÃ¼ksek';
  if (value >= 6) return 'SÄ±nÄ±rda';
  return 'DÃ¼ÅŸÃ¼k';
}

function getWorkoutDayLabel(item) {
  const category = Object.entries(item.categories || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Antrenman';
  return `${category} Â· ${Number(item.duration || 0)} dk`;
}

function todayDisplay() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseDisplayDate(value) {
  if (!value) return null;

  const normalized = value.trim().replaceAll('.', '/').replaceAll('-', '/');
  const parts = normalized.split('/');

  if (parts.length !== 3) return null;

  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];

  if (year.length !== 4) return null;

  const date = new Date(`${year}-${month}-${day}`);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function parseLocaleNumber(value) {
  if (value === null || value === undefined) return NaN;
  const normalized = String(value).trim().replace(',', '.');
  return normalized ? Number(normalized) : NaN;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseIsoDateParts(value) {
  const parts = String(value || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null;
  return { year: parts[0], month: parts[1], day: parts[2] };
}

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeMeasurementDate(date) {
  const parts = parseIsoDateParts(date);
  const startParts = parseIsoDateParts(START_DATE);
  if (!parts || !startParts) return null;

  if (date >= START_DATE) return date;

  const isStartDayWrongYear = parts.month === startParts.month && parts.day === startParts.day;
  return isStartDayWrongYear ? START_DATE : null;
}

function isCloudRecordId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
}

function ensureDeletedBucket(type) {
  if (!state.deletedRecords) {
    state.deletedRecords = { measurements: [], sleep: [], workouts: [], notes: [] };
  }
  if (!Array.isArray(state.deletedRecords[type])) {
    state.deletedRecords[type] = [];
  }
  return state.deletedRecords[type];
}

function getRecordDeleteKeys(type, item = {}) {
  if (type === 'measurements') return [`date:${item.date}`];
  if (type === 'sleep') return [item.id, `date:${item.date}`].filter(Boolean);
  if (type === 'workouts') {
    return [
      item.id,
      `date:${item.date}|type:${item.type}|duration:${item.duration}|note:${item.note || ''}`,
    ].filter(Boolean);
  }
  if (type === 'notes') return [item.id, `date:${item.date}|text:${item.text || ''}`].filter(Boolean);
  return [];
}

function markRecordDeleted(type, item) {
  const bucket = ensureDeletedBucket(type);
  getRecordDeleteKeys(type, item).forEach(key => {
    if (!bucket.includes(key)) bucket.push(key);
  });
}

function unmarkRecordDeleted(type, item) {
  const bucket = ensureDeletedBucket(type);
  const keys = getRecordDeleteKeys(type, item);
  state.deletedRecords[type] = bucket.filter(key => !keys.includes(key));
}

function isRecordDeleted(type, item) {
  const bucket = ensureDeletedBucket(type);
  return getRecordDeleteKeys(type, item).some(key => bucket.includes(key));
}

function formatDate(iso) {
  const parts = parseIsoDateParts(iso);
  const date = parts ? new Date(parts.year, parts.month - 1, parts.day) : new Date(iso);

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function setStatus(msg, cls = '') {
  const bar = document.getElementById('statusBar');
  const text = document.getElementById('statusText');
  if (!bar || !text) return;

  const shouldShow = cls === 'error' || !['HazÄ±r', 'Senkron aktif'].includes(msg);
  bar.className = `status-bar ${cls}${shouldShow ? ' visible' : ''}`;
  text.textContent = msg;
}

function clearInitialLoadingStatus() {
  const text = document.getElementById('statusText');
  if (text && text.textContent.includes('YÃ¼kleniyor')) {
    setStatus('HazÄ±r', 'ok');
  }
}

function setEmptyState(host, title, copy, actionLabel = '', actionPanel = null) {
  if (!host) return;

  host.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">+</div>
      <strong>${title}</strong>
      <p>${copy}</p>
      ${actionLabel ? `<button class="btn green" type="button" data-empty-panel="${actionPanel}">${actionLabel}</button>` : ''}
    </div>
  `;

  host.querySelectorAll('[data-empty-panel]').forEach(button => {
    button.addEventListener('click', () => goPanel(Number(button.dataset.emptyPanel)));
  });
}

function renderFallbackMeasurementChart(host, data) {
  if (!host) return;

  const first = data[0];
  const last = data[data.length - 1];
  const diff = last && first ? Number(last.weight - first.weight) : 0;
  const waistData = data.filter(item =>
    shouldTrackWaist(item.date) && Number.isFinite(Number(item.waist))
  );
  const lastWaist = waistData[waistData.length - 1];

  const weights = data.map(item => Number(item.weight));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(1, max - min);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : 8 + (index / (data.length - 1)) * 84;
    const y = 88 - ((Number(item.weight) - min) / range) * 68;
    return { ...item, x, y };
  });

  host.innerHTML = `
    <div class="measurement-insight-grid">
      <div class="weight-trend-panel">
        <div class="measurement-chart-top compact">
          <div>
            <span>Kilo Trendi</span>
            <strong>${first ? Number(first.weight).toFixed(1) : 'â€”'} â†’ ${last ? Number(last.weight).toFixed(1) : 'â€”'} kg</strong>
          </div>
          <div class="${diff <= 0 ? 'good' : 'bad'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg</div>
        </div>
        <div class="fallback-line-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Kilo grafiÄŸi">
            <polyline
              points="${points.map(point => `${point.x},${point.y}`).join(' ')}"
              fill="none"
              stroke="#2563eb"
              stroke-width="2.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            ${points.map(point => `
              <circle cx="${point.x}" cy="${point.y}" r="2.4" fill="#2563eb"></circle>
            `).join('')}
          </svg>
          <div class="fallback-chart-labels">
            ${points.map(point => `
              <div>
                <strong>${Number(point.weight).toFixed(1)} kg</strong>
                <span>${formatDate(point.date)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="waist-tracking-panel">
        <span>Bel Takibi</span>
        <strong>${lastWaist ? `${Number(lastWaist.waist).toFixed(1)} cm` : 'Bekleniyor'}</strong>
        <p>Bel Ã¶lÃ§Ã¼mÃ¼ baÅŸlangÄ±Ã§ta ve her 4. tartÄ±da takip edilir.</p>
        <div class="waist-rhythm">
          <i class="active"></i><i></i><i></i><i></i>
        </div>
      </div>
    </div>
  `;
}

function getWeightChartSuggestion(first, last, diff) {
  if (!first || !last) return 'Ä°lk iki Ã¶lÃ§Ã¼mden sonra trend netleÅŸir.';
  if (diff < 0) return `${formatDate(first.date)} baÅŸlangÄ±cÄ±ndan beri dÃ¼ÅŸÃ¼ÅŸ var.`;
  if (diff > 0) return 'Bu hafta artÄ±ÅŸ var; uyku, su ve antrenman ritmini kontrol et.';
  return 'Kilo aynÄ± seviyede; trend iÃ§in sonraki pazar Ã¶lÃ§Ã¼mÃ¼nÃ¼ bekle.';
}

function getWaistRhythmStep() {
  const nextSequence = getMeasurementSequenceNumber(getSuggestedMeasureDate());
  const remainder = ((nextSequence - 1) % 4) + 1;
  return Math.max(1, Math.min(4, remainder));
}

function renderWaistRhythm(step) {
  return Array.from({ length: 4 }, (_, index) =>
    `<i class="${index < step ? 'active' : ''}"></i>`
  ).join('');
}

function renderMeasurementInsight(host, data, canvasHtml = '') {
  const waistData = data.filter(item =>
    shouldTrackWaist(item.date) && Number.isFinite(Number(item.waist))
  );
  const first = data[0];
  const last = data[data.length - 1];
  const weightDiff = first && last ? Number(last.weight - first.weight) : 0;
  const waistDiff = waistData.length >= 2
    ? Number(waistData[waistData.length - 1].waist - waistData[0].waist)
    : null;
  const lastWaist = waistData[waistData.length - 1];
  const rhythmStep = getWaistRhythmStep();

  host.innerHTML = `
    <div class="measurement-insight-grid">
      <div class="weight-trend-panel">
        <div class="measurement-chart-top">
          <div>
            <span>Kilo Trendi</span>
            <strong>${Number(first.weight).toFixed(1)} â†’ ${Number(last.weight).toFixed(1)} kg</strong>
          </div>
          <div class="${weightDiff <= 0 ? 'good' : 'bad'}">${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg</div>
        </div>

        <div class="measurement-detail-row">
          <div>
            <span>BaÅŸlangÄ±Ã§</span>
            <strong>${formatDate(first.date)}</strong>
          </div>
          <div>
            <span>Son Ã¶lÃ§Ã¼m</span>
            <strong>${formatDate(last.date)}</strong>
          </div>
          <div>
            <span>Yorum</span>
            <strong>${getWeightChartSuggestion(first, last, weightDiff)}</strong>
          </div>
        </div>

        <div class="measurement-chart-canvas">
          ${canvasHtml}
        </div>
      </div>

      <div class="waist-tracking-panel">
        <span>Bel Takibi</span>
        <strong>${lastWaist ? `${Number(lastWaist.waist).toFixed(1)} cm` : 'Bekleniyor'}</strong>
        <p>${waistDiff === null ? 'Yeni bel Ã¶lÃ§Ã¼mÃ¼ 4. tartÄ±da alÄ±nacak. Åimdilik baÅŸlangÄ±Ã§ deÄŸeri referans olarak tutuluyor.' : `Toplam deÄŸiÅŸim: ${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm`}</p>
        <div class="waist-rhythm" aria-label="Bel Ã¶lÃ§Ã¼m dÃ¶ngÃ¼sÃ¼">
          ${renderWaistRhythm(rhythmStep)}
        </div>
        <small>4 tartÄ±da 1 bel Ã¶lÃ§Ã¼mÃ¼</small>
      </div>
    </div>
  `;
}

function setSyncDot(cls) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot ' + cls;
}

function getSortedMeasurements() {
  const byDate = new Map();

  [...(state.measurements || [])]
    .filter(item => item?.date && Number.isFinite(Number(item.weight)))
    .forEach(item => {
      const normalizedDate = normalizeMeasurementDate(item.date);
      if (!normalizedDate) return;

      const normalized = {
        ...item,
        date: normalizedDate,
        weight: Number(item.weight),
        waist: parseOptionalNumber(item.waist),
      };

      const existing = byDate.get(normalizedDate);
      byDate.set(normalizedDate, {
        ...existing,
        ...normalized,
        waist: normalized.waist ?? existing?.waist ?? null,
      });
    });

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function getMeasurementTrendData() {
  const byDate = new Map(
    getSortedMeasurements().map(item => [item.date, item])
  );

  if (Number.isFinite(Number(state.startWeight))) {
    const existing = byDate.get(START_DATE);
    byDate.set(START_DATE, {
      ...existing,
      date: START_DATE,
      weight: Number(existing?.weight ?? state.startWeight),
      waist: parseOptionalNumber(existing?.waist ?? state.startWaist),
    });
  }

  return [...byDate.values()]
    .filter(item => item.date >= START_DATE && Number.isFinite(Number(item.weight)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getChartMeasurementData() {
  normalizeProfileState();

  const data = getMeasurementTrendData();

  if (data.length >= 2) return data;

  const sorted = getSortedMeasurements();
  if (sorted.length >= 2) return sorted;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startWeight = Number(state.startWeight ?? first?.weight);
  const startWaist = parseOptionalNumber(state.startWaist ?? first?.waist);
  const lastWeight = Number(last?.weight);

  if (
    Number.isFinite(startWeight) &&
    last &&
    Number.isFinite(lastWeight) &&
    (last.date !== START_DATE || lastWeight !== startWeight)
  ) {
    return [
      {
        date: START_DATE,
        weight: startWeight,
        waist: startWaist,
      },
      {
        ...last,
        weight: lastWeight,
        waist: parseOptionalNumber(last.waist),
      },
    ].sort((a, b) => a.date.localeCompare(b.date));
  }

  return data;
}

function getLatestWaistMeasurement() {
  return getSortedMeasurements()
    .filter(item => Number.isFinite(Number(item.waist)) && shouldTrackWaist(item.date))
    .at(-1);
}

function getWaistMeasurements() {
  return getSortedMeasurements()
    .filter(item => Number.isFinite(Number(item.waist)) && shouldTrackWaist(item.date));
}

function getMeasurementSequenceNumber(date) {
  const targetDate = date || getSuggestedMeasureDate();
  const dates = new Set(
    getSortedMeasurements()
      .filter(item => item.date < targetDate)
      .map(item => item.date)
  );
  return dates.size + 1;
}

function shouldTrackWaist(date) {
  const sequence = getMeasurementSequenceNumber(date);
  return sequence === 1 || sequence % 4 === 0;
}

function updateWaistHint() {
  const dateInput = document.getElementById('measureDateInput');
  const waistInput = document.getElementById('measureWaistInput');
  const hint = document.getElementById('waistMeasureHint');
  if (!hint) return;

  const date = dateInput?.value || getSuggestedMeasureDate();
  const existing = getSortedMeasurements().find(item => item.date === date);
  const sequence = getMeasurementSequenceNumber(date);
  const required = shouldTrackWaist(date);

  if (waistInput) {
    waistInput.disabled = !required;
    waistInput.placeholder = required ? 'cm' : '4. tartÄ±da';
    if (!required) waistInput.value = '';
  }

  hint.textContent = required
    ? sequence === 1
      ? 'BaÅŸlangÄ±Ã§ tartÄ±sÄ±: bel Ã¶lÃ§Ã¼mÃ¼nÃ¼ de ekle.'
      : `${sequence}. tartÄ±: bu hafta bel Ã¶lÃ§Ã¼mÃ¼nÃ¼ de ekle.`
    : `${sequence}. tartÄ±: sadece kilo gir. Bel Ã¶lÃ§Ã¼mÃ¼ 4. tartÄ±da takip edilir.`;

  if (existing) {
    hint.textContent = `${formatDate(date)} tarihinde kayÄ±t var. Kaydedersen bu Ã¶lÃ§Ã¼m gÃ¼ncellenir.`;
  }

  hint.classList.toggle('important', required);
}

function syncMeasureFormDate(force = false) {
  const dateInput = document.getElementById('measureDateInput');
  if (!dateInput) return;

  const suggested = getSuggestedMeasureDate();
  const currentExists = getSortedMeasurements().some(item => item.date === dateInput.value);

  if (force || !dateInput.value || currentExists) {
    dateInput.value = suggested;
  }

  updateWaistHint();
}

function normalizeProfileState() {
  state.startDate = START_DATE;
  state.measurements = getSortedMeasurements();

  const measurements = getSortedMeasurements();
  const first = measurements[0];

  if (!state.name || state.name === 'Sporcu') {
    const heroName = document.getElementById('heroName')?.textContent?.trim();
    if (heroName && heroName !== 'Sporcu') {
      state.name = heroName;
    }
  }

  if ((state.startWeight === null || state.startWeight === undefined) && first) {
    state.startWeight = first.weight;
  }

  if ((state.startWaist === null || state.startWaist === undefined) && first) {
    state.startWaist = first.waist;
  }

  if (!Array.isArray(state.milestones)) {
    state.milestones = [];
  }

  state.milestones = state.milestones
    .map(Number)
    .filter(value => Number.isFinite(value));

  if (!Number.isFinite(Number(state.goalWeight)) && state.milestones.length) {
    state.goalWeight = state.milestones[state.milestones.length - 1];
  }
}

function hasTrackedData() {
  return Boolean(
    (Array.isArray(state.measurements) && state.measurements.length) ||
    (Array.isArray(state.sleep) && state.sleep.length) ||
    (Array.isArray(state.workouts) && state.workouts.length) ||
    (Array.isArray(state.notes) && state.notes.length)
  );
}

function getSessionDisplayName(session) {
  const metadata = session?.user?.user_metadata || {};
  const metadataName = metadata.name || metadata.full_name || metadata.display_name;
  const savedName = localStorage.getItem('ft_last_name');
  const email = session?.user?.email || state.userEmail || '';
  const emailName = email
    ? email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
      .trim()
    : '';

  return [state.name, savedName, metadataName, emailName, 'Sporcu']
    .map(value => String(value || '').trim())
    .find(value => value && value !== 'Sporcu') || 'Sporcu';
}

function recoverOnboardingFromData() {
  if (!hasTrackedData()) return false;

  normalizeProfileState();
  state.onboarded = true;
  state.startDate = state.startDate || START_DATE;

  if (!Number.isFinite(Number(state.goalWeight))) {
    const lastGoal = Array.isArray(state.milestones) && state.milestones.length
      ? state.milestones[state.milestones.length - 1]
      : 85;
    state.goalWeight = Number(lastGoal);
  }

  return true;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ PERSISTENCE Ã¢â€â‚¬Ã¢â€â‚¬
function stateSave() {
  try {
    localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
  } catch (e) {
    console.error('State kaydedilemedi:', e);
    setSyncDot('err');
    setStatus('KayÄ±t hatasÄ±: ' + e.message, 'error');
  }
}

function stateLoad() {
  try {
    const raw = localStorage.getItem(getStateStorageKey());
    if (!raw) return;

    const savedState = JSON.parse(raw);

    state = {
      ...state,
      ...savedState,
      userId: savedState.userId || '',
      userEmail: savedState.userEmail || '',
      onboarded: Boolean(savedState.onboarded),
      name: savedState.name || '',
      startDate: savedState.startDate || START_DATE,
      startWeight: savedState.startWeight ?? null,
      startWaist: savedState.startWaist ?? null,
      goalWeight: Number(savedState.goalWeight || 85),
      milestones: Array.isArray(savedState.milestones) ? savedState.milestones : [95, 85],
      preferences: {
        measureReminder: savedState.preferences?.measureReminder ?? true,
        dailyReminder: savedState.preferences?.dailyReminder ?? false,
      },
      syncMeta: {
        lastSuccess: savedState.syncMeta?.lastSuccess || '',
        lastAttempt: savedState.syncMeta?.lastAttempt || '',
        lastError: savedState.syncMeta?.lastError || '',
        pendingMeasurements: Array.isArray(savedState.syncMeta?.pendingMeasurements) ? savedState.syncMeta.pendingMeasurements : [],
        pendingSleep: Array.isArray(savedState.syncMeta?.pendingSleep) ? savedState.syncMeta.pendingSleep : [],
        pendingProfile: Boolean(savedState.syncMeta?.pendingProfile),
      },
      measurements: Array.isArray(savedState.measurements) ? savedState.measurements : [],
      weights: Array.isArray(savedState.weights) ? savedState.weights : [],
      nutrition: Array.isArray(savedState.nutrition) ? savedState.nutrition : [],
      workouts: Array.isArray(savedState.workouts) ? savedState.workouts : [],
      notes: Array.isArray(savedState.notes) ? savedState.notes : [],
      sleep: Array.isArray(savedState.sleep) ? savedState.sleep : [],
      deletedRecords: {
        measurements: Array.isArray(savedState.deletedRecords?.measurements) ? savedState.deletedRecords.measurements : [],
        sleep: Array.isArray(savedState.deletedRecords?.sleep) ? savedState.deletedRecords.sleep : [],
        workouts: Array.isArray(savedState.deletedRecords?.workouts) ? savedState.deletedRecords.workouts : [],
        notes: Array.isArray(savedState.deletedRecords?.notes) ? savedState.deletedRecords.notes : [],
      },
    };
    ensureSyncMeta();
    normalizeProfileState();
  } catch (e) {
    console.warn('State yÃ¼klenemedi:', e);
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ THEME Ã¢â€â‚¬Ã¢â€â‚¬
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);

  const themeBtn = document.getElementById('themeBtn');
  const themeMeta = document.getElementById('themeColorMeta');

  if (themeBtn) {
    themeBtn.innerHTML = state.theme === 'dark'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>';
  }

  if (themeMeta) {
    themeMeta.content = state.theme === 'dark' ? '#0d111b' : '#e9eef7';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  stateSave();
}

// Ã¢â€â‚¬Ã¢â€â‚¬ NAVIGATION Ã¢â€â‚¬Ã¢â€â‚¬
function goPanel(idx) {
  PANELS.forEach((id, i) => {
    const panel = document.getElementById(id);
    if (panel) panel.classList.toggle('active', i === idx);
  });

  BN_IDS.forEach((id, i) => {
    const btn = document.getElementById(id);
    if (btn) {
      const isActive = i === idx;
      btn.classList.toggle('active', isActive);
      if (isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  });

  if (idx === 4) {
    normalizeProfileState();
    renderSettings();
  }

  requestAnimationFrame(() => {
    if (idx === 3) {
      normalizeProfileState();
      renderProgressSummary();
      renderMeasurementChart();
      renderProgressCharts();
      renderProgressList();
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const appShell = document.querySelector('.app-shell');
    if (appShell) appShell.scrollTop = 0;

    const panels = document.getElementById('panels');
    if (panels) panels.scrollTop = 0;

    const activePanel = document.querySelector('.panel.active');
    if (activePanel) activePanel.scrollTop = 0;
  });
}

// Ã¢â€â‚¬Ã¢â€â‚¬ RENDER Ã¢â€â‚¬Ã¢â€â‚¬
function renderHero() {
  const dateEl = document.getElementById('heroDate');
  const nameEl = document.getElementById('heroName');

  if (dateEl) {
    dateEl.textContent = new Date()
      .toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
      .toUpperCase();
  }

  if (nameEl) {
    nameEl.textContent = state.name || 'Sporcu';
  }
}

function renderMoti() {
  const el = document.getElementById('motiText');
  if (!el) return;

  const now = new Date();
  const localDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const idx = localDay % MOTIVATIONS.length;
  el.textContent = MOTIVATIONS[idx];
}

function renderDashboardWeekLabel() {
  const el = document.getElementById('dashboardWeekLabel');
  if (!el) return;

  const range = getDashboardWeekRange();

  const sleepTotal = getCurrentWeekSleepTotal();
  const sleepPct = Math.min(100, Math.round((sleepTotal / SLEEP_TARGET) * 100));

  const workoutTotal = getCurrentWeekWorkoutTotal();
  const workoutPct = Math.min(100, Math.round((workoutTotal / WORKOUT_TARGET) * 100));
  const dailyTotals = getWeekDailyTotals(range);
  const sleepDays = VERIFIED_WEEK_TOTALS[range.start]?.sleepNights || dailyTotals.sleep.length;
  const workoutDays = dailyTotals.workouts.length;
  const sleepAverage = sleepDays ? sleepTotal / sleepDays : 0;
  const weekStatus = sleepPct >= 100 && workoutPct >= 100
    ? 'Hedef Ã¼stÃ¼'
    : sleepAverage >= 7 && workoutPct >= 70
      ? 'Ä°yi gidiyorsun'
      : sleepDays || workoutDays
        ? 'Takipte'
        : 'BaÅŸla';
  const sleepInsight = sleepDays
    ? `KayÄ±tlÄ± gÃ¼n ort. ${sleepAverage.toFixed(1)} saat`
    : 'Uyku kaydÄ± bekleniyor';
  const workoutInsight = workoutDays
    ? `${workoutDays} aktif gÃ¼n`
    : 'Antrenman kaydÄ± bekleniyor';
  const balanceInsight = sleepAverage >= 7 && workoutPct >= 100
    ? 'Uyku ve hareket gÃ¼Ã§lÃ¼'
    : sleepAverage >= 7
      ? 'Uyku hedefte'
      : workoutPct >= 100
        ? 'Hareket gÃ¼Ã§lÃ¼'
        : 'Ritim kuruluyor';

  el.innerHTML = `
    <div class="week-card-head">
      <div>
        <div class="week-card-title">${getDashboardWeekTitle()}</div>
        <div class="week-card-date">${getDashboardWeekContext() || `${formatDate(range.start)} - ${formatDate(shiftIsoDate(range.end, 1))}`}</div>
      </div>

      <div class="week-card-pill">
        ${weekStatus}
      </div>
    </div>

    <div class="week-metrics">
      <div class="week-metric">
        <div class="week-metric-top">
          <span>Uyku</span>
          <strong>${sleepTotal.toFixed(1)} / ${SLEEP_TARGET} saat</strong>
        </div>
        <div class="week-track">
          <div class="week-fill sleep" style="width:${sleepPct}%"></div>
        </div>
      </div>

      <div class="week-metric">
        <div class="week-metric-top">
          <span>Antrenman</span>
          <strong>${workoutTotal} / ${WORKOUT_TARGET} dk</strong>
        </div>
        <div class="week-track">
          <div class="week-fill workout" style="width:${workoutPct}%"></div>
        </div>
      </div>
    </div>

    <div class="week-mini-insights">
      <span>Uyku <strong>${sleepInsight}</strong></span>
      <span>Antrenman <strong>${workoutInsight}</strong></span>
      <span>Durum <strong>${balanceInsight}</strong></span>
    </div>
  `;
}

function renderDashboardGoalCard() {
  const el = document.getElementById('dashboardGoalCard');
  if (!el) return;

  const data = getMeasurementTrendData();

  if (!data.length) {
    setEmptyState(
      el,
      'HaftalÄ±k rapor henÃ¼z oluÅŸmadÄ±',
      'Uyku, antrenman ve Ã¶lÃ§Ã¼m kayÄ±tlarÄ± geldikÃ§e haftalÄ±k Ã¶zetler burada listelenir.'
    );
    return;
  }

  const first = data[0];
  const last = data[data.length - 1];

  const milestones = state.milestones || [95, 90, 85];
  let currentGoal = milestones.find(goal => last.weight > goal);
  if (!currentGoal) currentGoal = milestones[milestones.length - 1];

  const completed = first.weight - last.weight;

  const kgLeft = Math.max(0, Number(last.weight - currentGoal).toFixed(1));
  const finalKgLeft = Math.max(0, Number(last.weight - state.goalWeight).toFixed(1));

  const firstNeeded = first.weight - currentGoal;
  const firstPct = firstNeeded > 0
    ? Math.min(100, Math.round((completed / firstNeeded) * 100))
    : 100;

  const finalNeeded = first.weight - state.goalWeight;
  const finalPct = finalNeeded > 0
    ? Math.min(100, Math.round((completed / finalNeeded) * 100))
    : 100;

  el.innerHTML = `
    <div class="goal-hero-card">
      <div class="goal-card-layout">

        <div class="goal-left">
          <div class="goal-label">ÅU ANKÄ° ARA HEDEF</div>

          <div class="goal-big">
            <span>${currentGoal}</span>
            <small>kg</small>
          </div>

          <div class="goal-caption">Ä°lk hedef</div>

          <div class="goal-mini-card">
            <div class="goal-progress-row">
              <span>Ä°lk hedef ilerlemesi</span>
              <strong>%${firstPct}</strong>
            </div>
            <div class="goal-track">
              <div class="goal-fill" style="width:${firstPct}%"></div>
            </div>
          </div>
        </div>

        <div class="goal-right">
          <div class="goal-info-card">
            <span>Ä°lk hedefe kalan</span>
            <strong>${kgLeft} kg</strong>
          </div>

          <div class="goal-info-card">
            <span>Final hedefe kalan</span>
            <strong>${finalKgLeft} kg</strong>
          </div>

          <div class="goal-mini-card goal-final-card">
            <div class="goal-progress-row">
              <span>Final ilerleme</span>
              <strong>%${finalPct}</strong>
            </div>
            <div class="goal-track final">
              <div class="goal-fill final" style="width:${finalPct}%"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderStats() {
  const el = document.getElementById('dashboardProgressCard');
  if (!el) return;

  const data = getMeasurementTrendData();

  if (!data.length) {
    el.innerHTML = `
      <div class="empty-state">
        Ä°lk Ã¶lÃ§Ã¼mÃ¼nÃ¼ eklediÄŸinde kilo ve bel kartlarÄ± burada gÃ¶rÃ¼necek.
      </div>
    `;
    return;
  }

  const first = data[0];
  const last = data[data.length - 1];
  const waistMeasurements = getWaistMeasurements();
  const firstWaist = waistMeasurements[0];
  const lastWaist = waistMeasurements[waistMeasurements.length - 1];
  const weightDiff = Number(last.weight - first.weight);
  const waistDiff = waistMeasurements.length >= 2 ? Number(lastWaist.waist - firstWaist.waist) : null;
  const startDateText = formatDate(first.date);

  el.innerHTML = `
    <div class="dashboard-measure-grid">
      <div class="progress-summary-card">
        <div>
          <div class="progress-summary-label">Son Kilo</div>
          <div class="progress-summary-value">${last.weight} <span>kg</span></div>
        </div>
        <div class="progress-summary-side">
          <div class="progress-summary-small">${startDateText} baÅŸlangÄ±cÄ±ndan beri</div>
          <div class="progress-summary-diff ${weightDiff <= 0 ? 'good' : 'bad'}">
            ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg
          </div>
        </div>
      </div>

      <div class="progress-summary-card">
        <div>
          <div class="progress-summary-label">Son Bel Ã–lÃ§Ã¼mÃ¼</div>
          <div class="progress-summary-value">${lastWaist?.waist ?? 'â€”'} <span>cm</span></div>
        </div>
        <div class="progress-summary-side">
          <div class="progress-summary-small">${waistMeasurements.length ? 'Sonraki bel 4. tartÄ±da' : 'Her 4. tartÄ±da'}</div>
          <div class="progress-summary-diff ${waistDiff === null || waistDiff <= 0 ? 'good' : 'bad'}">
            ${waistDiff === null ? 'Bekleniyor' : `${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMeasurementChart() {
  const host = document.getElementById('measurementChartHost');
  if (!host) return;

  normalizeProfileState();
  const data = getChartMeasurementData();

  if (measurementChart) {
    measurementChart.destroy();
    measurementChart = null;
  }

  if (data.length < 2) {
    host.innerHTML = '';
    setEmptyState(
      host,
      'Grafik iÃ§in iki Ã¶lÃ§Ã¼m gerekli',
      'BaÅŸlangÄ±Ã§ kilosu ve en az bir sonraki kilo Ã¶lÃ§Ã¼mÃ¼ olduÄŸunda trend burada gÃ¶rÃ¼nÃ¼r.',
      'Ã–lÃ§Ã¼m Ekle',
      1
    );
    return;
  }

  if (typeof Chart === 'undefined') {
    renderFallbackMeasurementChart(host, data);
    return;
  }

  renderMeasurementInsight(host, data, '<canvas id="measurementChart"></canvas>');
  const canvas = document.getElementById('measurementChart');
  if (!canvas) return;

  canvas.style.display = 'block';

  measurementChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(item => formatDate(item.date)),
      datasets: [
        {
          label: 'Kilo (kg)',
          data: data.map(item => item.weight),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,.08)',
          fill: true,
          tension: 0.42,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 6,
          pointBorderWidth: 3,
          pointBorderColor: '#ffffff',
          pointBackgroundColor: '#2563eb'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: context => `${context.parsed.y} kg`
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          position: 'left',
          beginAtZero: false,
          suggestedMin: Math.min(...data.map(item => Number(item.weight))) - 1,
          suggestedMax: Math.max(...data.map(item => Number(item.weight))) + 1,
          grid: {
            color: 'rgba(113,128,150,.18)'
          },
          ticks: {
            callback: value => `${value} kg`
          }
        }
      }
    }
  });
}

function renderWeightSummary() {
  const el = document.getElementById('weightSummary');
  if (!el) return;

  const data = getSortedMeasurements();

  if (!data.length) {
    el.innerHTML = '';
    return;
  }

  const first = data[0];
  const last = data[data.length - 1];
  const waistMeasurements = getWaistMeasurements();
  const firstWaist = waistMeasurements[0];
  const lastWaist = waistMeasurements[waistMeasurements.length - 1];

  const weightDiff = last.weight - first.weight;
  const waistDiff = waistMeasurements.length >= 2 ? lastWaist.waist - firstWaist.waist : null;

  const milestones = state.milestones || [95, 90, 85, 80, 75];

  let currentGoal = milestones.find(goal => last.weight > goal);

  if (!currentGoal) {
    currentGoal = milestones[milestones.length - 1];
  }

  const kgLeft = Math.max(0, (last.weight - currentGoal).toFixed(1));

  const startWeight = first.weight;
  const totalNeeded = startWeight - currentGoal;
  const completed = startWeight - last.weight;

  const progressPct = totalNeeded > 0
    ? Math.min(100, Math.round((completed / totalNeeded) * 100))
    : 100;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px">

      <div class="card" style="padding:16px">
        <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
          SON KÄ°LO
        </div>

        <div style="font-size:24px;font-weight:900;margin-top:6px">
          ${last.weight} kg
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
          TOPLAM DEÄÄ°ÅÄ°M
        </div>

        <div style="
          font-size:24px;
          font-weight:900;
          margin-top:6px;
          color:${weightDiff <= 0 ? 'var(--green)' : 'var(--red)'}
        ">
          ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
          Ä°LK ARA HEDEF
        </div>

        <div style="font-size:24px;font-weight:900;margin-top:6px">
          ${currentGoal} kg
        </div>

        <div style="font-size:12px;color:var(--muted);margin-top:8px">
          Ä°lk hedefe kalan: ${kgLeft} kg Â· Final hedef: ${state.goalWeight} kg
        </div>

        <div style="
          height:8px;
          background:var(--border);
          border-radius:999px;
          overflow:hidden;
          margin-top:10px
        ">
          <div style="
            height:100%;
            width:${progressPct}%;
            background:linear-gradient(90deg,#3b82f6,#06b6d4);
            border-radius:999px
          "></div>
        </div>

        <div style="font-size:12px;color:var(--muted);margin-top:6px">
          %${progressPct} tamamlandÄ±
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
          BEL DEÄÄ°ÅÄ°MÄ°
        </div>

        <div style="
          font-size:24px;
          font-weight:900;
          margin-top:6px;
          color:${waistDiff === null || waistDiff <= 0 ? 'var(--green)' : 'var(--red)'}
        ">
          ${waistDiff === null ? 'Sonraki Ã¶lÃ§Ã¼m 4. tartÄ±da' : `${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm`}
        </div>
      </div>

    </div>
  `;
}

function renderWeightList() {
  const list = document.getElementById('weightList');
  const empty = document.getElementById('weightEmpty');
  if (!list || !empty) return;

  const data = getSortedMeasurements().sort((a, b) => b.date.localeCompare(a.date));

  if (!data.length) {
    empty.style.display = 'block';
    list.innerHTML = '';
    return;
  }

  empty.style.display = 'none';

  list.innerHTML = data.map((m, index) => {
    const prev = data[index + 1];

    const weightDiff = prev && m.weight != null && prev.weight != null
      ? (parseFloat(m.weight) - parseFloat(prev.weight)).toFixed(1)
      : null;

    const isWaistWeek = shouldTrackWaist(m.date);
    const prevWaist = getWaistMeasurements()
      .filter(item => item.date < m.date)
      .at(-1);
    const waistDiff = isWaistWeek && prevWaist && Number.isFinite(Number(m.waist))
      ? (parseFloat(m.waist) - parseFloat(prev.waist)).toFixed(1)
      : null;

    const weightDiffHtml = weightDiff
      ? `<span class="delta-pill ${weightDiff < 0 ? 'good' : 'bad'}">${weightDiff > 0 ? '+' : ''}${weightDiff} kg</span>`
      : '<span class="delta-pill neutral">BaÅŸlangÄ±Ã§</span>';

    const waistDiffHtml = waistDiff
      ? `<span class="delta-pill ${waistDiff < 0 ? 'good' : 'bad'}">${waistDiff > 0 ? '+' : ''}${waistDiff} cm</span>`
      : `<span class="delta-pill neutral">${isWaistWeek ? 'Ä°lk bel' : '4. tartÄ±da'}</span>`;

    const waistText = isWaistWeek && Number.isFinite(Number(m.waist))
      ? `${m.waist} <span style="font-size:12px;color:var(--muted)">cm bel</span>`
      : `<span style="font-size:12px;color:var(--muted)">Bel: aylÄ±k takip</span>`;

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-weight:700">
            ${m.weight ?? '?'} <span style="font-size:12px;color:var(--muted)">kg</span>
            Â·
            ${waistText}
          </div>
          <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono)">
            ${formatDate(m.date)}
          </div>
        </div>

        <div style="font-family:var(--font-mono);font-size:11px;text-align:right">
          <div>${weightDiffHtml}</div>
          <div>${waistDiffHtml}</div>
        </div>

        <button onclick="deleteWeight(${index})"
          style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px"
          aria-label="Sil">Ã—</button>
      </div>
    `;
  }).join('');
}

function renderNotes() {
  const list = document.getElementById('noteList');
  if (!list) return;

  const notes = (Array.isArray(state.notes) ? state.notes : [])
    .map((note, stateIndex) => ({ ...note, stateIndex }))
    .filter(note => note.date === today());

  if (!notes.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">+</div>
        BugÃ¼n iÃ§in not yok.
      </div>
    `;
    return;
  }

  list.innerHTML = notes.map(note => `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${note.text}</div>
        <div class="daily-row-meta">BugÃ¼n</div>
      </div>
      <button onclick="deleteNote(${note.stateIndex})" class="row-delete" aria-label="Sil">Ã—</button>
    </div>
  `).join('');
}
function getWeekRange(dateValue) {
  const parts = String(dateValue || '').split('-').map(Number);
  const date = parts.length === 3 && parts.every(Number.isFinite)
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(dateValue);

  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  return {
    start: toLocalIsoDate(sunday),
    end: toLocalIsoDate(saturday),
  };
}

function shiftIsoDate(dateValue, days) {
  const parts = parseIsoDateParts(dateValue);
  if (!parts) return dateValue;
  return toLocalIsoDate(new Date(parts.year, parts.month - 1, parts.day + days));
}

function getSleepRangeForReportWeek(range) {
  return {
    start: range.start,
    end: range.end,
  };
}

function getDashboardWeekRange() {
  const dates = [
    ...(state.sleep || []).map(item => item.date),
    ...(state.workouts || []).map(item => item.date),
  ].filter(Boolean);

  if (!dates.length) {
    return getWeekRange(today());
  }

  const latestDate = dates.sort((a, b) => b.localeCompare(a))[0];
  return getWeekRange(latestDate);
}

function getDashboardWeekTitle() {
  const range = getDashboardWeekRange();
  const current = getWeekRange(today());
  return range.start === current.start ? 'Bu Hafta' : 'Son Aktif Hafta';
}

function getDashboardWeekContext() {
  const range = getDashboardWeekRange();
  const current = getWeekRange(today());
  if (range.start === current.start) return '';
  return `Bu hafta henÃ¼z kayÄ±t yok Â· ${formatDate(range.start)} - ${formatDate(shiftIsoDate(range.end, 1))} gÃ¶steriliyor`;
}

function getDailyViewRange() {
  if (dailyView === 'today') {
    const date = today();
    return { start: date, end: date, title: 'BugÃ¼n', targetMode: 'today' };
  }

  if (dailyView === 'all') {
    return { start: null, end: null, title: 'TÃ¼m GeÃ§miÅŸ', targetMode: 'all' };
  }

  return { ...getDashboardWeekRange(), title: getDashboardWeekTitle(), targetMode: 'week' };
}

function itemMatchesDailyView(item) {
  const range = getDailyViewRange();
  if (!item?.date) return false;
  if (!range.start || !range.end) return true;
  return item.date >= range.start && item.date <= range.end;
}

function itemMatchesSleepDailyView(item) {
  const range = getDailyViewRange();
  if (!item?.date) return false;
  if (!range.start || !range.end) return true;
  if (range.targetMode !== 'week') return item.date >= range.start && item.date <= range.end;

  const sleepRange = getSleepRangeForReportWeek(range);
  return item.date >= sleepRange.start && item.date <= sleepRange.end;
}

function renderDailyViewControls() {
  const range = getDailyViewRange();
  const grid = document.getElementById('dailyGrid');
  if (grid) grid.dataset.view = dailyView;

  document.querySelectorAll('[data-daily-view]').forEach(btn => {
    const isActive = btn.dataset.dailyView === dailyView;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));

    if (btn.dataset.dailyView === 'week') {
      btn.textContent = getDashboardWeekTitle();
    }
  });

  return range;
}

function getCurrentWeekSleepTotal() {
  const sleep = Array.isArray(state.sleep) ? state.sleep : [];
  const range = getDashboardWeekRange();
  const sleepRange = getSleepRangeForReportWeek(range);
  const verified = VERIFIED_WEEK_TOTALS[range.start];
  if (verified) return verified.sleep;

  return sleep
    .filter(item => item.date >= sleepRange.start && item.date <= sleepRange.end)
    .reduce((total, item) => total + Number(item.hours || 0), 0);
}

function renderSleepSummary() {
  const el = document.getElementById('sleepSummary');
  if (!el) return;

  const sleep = Array.isArray(state.sleep) ? state.sleep : [];
  const range = getDailyViewRange();
  const todayTotal = sleep
    .filter(item => item.date === today())
    .reduce((total, item) => total + Number(item.hours || 0), 0);
  const viewTotal = sleep
    .filter(itemMatchesSleepDailyView)
    .reduce((total, item) => total + Number(item.hours || 0), 0);
  const viewValue = range.targetMode === 'week'
    ? `${viewTotal.toFixed(1)} / ${SLEEP_TARGET} saat`
    : `${viewTotal.toFixed(1)} saat`;

  el.innerHTML = `
    <div class="daily-stat-line">
      <span>BugÃ¼n</span>
      <strong>${todayTotal.toFixed(1)} saat</strong>
    </div>
    <div class="daily-stat-line muted">
      <span>${range.title}</span>
      <strong>${viewValue}</strong>
    </div>
  `;
}
function renderSleepList() {
  const list = document.getElementById('sleepList');
  if (!list) return;

  const range = getDailyViewRange();
  const sorted = [...(state.sleep || [])].sort((a, b) => b.date.localeCompare(a.date));
  const sleep = sorted
    .map((item, sortedIndex) => ({ ...item, sortedIndex }))
    .filter(itemMatchesSleepDailyView);

  if (!sleep.length) {
    list.innerHTML = `<div class="empty-state compact">${range.title} iÃ§in uyku kaydÄ± yok.</div>`;
    return;
  }

  list.innerHTML = sleep.map(item => `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${formatDecimal(item.hours)} saat</div>
        <div class="daily-row-meta">${item.date === today() ? 'BugÃ¼n' : formatDate(item.date)} Â· ${getSleepQuality(item.hours)}</div>
      </div>
      <button onclick="deleteSleep(${item.sortedIndex})" class="row-delete" aria-label="Sil">Ã—</button>
    </div>
  `).join('');
}
function getCurrentWeekWorkoutTotal() {
  const workouts = Array.isArray(state.workouts) ? state.workouts : [];
  const range = getDashboardWeekRange();
  const verified = VERIFIED_WEEK_TOTALS[range.start];
  if (verified) return verified.workouts;

  return workouts
    .filter(item => item.date >= range.start && item.date <= range.end)
    .reduce((total, item) => total + Number(item.duration || 0), 0);
}

function renderWorkoutSummary() {
  const el = document.getElementById('workoutSummary');
  if (!el) return;

  const workouts = Array.isArray(state.workouts) ? state.workouts : [];
  const range = getDailyViewRange();
  const todayTotal = workouts
    .filter(item => item.date === today())
    .reduce((total, item) => total + Number(item.duration || 0), 0);
  const viewTotal = workouts
    .filter(itemMatchesDailyView)
    .reduce((total, item) => total + Number(item.duration || 0), 0);
  const viewValue = range.targetMode === 'week'
    ? `${viewTotal} / ${WORKOUT_TARGET} dk`
    : `${viewTotal} dk`;

  el.innerHTML = `
    <div class="daily-stat-line">
      <span>BugÃ¼n</span>
      <strong>${todayTotal} dk</strong>
    </div>
    <div class="daily-stat-line muted">
      <span>${range.title}</span>
      <strong>${viewValue}</strong>
    </div>
  `;
}
function renderWorkoutList() {
  const list = document.getElementById('workoutList');
  if (!list) return;

  const range = getDailyViewRange();
  const sorted = [...(state.workouts || [])].sort((a, b) => b.date.localeCompare(a.date));
  const workouts = sorted
    .map((item, sortedIndex) => ({ ...item, sortedIndex }))
    .filter(itemMatchesDailyView);

  if (!workouts.length) {
    list.innerHTML = `<div class="empty-state compact">${range.title} iÃ§in antrenman kaydÄ± yok.</div>`;
    return;
  }

  list.innerHTML = workouts.map(item => `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${item.type} Â· ${formatMinutes(item.duration)} dk</div>
        <div class="daily-row-meta">${formatDate(item.date)} Â· ${getWorkoutCategoryFromNote(item.note, item.type)} Â· ${getWorkoutIntensityFromNote(item.note)}${getCleanWorkoutNote(item.note) ? ` Â· ${getCleanWorkoutNote(item.note)}` : ''}</div>
      </div>
      <div class="row-actions">
        <button onclick="editWorkout(${item.sortedIndex})" class="row-edit" aria-label="DÃ¼zenle">DÃ¼zenle</button>
        <button onclick="deleteWorkout(${item.sortedIndex})" class="row-delete" aria-label="Sil">Ã—</button>
      </div>
    </div>
  `).join('');
}
function getWeeklyProgressData() {
  const weeks = {};

  (state.sleep || []).forEach(item => {
    const range = getWeekRange(item.date);
    const key = `${range.start}_${range.end}`;

    if (!weeks[key]) {
      weeks[key] = {
        start: range.start,
        end: range.end,
        sleep: 0,
        workouts: 0,
      };
    }

    weeks[key].sleep += Number(item.hours || 0);
  });

  (state.workouts || []).forEach(item => {
    const range = getWeekRange(item.date);
    const key = `${range.start}_${range.end}`;

    if (!weeks[key]) {
      weeks[key] = {
        start: range.start,
        end: range.end,
        sleep: 0,
        workouts: 0,
      };
    }

    weeks[key].workouts += Number(item.duration || 0);
  });

  Object.values(weeks).forEach(week => {
    const verified = VERIFIED_WEEK_TOTALS[week.start];
    week.recordedSleep = week.sleep;
    week.recordedWorkouts = week.workouts;
    week.verified = Boolean(verified);
    if (verified) {
      week.sleep = verified.sleep;
      week.workouts = verified.workouts;
      week.sleepNights = verified.sleepNights;
    }
  });

  return Object.values(weeks)
    .sort((a, b) => a.start.localeCompare(b.start));
}

function getWorkoutCategoriesForRange(range) {
  const categories = {};

  (state.workouts || [])
    .filter(item => item.date >= range.start && item.date <= range.end)
    .forEach(item => {
      const category = getWorkoutCategoryFromNote(item.note, item.type);
      categories[category] = (categories[category] || 0) + Number(item.duration || 0);
    });

  return Object.entries(categories)
    .sort((a, b) => b[1] - a[1]);
}

function getCurrentWeekWorkoutCategories() {
  return getWorkoutCategoriesForRange(getDashboardWeekRange());
}

function getVerifiedAdjustment(week, field) {
  if (!week?.verified) return 0;
  const recordedField = field === 'sleep' ? 'recordedSleep' : 'recordedWorkouts';
  return Number((Number(week[field] || 0) - Number(week[recordedField] || 0)).toFixed(1));
}

function getWeekDailyTotals(range) {
  const sleepByDay = {};
  const workoutByDay = {};
  const sleepRange = getSleepRangeForReportWeek(range);

  (state.sleep || [])
    .filter(item => item.date >= sleepRange.start && item.date <= sleepRange.end)
    .forEach(item => {
      sleepByDay[item.date] = (sleepByDay[item.date] || 0) + Number(item.hours || 0);
    });

  (state.workouts || [])
    .filter(item => item.date >= range.start && item.date <= range.end)
    .forEach(item => {
      if (!workoutByDay[item.date]) {
        workoutByDay[item.date] = {
          date: item.date,
          duration: 0,
          categories: {},
        };
      }

      const category = getWorkoutCategoryFromNote(item.note, item.type);
      workoutByDay[item.date].duration += Number(item.duration || 0);
      workoutByDay[item.date].categories[category] = (workoutByDay[item.date].categories[category] || 0) + Number(item.duration || 0);
    });

  return {
    sleep: Object.entries(sleepByDay)
      .map(([date, hours]) => ({ date, hours: Number(hours.toFixed(1)) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    workouts: Object.values(workoutByDay)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function getWeekInsights(current, range) {
  const totals = getWeekDailyTotals(range);
  const sleepDays = current.sleepNights || totals.sleep.length;
  const sleepAvg = sleepDays ? current.sleep / sleepDays : 0;
  const bestSleep = totals.sleep.reduce((best, item) => item.hours > (best?.hours || 0) ? item : best, null);
  const bestWorkout = totals.workouts.reduce((best, item) => item.duration > (best?.duration || 0) ? item : best, null);
  const categories = getWorkoutCategoriesForRange(range);
  const topCategory = categories[0];

  return {
    sleepAvg,
    sleepDays,
    bestSleep,
    workoutDays: totals.workouts.length,
    bestWorkout,
    topCategory,
  };
}

function renderProgressSummary() {
  const el = document.getElementById('progressSummary');
  if (!el) return;

  const weekly = getWeeklyProgressData();
  const current = weekly[weekly.length - 1] || { sleep: 0, workouts: 0 };
  const range = current.start ? current : getDashboardWeekRange();
  const rangeStart = parseIsoDateParts(range.start);
  const dayBeforeRange = new Date(rangeStart.year, rangeStart.month - 1, rangeStart.day - 1);
  const previousRange = getWeekRange(toLocalIsoDate(dayBeforeRange));
  const prev = weekly.find(item => item.start === previousRange.start);
  const previousDailyTotals = getWeekDailyTotals(previousRange);
  const measurements = getSortedMeasurements();
  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const previousMeasure = measurements[measurements.length - 2];
  const waistMeasurements = getWaistMeasurements();
  const firstWaist = waistMeasurements[0];
  const lastWaist = waistMeasurements[waistMeasurements.length - 1];
  const previousWaist = waistMeasurements[waistMeasurements.length - 2];

  const sleepPct = Math.min(100, Math.round((current.sleep / SLEEP_TARGET) * 100));
  const workoutPct = Math.min(100, Math.round((current.workouts / WORKOUT_TARGET) * 100));
  const sleepDiff = prev ? current.sleep - prev.sleep : 0;
  const workoutDiff = prev ? current.workouts - prev.workouts : 0;
  const weightDiff = first && last ? last.weight - first.weight : 0;
  const lastWeightDiff = previousMeasure && last ? last.weight - previousMeasure.weight : 0;
  const waistDiff = waistMeasurements.length >= 2 ? lastWaist.waist - firstWaist.waist : null;
  const lastWaistDiff = previousWaist && lastWaist ? lastWaist.waist - previousWaist.waist : null;
  const categories = getWorkoutCategoriesForRange(range);
  const categoryText = categories.length
    ? categories.map(([category, minutes]) => `${category}: ${formatMinutes(minutes)} dk`).join(' Â· ')
    : 'Bu hafta kategori verisi yok';
  const workoutAdjustment = getVerifiedAdjustment(current, 'workouts');
  const categoryAndAdjustmentText = workoutAdjustment
    ? `${categoryText} Â· Not defteri farkÄ±: ${workoutAdjustment > 0 ? '+' : ''}${formatMinutes(workoutAdjustment)} dk`
    : categoryText;
  const insights = getWeekInsights(current, range);
  const topCategoryLabel = insights.topCategory
    ? `${insights.topCategory[0]} Â· ${formatMinutes(insights.topCategory[1])} dk`
    : 'Veri bekleniyor';
  const bestSleepLabel = insights.bestSleep
    ? `${formatDate(insights.bestSleep.date)} Â· ${insights.bestSleep.hours} saat`
    : 'Veri bekleniyor';
  const bestWorkoutLabel = insights.bestWorkout
    ? `${formatDate(insights.bestWorkout.date)} Â· ${formatMinutes(insights.bestWorkout.duration)} dk`
    : 'Veri bekleniyor';

  const periodTitle = `${formatDate(range.start)} - ${formatDate(shiftIsoDate(range.end, 1))}`;
  const periodLabel = range.start === getWeekRange(today()).start ? 'Bu hafta' : 'Son aktif hafta';
  const sleepComparison = prev && previousDailyTotals.sleep.length
    ? `${sleepDiff >= 0 ? '+' : ''}${sleepDiff.toFixed(1)} saat / Ã¶nceki hafta`
    : 'Ã–nceki hafta kaydÄ± yok';
  const workoutComparison = prev && previousDailyTotals.workouts.length
    ? `${workoutDiff >= 0 ? '+' : ''}${formatMinutes(workoutDiff)} dk / Ã¶nceki hafta`
    : 'Ã–nceki hafta kaydÄ± yok';

  el.innerHTML = `
    <div class="progress-period">
      <span>${periodLabel}</span>
      <strong>${periodTitle}</strong>
    </div>
    <div class="progress-grid">
      <div class="progress-metric-card">
        <span>Uyku</span>
        <strong>${current.sleep.toFixed(1)} saat</strong>
        <div class="metric-track"><i style="width:${sleepPct}%"></i></div>
        <small>${sleepComparison}</small>
      </div>

      <div class="progress-metric-card">
          <span>Antrenman</span>
        <strong>${formatMinutes(current.workouts)} dk</strong>
        <div class="metric-track"><i style="width:${workoutPct}%"></i></div>
        <small>${workoutComparison}</small>
        <small>${categoryAndAdjustmentText}</small>
      </div>

      <div class="progress-metric-card">
        <span>Kilo</span>
        <strong>${last ? `${last.weight} kg` : 'â€”'}</strong>
        <small>Toplam: ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg Â· Son: ${lastWeightDiff > 0 ? '+' : ''}${lastWeightDiff.toFixed(1)} kg</small>
      </div>

      <div class="progress-metric-card">
        <span>Bel</span>
        <strong>${lastWaist ? `${lastWaist.waist} cm` : 'â€”'}</strong>
        <small>${waistDiff === null ? 'Her 4. tartÄ±da takip edilir' : `Toplam: ${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm Â· Son: ${lastWaistDiff === null ? 'â€”' : `${lastWaistDiff > 0 ? '+' : ''}${lastWaistDiff.toFixed(1)} cm`}`}</small>
      </div>
    </div>

    <div class="progress-insight-grid">
      <div class="progress-insight-card">
        <span>KayÄ±tlÄ± gÃ¼n ortalamasÄ±</span>
        <strong>${insights.sleepAvg.toFixed(1)} saat/gÃ¼n</strong>
        <small>${insights.sleepDays || 0} kayÄ±tlÄ± gÃ¼n Ã¼zerinden</small>
      </div>
      <div class="progress-insight-card">
        <span>En iyi uyku</span>
        <strong>${bestSleepLabel}</strong>
        <small>HaftanÄ±n en yÃ¼ksek uyku kaydÄ±</small>
      </div>
      <div class="progress-insight-card">
        <span>Antrenman yapÄ±lan gÃ¼n</span>
        <strong>${insights.workoutDays} gÃ¼n</strong>
        <small>Bu hafta antrenman yapÄ±lan gÃ¼n</small>
      </div>
      <div class="progress-insight-card">
        <span>Ã–ne Ã§Ä±kan kategori</span>
        <strong>${topCategoryLabel}</strong>
        <small>${bestWorkoutLabel}</small>
      </div>
    </div>
  `;
}
function renderProgressCharts() {
  const weekly = getWeeklyProgressData();

  const latestWeek = weekly[weekly.length - 1];

  const sleepWrap = document.getElementById('sleepBars');
  const workoutWrap = document.getElementById('workoutBars');

  if (!latestWeek) {
    setEmptyState(
      sleepWrap,
      'Uyku grafiÄŸi iÃ§in kayÄ±t bekleniyor',
      'Ä°lk uyku kaydÄ±nÄ± eklediÄŸinde haftalÄ±k uyku dÃ¼zenin burada gÃ¶rÃ¼nÃ¼r.',
      'Uyku Ekle',
      2
    );
    setEmptyState(
      workoutWrap,
      'Antrenman grafiÄŸi iÃ§in kayÄ±t bekleniyor',
      'Ä°lk antrenmanÄ± eklediÄŸinde sÃ¼re ve yoÄŸunluk daÄŸÄ±lÄ±mÄ± burada gÃ¶rÃ¼nÃ¼r.',
      'Antrenman Ekle',
      2
    );
    return;
  }

  if (sleepWrap) {
    const sleepData = getWeekDailyTotals(latestWeek).sleep;
    const sleepAvg = sleepData.length ? latestWeek.sleep / sleepData.length : 0;
    const bestSleep = sleepData.reduce((best, item) => item.hours > (best?.hours || 0) ? item : best, null);

    if (!sleepData.length) {
      setEmptyState(
        sleepWrap,
        'Bu hafta uyku kaydÄ± yok',
        'Bir uyku kaydÄ± eklediÄŸinde gÃ¼nlÃ¼k uyku dÃ¼zenin burada grafik olarak gÃ¶rÃ¼necek.',
        'Uyku Ekle',
        2
      );
    } else {
    sleepWrap.innerHTML = `
      <div class="chart-mini-head enhanced">
        <div>
          <strong>GÃ¼nlÃ¼k uyku daÄŸÄ±lÄ±mÄ±</strong>
          <span>Hedef aralÄ±k: 7-9 saat. KayÄ±tlÄ± gÃ¼n ortalamasÄ± ${sleepAvg.toFixed(1)} saat/gÃ¼n</span>
        </div>
        <em>${latestWeek.sleep.toFixed(1)} / ${SLEEP_TARGET} saat</em>
      </div>
      <div class="chart-stat-row">
        <div><span>KayÄ±tlÄ± gÃ¼n ort.</span><strong>${sleepAvg.toFixed(1)} saat</strong></div>
        <div><span>En iyi gÃ¼n</span><strong>${bestSleep ? `${getShortWeekday(bestSleep.date)} Â· ${formatDecimal(bestSleep.hours)} saat` : 'â€”'}</strong></div>
        <div><span>Durum</span><strong>${sleepAvg >= 7 ? 'Hedefte' : 'Eksik'}</strong></div>
      </div>
      <div class="bar-chart sleep-chart enhanced" style="--target-line: ${Math.min(100, (7 / 10) * 100)}%">
        ${sleepData.map(item => {
          const h = Math.min(140, Math.max(18, item.hours * 14));
          const quality = getSleepQuality(item.hours);

          return `
            <div class="bar-item">
              <div class="bar-fill sleep" style="height:${h}px" title="${formatDecimal(item.hours)} saat Â· ${quality}">
                <span>${formatDecimal(item.hours)} saat</span>
              </div>
              <div class="bar-label">
                ${getShortWeekday(item.date)}
              </div>
              <div class="bar-value">${quality}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    }
  }

  if (workoutWrap) {
    const workoutData = getWeekDailyTotals(latestWeek).workouts;
    const categories = getWorkoutCategoriesForRange(latestWeek);
    const recordedCategoryText = categories.length
      ? categories.map(([category, duration]) => `${category}: ${formatMinutes(duration)} dk`).join(' Â· ')
      : 'Kategori verisi bekleniyor';
    const workoutAdjustment = getVerifiedAdjustment(latestWeek, 'workouts');
    const categoryText = workoutAdjustment
      ? `${recordedCategoryText} Â· Not defteri farkÄ±: ${workoutAdjustment > 0 ? '+' : ''}${formatMinutes(workoutAdjustment)} dk`
      : recordedCategoryText;
    const bestWorkout = workoutData.reduce((best, item) => item.duration > (best?.duration || 0) ? item : best, null);
    const workoutDays = workoutData.length;

    if (!workoutData.length) {
      setEmptyState(
        workoutWrap,
        'Bu hafta antrenman kaydÄ± yok',
        'Antrenman eklediÄŸinde sÃ¼re, kategori ve haftalÄ±k daÄŸÄ±lÄ±m burada gÃ¶rÃ¼nÃ¼r.',
        'Antrenman Ekle',
        2
      );
    } else {
    workoutWrap.innerHTML = `
      <div class="chart-mini-head enhanced">
        <div>
          <strong>GÃ¼nlÃ¼k antrenman daÄŸÄ±lÄ±mÄ±</strong>
          <span>${categoryText}</span>
        </div>
        <em>${workoutDays} antrenman gÃ¼nÃ¼</em>
      </div>
      <div class="chart-stat-row">
        <div><span>Antrenman yapÄ±lan gÃ¼n</span><strong>${workoutDays} gÃ¼n</strong></div>
        <div><span>En yoÄŸun gÃ¼n</span><strong>${bestWorkout ? `${getShortWeekday(bestWorkout.date)} Â· ${formatMinutes(bestWorkout.duration)} dk` : 'â€”'}</strong></div>
        <div><span>Odak</span><strong>${categories[0] ? categories[0][0] : 'â€”'}</strong></div>
      </div>
      <div class="bar-chart workout-chart enhanced">
        ${workoutData.map(item => {
          const h = Math.min(140, Math.max(18, item.duration * 1.35));
          const category = Object.entries(item.categories)
            .sort((a, b) => b[1] - a[1])
            .map(([name, duration]) => `${name}: ${formatMinutes(duration)} dk`)
            .join(' Â· ');

          return `
            <div class="bar-item">
              <div class="bar-fill workout" style="height:${h}px" title="${category}">
                <span>${formatMinutes(item.duration)} dk</span>
              </div>
              <div class="bar-label">
                ${getShortWeekday(item.date)}
              </div>
              <div class="bar-value">${Object.entries(item.categories)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Antrenman'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    }
  }
}
function renderProgressList() {
  const el = document.getElementById('progressList');
  if (!el) return;

  const data = getWeeklyProgressData()
    .sort((a, b) => b.start.localeCompare(a.start));

  if (!data.length) {
    setEmptyState(
      el,
      'HaftalÄ±k rapor henÃ¼z yok',
      'Uyku ve antrenman kayÄ±tlarÄ± geldikÃ§e haftalÄ±k Ã¶zetler burada gÃ¶rÃ¼nÃ¼r.'
    );
    return;
  }

  el.innerHTML = `
    <div class="weekly-report-list">
      ${data.map(item => {
        const sleepPct = Math.min(100, Math.round((item.sleep / SLEEP_TARGET) * 100));
        const workoutPct = Math.min(100, Math.round((item.workouts / WORKOUT_TARGET) * 100));
        const isStrong = sleepPct >= 90 && workoutPct >= 90;
        const isLight = sleepPct < 65 || workoutPct < 65;
        const status = isStrong ? 'GÃ¼Ã§lÃ¼ hafta' : isLight ? 'Takviye gerekli' : 'Dengeli';
        const categories = getWorkoutCategoriesForRange(item);
        const categorySummary = categories.length
          ? categories.slice(0, 2).map(([name, minutes]) => `${name} ${formatMinutes(minutes)} dk`).join(' Â· ')
          : 'Kategori bekleniyor';
        const workoutDays = new Set(
          state.workouts
            .filter(workout => workout.date >= item.start && workout.date <= item.end)
            .map(workout => workout.date)
        ).size;
        const workoutRecords = state.workouts
          .filter(workout => workout.date >= item.start && workout.date <= item.end).length;
        const sleepDays = item.sleepNights || getWeekDailyTotals(item).sleep.length;
        const workoutAdjustment = getVerifiedAdjustment(item, 'workouts');
        const verifiedNote = item.verified
          ? `Not defteri doÄŸrulandÄ±${workoutAdjustment ? ` Â· sÃ¼re farkÄ± ${workoutAdjustment > 0 ? '+' : ''}${formatMinutes(workoutAdjustment)} dk` : ''}`
          : '';
        const workoutMetric = workoutDays
          ? `${formatMinutes(item.workouts)} dk Â· ${workoutDays} gÃ¼n Â· ${workoutRecords} kayÄ±t`
          : 'KayÄ±t yok';

        return `
          <div class="weekly-report-row">
            <div>
              <strong>${formatDate(item.start)} - ${formatDate(shiftIsoDate(item.end, 1))}</strong>
              <span>${status}</span>
              <small>${categorySummary}</small>
              ${verifiedNote ? `<small>${verifiedNote}</small>` : ''}
            </div>
            <div class="weekly-report-metrics">
              <div>
                <span>Uyku</span>
                <strong>${item.sleep.toFixed(1)} saat</strong>
                <small>${sleepDays}/7 gece${item.verified ? ' Â· doÄŸrulandÄ±' : ''}</small>
                <i><b style="width:${sleepPct}%"></b></i>
              </div>
              <div>
                <span>Antrenman</span>
                <strong>${workoutMetric}</strong>
                <i><b style="width:${workoutPct}%"></b></i>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSettings() {
  normalizeProfileState();

  const nameEl = document.getElementById('settingsName');
  const startEl = document.getElementById('settingsStartDate');
  const emailEl = document.getElementById('settingsEmail');
  const startWeightEl = document.getElementById('settingsStartWeight');
  const currentWeightEl = document.getElementById('settingsCurrentWeight');
  const currentWaistEl = document.getElementById('settingsCurrentWaist');
  const firstGoalEl = document.getElementById('settingsFirstGoal');
  const finalGoalEl = document.getElementById('settingsFinalGoal');
  const syncEl = document.getElementById('settingsSyncState');
  const lastSyncEl = document.getElementById('settingsLastSync');
  const pendingSyncEl = document.getElementById('settingsPendingSync');
  const syncErrorEl = document.getElementById('settingsSyncError');
  const syncNowBtn = document.getElementById('syncNowBtn');
  const profileThemeToggle = document.getElementById('profileThemeToggle');
  const measureReminderToggle = document.getElementById('measureReminderToggle');
  const dailyReminderToggle = document.getElementById('dailyReminderToggle');

  const measurements = getSortedMeasurements();
  const firstMeasurement = measurements[0];
  const lastMeasurement = measurements[measurements.length - 1];
  const lastWaistMeasurement = getLatestWaistMeasurement();
  const goals = (state.milestones || [])
    .map(Number)
    .filter(value => Number.isFinite(value));
  const firstGoal = goals[0];
  const finalGoal = Number.isFinite(Number(state.goalWeight))
    ? Number(state.goalWeight)
    : goals[goals.length - 1];

  if (nameEl) nameEl.textContent = state.name || 'Sporcu';
  if (startEl) startEl.textContent = formatDate(state.startDate || START_DATE);
  if (emailEl) emailEl.textContent = state.userEmail || 'â€”';
  if (startWeightEl) {
    const startWeight = state.startWeight ?? firstMeasurement?.weight;
    startWeightEl.textContent = Number.isFinite(Number(startWeight)) ? `${Number(startWeight).toFixed(1)} kg` : 'â€” kg';
  }
  if (currentWeightEl) {
    currentWeightEl.textContent = lastMeasurement?.weight ? `${Number(lastMeasurement.weight).toFixed(1)} kg` : 'â€” kg';
  }
  if (currentWaistEl) {
    currentWaistEl.textContent = lastWaistMeasurement?.waist ? `${Number(lastWaistMeasurement.waist).toFixed(1)} cm` : 'AylÄ±k takip';
  }
  if (firstGoalEl) firstGoalEl.textContent = firstGoal ? `${firstGoal} kg` : 'Belirlenmedi';
  if (finalGoalEl) finalGoalEl.textContent = finalGoal ? `${finalGoal} kg` : 'Belirlenmedi';
  const syncMeta = ensureSyncMeta();
  const pendingCount = getPendingSyncCount();
  if (syncEl) {
    syncEl.textContent = cloudSyncInProgress
      ? 'Senkronize ediliyor'
      : !navigator.onLine
        ? 'Ã‡evrimdÄ±ÅŸÄ± kayÄ±t'
        : syncMeta.lastError
          ? 'Kontrol gerekli'
          : 'Cloud hazÄ±r';
  }
  if (lastSyncEl) lastSyncEl.textContent = formatSyncTimestamp(syncMeta.lastSuccess);
  if (pendingSyncEl) pendingSyncEl.textContent = `${pendingCount} deÄŸiÅŸiklik`;
  if (syncErrorEl) {
    syncErrorEl.hidden = !syncMeta.lastError;
    syncErrorEl.textContent = syncMeta.lastError ? `Son hata: ${syncMeta.lastError}` : '';
  }
  if (syncNowBtn) {
    syncNowBtn.disabled = cloudSyncInProgress || !navigator.onLine || !hasActiveUser();
    syncNowBtn.classList.toggle('is-syncing', cloudSyncInProgress);
    const label = syncNowBtn.querySelector('span');
    if (label) label.textContent = cloudSyncInProgress ? 'Senkronize Ediliyor' : 'Åimdi Senkronize Et';
  }
  if (profileThemeToggle) profileThemeToggle.checked = state.theme === 'dark';
  if (measureReminderToggle) measureReminderToggle.checked = Boolean(state.preferences?.measureReminder);
  if (dailyReminderToggle) dailyReminderToggle.checked = Boolean(state.preferences?.dailyReminder);
}

function renderAll() {
  normalizeProfileState();

  [
    renderHero,
    renderMoti,
    renderDashboardWeekLabel,
    renderDashboardGoalCard,
    renderStats,
    renderMeasurementChart,
    renderWeightSummary,
    renderWeightList,
    renderNotes,
    renderDailyViewControls,
    renderSleepSummary,
    renderSleepList,
    renderWorkoutSummary,
    renderWorkoutList,
    updateWorkoutGuidance,
    renderProgressSummary,
    renderProgressCharts,
    renderProgressList,
    renderSettings,
    syncMeasureFormDate,
    applyTheme,
    clearInitialLoadingStatus,
  ].forEach(renderFn => {
    try {
      renderFn();
    } catch (error) {
      console.error('Render hatasÄ±:', renderFn.name, error);
    }
  });
}

// Ã¢â€â‚¬Ã¢â€â‚¬ SUPABASE DATA Ã¢â€â‚¬Ã¢â€â‚¬
function getProfileCloudPayload() {
  return {
    user_id: getUserId(),
    name: String(state.name || '').trim(),
    start_date: state.startDate || START_DATE,
    start_weight: parseOptionalNumber(state.startWeight),
    start_waist: parseOptionalNumber(state.startWaist),
    first_goal: parseOptionalNumber((state.milestones || [])[0]),
    goal_weight: parseOptionalNumber(state.goalWeight),
    preferences: {
      measureReminder: state.preferences?.measureReminder ?? true,
      dailyReminder: state.preferences?.dailyReminder ?? false,
    },
    updated_at: new Date().toISOString(),
  };
}

async function saveProfileToSupabase() {
  const { error } = await db
    .from('app_profiles')
    .upsert(getProfileCloudPayload(), { onConflict: 'user_id' });

  if (error) throw error;
  ensureSyncMeta().pendingProfile = false;
  stateSave();
}

async function loadProfileFromSupabase() {
  const { data, error } = await db
    .from('app_profiles')
    .select('*')
    .eq('user_id', getUserId())
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    ensureSyncMeta().pendingProfile = true;
    stateSave();
    return;
  }

  state.name = data.name || state.name;
  state.startDate = data.start_date || state.startDate || START_DATE;
  state.startWeight = parseOptionalNumber(data.start_weight);
  state.startWaist = parseOptionalNumber(data.start_waist);

  const firstGoal = parseOptionalNumber(data.first_goal);
  const finalGoal = parseOptionalNumber(data.goal_weight);
  if (firstGoal !== null && finalGoal !== null) {
    state.goalWeight = finalGoal;
    state.milestones = [firstGoal, finalGoal];
  }

  if (data.preferences && typeof data.preferences === 'object') {
    state.preferences = {
      measureReminder: data.preferences.measureReminder ?? true,
      dailyReminder: data.preferences.dailyReminder ?? false,
    };
  }

  ensureSyncMeta().pendingProfile = false;
  stateSave();
  renderAll();
}

async function loadMeasurementsFromSupabase() {
  const localMeasurements = [...(state.measurements || [])];
  const { data, error } = await db
    .from('measurements')
    .select('*')
    .eq('user_id', getUserId())
    .order('date', { ascending: false });

  if (error) {
    console.error('Supabase load hatasÄ±:', error);
    setStatus('Cloud veri yÃ¼klenemedi', 'error');
    throw error;
  }

  const cloudMeasurements = (data || []).map(item => ({
    date: item.date,
    weight: parseFloat(item.weight),
    waist: parseOptionalNumber(item.waist),
  })).filter(item => !isRecordDeleted('measurements', item));

  const localOnlyMeasurements = localMeasurements.filter(local =>
    !isRecordDeleted('measurements', local) &&
    !cloudMeasurements.some(cloud => cloud.date === local.date)
  );

  localOnlyMeasurements.forEach(item => markPendingSync('measurements', item.date));

  state.measurements = [...cloudMeasurements, ...localOnlyMeasurements]
    .sort((a, b) => a.date.localeCompare(b.date));

  stateSave();
  renderAll();
  console.log('Supabase verileri yÃ¼klendi:', data);
}

async function loadSleepFromSupabase() {
  const localSleep = Array.isArray(state.sleep) ? [...state.sleep] : [];

  const { data, error } = await db
    .from('sleep_logs')
    .select('*')
    .eq('user_id', getUserId())
    .order('date', { ascending: false });

  if (error) {
    console.error('Sleep load hatasÄ±:', error);
    setStatus('Uyku verileri yÃ¼klenemedi', 'error');
    throw error;
  }

  const cloudSleep = (data || []).map(item => ({
    id: item.id,
    date: item.date,
    hours: parseFloat(item.hours),
  })).filter(item => !isRecordDeleted('sleep', item));

  const localOnlySleep = localSleep.filter(local =>
    !isRecordDeleted('sleep', local) &&
    !cloudSleep.some(cloud => cloud.date === local.date)
  );

  localOnlySleep.forEach(item => markPendingSync('sleep', item.date));

  state.sleep = [...cloudSleep, ...localOnlySleep]
    .sort((a, b) => b.date.localeCompare(a.date));

  stateSave();
  renderAll();
}

async function loadWorkoutsFromSupabase() {
  const localWorkouts = Array.isArray(state.workouts) ? [...state.workouts] : [];

  const { data, error } = await db
    .from('workout_logs')
    .select('*')
    .eq('user_id', getUserId())
    .order('date', { ascending: false });

  if (error) {
    console.error('Workout load hatasÄ±:', error);
    setStatus('Antrenman verileri yÃ¼klenemedi', 'error');
    throw error;
  }

  const cloudWorkouts = (data || []).map(item => ({
    id: item.id,
    date: item.date,
    type: item.type,
    duration: Number(item.duration),
    note: item.note || '',
  })).filter(item => !isRecordDeleted('workouts', item));

  const localOnlyWorkouts = localWorkouts.filter(local =>
    !isRecordDeleted('workouts', local) &&
    !isCloudRecordId(local.id) &&
    !cloudWorkouts.some(cloud => cloud.id === local.id)
  );

  state.workouts = [...cloudWorkouts, ...localOnlyWorkouts]
    .sort((a, b) => b.date.localeCompare(a.date));

  stateSave();
  renderAll();
}

async function loadNotesFromSupabase() {
  const localNotes = Array.isArray(state.notes) ? [...state.notes] : [];

  const { data, error } = await db
    .from('notes')
    .select('*')
    .eq('user_id', getUserId())
    .order('date', { ascending: false });

  if (error) {
    console.error('Notes load hatasÄ±:', error);
    setStatus('Notlar yÃ¼klenemedi', 'error');
    throw error;
  }

  const cloudNotes = (data || []).map(item => ({
    id: item.id,
    date: item.date,
    text: item.text,
  })).filter(item => !isRecordDeleted('notes', item));

  const localOnlyNotes = localNotes.filter(local =>
    !isRecordDeleted('notes', local) &&
    !isCloudRecordId(local.id) &&
    !cloudNotes.some(cloud => cloud.id === local.id)
  );

  state.notes = [...cloudNotes, ...localOnlyNotes]
    .sort((a, b) => b.date.localeCompare(a.date));

  stateSave();
  renderAll();
}


async function flushPendingDeletes() {
  const userId = getUserId();
  const buckets = state.deletedRecords || {};

  const runDelete = async query => {
    const { error } = await query;
    if (error) throw new Error(`Silme iÅŸlemi: ${getSyncErrorMessage(error)}`);
  };

  for (const key of buckets.measurements || []) {
    if (!key.startsWith('date:')) continue;
    const date = key.slice(5);
    await runDelete(db.from('measurements').delete().eq('user_id', userId).eq('date', date));
    clearPendingSync('measurements', date);
  }

  for (const key of buckets.sleep || []) {
    if (isCloudRecordId(key)) {
      await runDelete(db.from('sleep_logs').delete().eq('user_id', userId).eq('id', key));
    } else if (key.startsWith('date:')) {
      const date = key.slice(5);
      await runDelete(db.from('sleep_logs').delete().eq('user_id', userId).eq('date', date));
      clearPendingSync('sleep', date);
    }
  }

  for (const key of buckets.workouts || []) {
    if (isCloudRecordId(key)) {
      await runDelete(db.from('workout_logs').delete().eq('user_id', userId).eq('id', key));
    }
  }

  for (const key of buckets.notes || []) {
    if (isCloudRecordId(key)) {
      await runDelete(db.from('notes').delete().eq('user_id', userId).eq('id', key));
    }
  }

  state.deletedRecords = { measurements: [], sleep: [], workouts: [], notes: [] };
}

async function pushLocalPendingToSupabase() {
  if (!canUseCloud()) return { ok: false, error: new Error('Ã‡evrimdÄ±ÅŸÄ±') };

  const syncMeta = ensureSyncMeta();
  if (syncMeta.pendingProfile) {
    await runSyncStage('Profil ve hedefleri gonderme', saveProfileToSupabase);
  }
  const pendingMeasurementDates = new Set(syncMeta.pendingMeasurements);
  const measurements = getSortedMeasurements()
    .filter(item => pendingMeasurementDates.has(item.date));
  for (const item of measurements) {
    if (isRecordDeleted('measurements', item)) continue;
    const { error } = await runSyncStage('Ã–lÃ§Ã¼m gÃ¶nderme', () => saveMeasurementToSupabase({
      user_id: getUserId(),
      date: item.date,
      weight: Number(item.weight),
      waist: parseOptionalNumber(item.waist),
    }));
    if (error) throw new Error(`Ã–lÃ§Ã¼m gÃ¶nderme: ${getSyncErrorMessage(error)}`);
    clearPendingSync('measurements', item.date);
  }

  const pendingSleepDates = new Set(syncMeta.pendingSleep);
  const sleepItems = (Array.isArray(state.sleep) ? state.sleep : [])
    .filter(item => pendingSleepDates.has(item.date));
  for (const item of sleepItems) {
    if (isRecordDeleted('sleep', item)) continue;
    const { error } = await runSyncStage('Uyku kaydÄ± gÃ¶nderme', () => saveSleepToSupabase({
      user_id: getUserId(),
      date: item.date,
      hours: Number(item.hours || 0),
    }));
    if (error) throw new Error(`Uyku kaydÄ± gÃ¶nderme: ${getSyncErrorMessage(error)}`);
    clearPendingSync('sleep', item.date);
  }

  const localWorkouts = (Array.isArray(state.workouts) ? state.workouts : [])
    .filter(item => item?.id && String(item.id).startsWith('local-workout-') && !isRecordDeleted('workouts', item));

  for (const item of localWorkouts) {
    const { data, error } = await db
      .from('workout_logs')
      .insert([{
        user_id: getUserId(),
        date: item.date,
        type: item.type,
        duration: Number(item.duration || 0),
        note: item.note || '',
      }])
      .select()
      .single();

    if (error) throw error;
    if (data?.id) item.id = data.id;
  }

  const localNotes = (Array.isArray(state.notes) ? state.notes : [])
    .filter(item => item?.id && String(item.id).startsWith('local-note-') && !isRecordDeleted('notes', item));

  for (const item of localNotes) {
    const { data, error } = await db
      .from('notes')
      .insert([{
        user_id: getUserId(),
        date: item.date,
        text: item.text,
      }])
      .select()
      .single();

    if (error) throw error;
    if (data?.id) item.id = data.id;
  }

  await flushPendingDeletes();
  stateSave();
  return { ok: true };
}

async function loadAllCloudData({ force = false } = {}) {
  if (!hasActiveUser() || !navigator.onLine) return { ok: false, results: [] };
  if (!force && !state.onboarded) return { ok: false, results: [] };
  if (cloudSyncInProgress) return { ok: false, busy: true, results: [] };

  cloudSyncInProgress = true;
  const syncMeta = ensureSyncMeta();
  syncMeta.lastAttempt = new Date().toISOString();
  syncMeta.lastError = '';
  setSyncDot('busy');
  renderSettings();

  try {
    const results = await Promise.allSettled([
      runSyncStage('Profil ve hedefleri okuma', loadProfileFromSupabase),
      runSyncStage('Ã–lÃ§Ã¼mleri okuma', loadMeasurementsFromSupabase),
      runSyncStage('Uyku kayÄ±tlarÄ±nÄ± okuma', loadSleepFromSupabase),
      runSyncStage('AntrenmanlarÄ± okuma', loadWorkoutsFromSupabase),
      runSyncStage('NotlarÄ± okuma', loadNotesFromSupabase),
    ]);

    const rejected = results.find(result => result.status === 'rejected');
    if (rejected) throw rejected.reason;

    recoverOnboardingFromData();
    normalizeProfileState();
    await runSyncStage('Bekleyen kayÄ±tlarÄ± gÃ¶nderme', pushLocalPendingToSupabase);

    syncMeta.lastSuccess = new Date().toISOString();
    syncMeta.lastError = '';
    stateSave();
    setStatus('Senkron tamamlandÄ±', 'ok');
    setSyncDot('ok');
    renderAll();
    return { ok: true, results };
  } catch (error) {
    syncMeta.lastError = getSyncErrorMessage(error);
    stateSave();
    setStatus('Senkron tamamlanamadÄ± - yerel kayÄ±tlar korunuyor', 'error');
    setSyncDot('err');
    renderSettings();
    console.warn('Cloud sync failed:', error);
    return { ok: false, error, results: [] };
  } finally {
    cloudSyncInProgress = false;
    renderSettings();
  }
}

async function saveMeasurementToSupabase(payload) {
  const { data: existingRows, error: lookupError } = await db
    .from('measurements')
    .select('id')
    .eq('user_id', payload.user_id)
    .eq('date', payload.date)
    .limit(1);

  if (lookupError) return { error: lookupError };

  if (existingRows && existingRows.length) {
    return db
      .from('measurements')
      .update({
        weight: payload.weight,
        waist: payload.waist,
      })
      .eq('id', existingRows[0].id);
  }

  return db
    .from('measurements')
    .insert([payload]);
}

function saveMeasurementLocally(payload) {
  if (!Array.isArray(state.measurements)) state.measurements = [];
  unmarkRecordDeleted('measurements', payload);
  markPendingSync('measurements', payload.date);

  const nextMeasurement = {
    date: payload.date,
    weight: payload.weight,
    waist: payload.waist,
  };

  const existingIndex = state.measurements.findIndex(item => item.date === payload.date);

  if (existingIndex >= 0) {
    state.measurements[existingIndex] = {
      ...state.measurements[existingIndex],
      ...nextMeasurement,
    };
  } else {
    state.measurements.push(nextMeasurement);
  }

  state.measurements = getSortedMeasurements();
  stateSave();
  renderAll();
}

async function saveSleepToSupabase(payload) {
  const { data: existingRows, error: lookupError } = await db
    .from('sleep_logs')
    .select('id')
    .eq('user_id', payload.user_id)
    .eq('date', payload.date)
    .limit(1);

  if (lookupError) return { error: lookupError };

  if (existingRows && existingRows.length) {
    return db
      .from('sleep_logs')
      .update({ hours: payload.hours })
      .eq('id', existingRows[0].id);
  }

  return db
    .from('sleep_logs')
    .insert([payload]);
}

function saveSleepLocally(payload) {
  if (!Array.isArray(state.sleep)) state.sleep = [];
  unmarkRecordDeleted('sleep', payload);
  markPendingSync('sleep', payload.date);

  const nextSleep = {
    id: payload.id || `local-sleep-${payload.date}`,
    date: payload.date,
    hours: payload.hours,
  };

  const existingIndex = state.sleep.findIndex(item => item.date === payload.date);

  if (existingIndex >= 0) {
    state.sleep[existingIndex] = {
      ...state.sleep[existingIndex],
      ...nextSleep,
    };
  } else {
    state.sleep.push(nextSleep);
  }

  state.sleep = [...state.sleep].sort((a, b) => b.date.localeCompare(a.date));
  stateSave();
  renderAll();
}

function saveWorkoutLocally(payload) {
  if (!Array.isArray(state.workouts)) state.workouts = [];
  unmarkRecordDeleted('workouts', payload);

  const id = payload.id || `local-workout-${Date.now()}`;
  state.workouts.push({
    id,
    date: payload.date,
    type: payload.type,
    duration: payload.duration,
    note: payload.note || '',
  });

  state.workouts = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));
  stateSave();
  renderAll();
  return id;
}

function saveNoteLocally(payload) {
  if (!Array.isArray(state.notes)) state.notes = [];
  unmarkRecordDeleted('notes', payload);

  const id = payload.id || `local-note-${Date.now()}`;
  state.notes.push({
    id,
    date: payload.date,
    text: payload.text,
  });

  state.notes = [...state.notes].sort((a, b) => b.date.localeCompare(a.date));
  stateSave();
  renderAll();
  return id;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ ACTIONS Ã¢â€â‚¬Ã¢â€â‚¬
async function saveMeasurementFromForm() {
  const dateInput = document.getElementById('measureDateInput');
  const weightInput = document.getElementById('measureWeightInput');
  const waistInput = document.getElementById('measureWaistInput');

  if (!dateInput || !weightInput || !waistInput) return;

  const date = dateInput.value || getSuggestedMeasureDate();
  const weight = parseLocaleNumber(weightInput.value);
  const waistRaw = waistInput.value.trim();
  const isWaistWeek = shouldTrackWaist(date);
  const waist = isWaistWeek && waistRaw ? parseLocaleNumber(waistRaw) : null;

  if (!date || Number.isNaN(weight) || weight <= 0) {
    alert('GeÃ§erli bir kilo gir.');
    return;
  }

  if (date < START_DATE) {
    alert('BaÅŸlangÄ±Ã§ tarihi 31 MayÄ±s 2026. Bu tarihten Ã¶nce Ã¶lÃ§Ã¼m eklenemez.');
    return;
  }

  if (waist !== null && (Number.isNaN(waist) || waist <= 0)) {
    alert('GeÃ§erli bir bel Ã¶lÃ§Ã¼mÃ¼ gir.');
    return;
  }

  if (isWaistWeek && waist === null) {
    alert(getMeasurementSequenceNumber(date) === 1
      ? 'BaÅŸlangÄ±Ã§ tartÄ±sÄ±nda bel Ã¶lÃ§Ã¼mÃ¼nÃ¼ de ekle.'
      : 'Bu 4. tartÄ± gÃ¼nÃ¼. LÃ¼tfen bel Ã¶lÃ§Ã¼mÃ¼nÃ¼ de ekle.');
    return;
  }

  if (new Date(date).getDay() !== WEEKLY_MEASURE_DAY) {
    const ok = confirm('Ã–lÃ§Ã¼mler pazar gÃ¼nÃ¼ alÄ±nacak ÅŸekilde planlandÄ±. Yine de bu tarihe kayÄ±t eklemek ister misin?');
    if (!ok) return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    weight: parseFloat(weight.toFixed(1)),
    waist: waist === null ? null : parseFloat(waist.toFixed(1)),
  };

  saveMeasurementLocally(payload);
  setStatus('Ã–lÃ§Ã¼m kaydedildi âœ“', 'ok');

  weightInput.value = '';
  waistInput.value = '';
  dateInput.value = getSuggestedMeasureDate();
  updateWaistHint();

  if (!canUseCloud()) return;

  const { error } = await saveMeasurementToSupabase(payload);

  if (error) {
    console.error('Measurement save error:', error);
    recordSyncError(error);
    setStatus('Ã–lÃ§Ã¼m yerel kaydedildi - cloud izni kontrol edilecek', 'ok');
  } else {
    recordSyncSuccess('measurements', payload.date);
    await loadMeasurementsFromSupabase();
  }
}

async function addMeasurement() {
  if (document.getElementById('measureDateInput')) {
    await saveMeasurementFromForm();
    return;
  }

  const dateInput = prompt('Ã–lÃ§Ã¼m tarihi gir (gg/aa/yyyy):', todayDisplay());
  if (!dateInput) return;

  const date = parseDisplayDate(dateInput);
  if (!date) {
    alert('Tarih formatÄ± hatalÄ±. Ã–rnek: 27/04/2026 veya 27.04.2026');
    return;
  }

  if (date < START_DATE) {
    alert('BaÅŸlangÄ±Ã§ tarihi 31 MayÄ±s 2026. Bu tarihten Ã¶nce Ã¶lÃ§Ã¼m eklenemez.');
    return;
  }

  if (!Array.isArray(state.measurements)) state.measurements = [];

  const alreadyExists = state.measurements.some(item => item.date === date);

  if (alreadyExists) {
    alert('Bu tarih iÃ§in zaten kayÄ±t var. Ã–nce mevcut kaydÄ± silmelisin.');
    return;
  }

  const weightInput = prompt('Kilonu gir (kg):');
  const weight = parseLocaleNumber(weightInput);
  if (!weightInput || Number.isNaN(weight)) return;

  const waistInput = prompt(
    shouldTrackWaist(date)
      ? 'Bu 4. tartÄ± gÃ¼nÃ¼. Bel Ã¶lÃ§Ã¼nÃ¼ gir (cm):'
      : 'Bel Ã¶lÃ§Ã¼nÃ¼ gir (cm, opsiyonel):'
  );
  const waist = waistInput ? parseLocaleNumber(waistInput) : null;
  if (shouldTrackWaist(date) && (!waistInput || Number.isNaN(waist))) return;
  if (waistInput && Number.isNaN(waist)) return;

  const measurement = {
    date,
    weight: parseFloat(weight.toFixed(1)),
    waist: waistInput ? parseFloat(waist.toFixed(1)) : null,
    user_id: getUserId(),
  };

  saveMeasurementLocally(measurement);
  setStatus('Ã–lÃ§Ã¼m eklendi âœ“', 'ok');

  if (!canUseCloud()) return;

  const { error } = await saveMeasurementToSupabase(measurement);

  if (error) {
    console.error('Supabase insert hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Ã–lÃ§Ã¼m yerel kaydedildi - cloud izni kontrol edilecek', 'ok');
  } else {
    recordSyncSuccess('measurements', measurement.date);
    await loadMeasurementsFromSupabase();
  }
}

async function deleteWeight(sortedIdx) {
  if (!confirm('Bu Ã¶lÃ§Ã¼mÃ¼ silmek istediÄŸinden emin misin?')) return;

  const sorted = [...(state.measurements || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const target = sorted[sortedIdx];

  if (!target) return;

  markRecordDeleted('measurements', target);
  state.measurements = (state.measurements || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Ã–lÃ§Ã¼m silindi âœ“', 'ok');

  if (!canUseCloud()) return;

  const { error } = await db
    .from('measurements')
    .delete()
    .eq('user_id', getUserId())
    .eq('date', target.date);

  if (error) {
    console.error('Supabase delete hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Ã–lÃ§Ã¼m cihazdan silindi - cloud izni kontrol edilecek', 'ok');
    return;
  }
  unmarkRecordDeleted('measurements', target);
  recordSyncSuccess();
}

async function deleteNote(index) {
  if (!confirm('Bu notu silmek istediÄŸinden emin misin?')) return;

  const target = state.notes[index];
  if (!target) return;

  markRecordDeleted('notes', target);
  state.notes = (state.notes || []).filter((_, itemIndex) => itemIndex !== index);
  stateSave();
  renderAll();
  setStatus('Not silindi âœ“', 'ok');

  if (!isCloudRecordId(target.id)) return;
  if (!canUseCloud()) return;

  const { error } = await db
    .from('notes')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Note silme hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Not cihazdan silindi - cloud izni kontrol edilecek', 'ok');
    return;
  }
  unmarkRecordDeleted('notes', target);
  recordSyncSuccess();
}

async function deleteSleep(sortedIdx) {
  if (!confirm('Bu uyku kaydÄ±nÄ± silmek istediÄŸinden emin misin?')) return;

  const sorted = [...(state.sleep || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  markRecordDeleted('sleep', target);
  state.sleep = (state.sleep || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Uyku kaydÄ± silindi âœ“', 'ok');

  if (!isCloudRecordId(target.id)) return;
  if (!canUseCloud()) return;

  const { error } = await db
    .from('sleep_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Sleep silme hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Uyku cihazdan silindi - cloud izni kontrol edilecek', 'ok');
    return;
  }
  unmarkRecordDeleted('sleep', target);
  recordSyncSuccess();
}

async function addNote() {
  const noteInput = document.getElementById('noteInput');
  const text = noteInput ? noteInput.value : prompt('Not gir:');
  if (!text || !text.trim()) return;

  const payload = {
    user_id: getUserId(),
    date: today(),
    text: text.trim(),
  };

  const localId = saveNoteLocally(payload);
  setStatus('Not eklendi âœ“', 'ok');
  if (noteInput) noteInput.value = '';

  if (!canUseCloud()) return;

  const { data, error } = await db
    .from('notes')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Note kayÄ±t hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Not yerel kaydedildi - cloud izni kontrol edilecek', 'ok');
    return;
  }

  const localNote = state.notes.find(item => item.id === localId);
  if (localNote && data?.id) localNote.id = data.id;
  recordSyncSuccess();

  await loadNotesFromSupabase();
}

async function saveSleep() {
  const dateInput = document.getElementById('sleepDateInput');
  const hourInput = document.getElementById('sleepInput');

  if (!dateInput || !hourInput) return;

  const date = dateInput.value || today();
  const hours = parseLocaleNumber(hourInput.value);

  if (!hours || hours <= 0) {
    alert('GeÃ§erli bir uyku saati gir');
    return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    hours: parseFloat(hours.toFixed(1)),
  };

  saveSleepLocally(payload);
  setStatus('Uyku kaydedildi âœ“', 'ok');
  hourInput.value = '';
  dateInput.value = today();

  if (!canUseCloud()) return;

  const { error } = await saveSleepToSupabase(payload);

  if (error) {
    console.error('Sleep kayÄ±t hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Uyku yerel kaydedildi - cloud izni kontrol edilecek', 'ok');
    return;
  }

  recordSyncSuccess('sleep', payload.date);
  await loadSleepFromSupabase();
}

async function saveWorkout() {
  const dateInput = document.getElementById('workoutDateInput');
  const categoryInput = document.getElementById('workoutCategoryInput');
  const typeInput = document.getElementById('workoutTypeInput');
  const durationInput = document.getElementById('workoutDurationInput');
  const intensityInput = document.getElementById('workoutIntensityInput');
  const noteInput = document.getElementById('workoutNoteInput');

  if (!dateInput || !typeInput || !durationInput) return;

  const date = dateInput.value || today();
  const type = typeInput.value;
  const category = categoryInput ? categoryInput.value : getWorkoutCategory(type);
  const intensity = intensityInput ? intensityInput.value : 'Orta';
  const duration = parseLocaleNumber(durationInput.value);
  const freeNote = noteInput ? noteInput.value.trim() : '';
  const note = [`Kategori: ${category}`, `Zorluk: ${intensity}`, freeNote]
    .filter(Boolean)
    .join(' Â· ');

  if (!duration || duration <= 0) {
    alert('GeÃ§erli bir antrenman sÃ¼resi gir');
    return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    type,
    duration: parseFloat(duration.toFixed(1)),
    note,
  };

  const localId = saveWorkoutLocally(payload);
  setStatus('Antrenman kaydedildi âœ“', 'ok');
  durationInput.value = '';
  if (noteInput) noteInput.value = '';
  dateInput.value = today();

  if (!canUseCloud()) return;

  const { data, error } = await db
    .from('workout_logs')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Workout kayÄ±t hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Antrenman yerel kaydedildi - cloud izni kontrol edilecek', 'ok');
    return;
  }

  const localWorkout = state.workouts.find(item => item.id === localId);
  if (localWorkout && data?.id) localWorkout.id = data.id;
  recordSyncSuccess();

  await loadWorkoutsFromSupabase();
}

async function editWorkout(sortedIdx) {
  const sorted = [...(state.workouts || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  const durationInput = prompt('Antrenman sÃ¼resini gir (dk):', formatMinutes(target.duration));
  if (durationInput === null) return;

  const duration = parseLocaleNumber(durationInput);
  if (!duration || duration <= 0) {
    alert('GeÃ§erli bir antrenman sÃ¼resi gir.');
    return;
  }

  const normalizedDuration = parseFloat(duration.toFixed(1));
  state.workouts[target.originalIndex] = {
    ...state.workouts[target.originalIndex],
    duration: normalizedDuration,
  };
  stateSave();
  renderAll();

  if (!isCloudRecordId(target.id) || !canUseCloud()) {
    setStatus('Antrenman sÃ¼resi cihazda gÃ¼ncellendi', 'ok');
    return;
  }

  const { error } = await db
    .from('workout_logs')
    .update({ duration: normalizedDuration })
    .eq('user_id', getUserId())
    .eq('id', target.id);

  if (error) {
    recordSyncError(error);
    setStatus('SÃ¼re cihazda gÃ¼ncellendi - cloud gÃ¼ncellemesi baÅŸarÄ±sÄ±z', 'error');
    return;
  }

  recordSyncSuccess();
  setStatus('Antrenman sÃ¼resi gÃ¼ncellendi âœ“', 'ok');
}

async function deleteWorkout(sortedIdx) {
  if (!confirm('Bu antrenman kaydÄ±nÄ± silmek istediÄŸinden emin misin?')) return;

  const sorted = [...(state.workouts || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  markRecordDeleted('workouts', target);
  state.workouts = (state.workouts || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Antrenman kaydÄ± silindi âœ“', 'ok');

  if (!isCloudRecordId(target.id)) return;
  if (!canUseCloud()) return;

  const { error } = await db
    .from('workout_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Workout silme hatasÄ±:', error);
    recordSyncError(error);
    setStatus('Antrenman cihazdan silindi - cloud izni kontrol edilecek', 'ok');
    return;
  }
  unmarkRecordDeleted('workouts', target);
  recordSyncSuccess();
}

function editName() {
  const newName = prompt('Ä°smini gir:', state.name || '');
  if (!newName) return;

  state.name = newName.trim();
  ensureSyncMeta().pendingProfile = true;
  stateSave();
  renderAll();
  if (canUseCloud()) {
    saveProfileToSupabase().catch(recordSyncError);
  }
  setStatus('Ä°sim gÃ¼ncellendi âœ“', 'ok');
}

function editGoals() {
  const firstGoalCurrent = (state.milestones || [])[0] || '';
  const finalGoalCurrent = state.goalWeight || '';
  const firstMeasurement = getSortedMeasurements()[0];
  const startWeightCurrent = state.startWeight ?? firstMeasurement?.weight ?? '';
  const startWaistCurrent = state.startWaist ?? firstMeasurement?.waist ?? '';

  const startWeightInput = prompt('BaÅŸlangÄ±Ã§ kilonu gir (kg):', startWeightCurrent);
  if (startWeightInput === null) return;

  const startWaistInput = prompt('BaÅŸlangÄ±Ã§ bel Ã¶lÃ§Ã¼nÃ¼ gir (cm):', startWaistCurrent);
  if (startWaistInput === null) return;

  const firstGoalInput = prompt('Ä°lk hedef kilonu gir (kg):', firstGoalCurrent);
  if (firstGoalInput === null) return;

  const finalGoalInput = prompt('Final hedef kilonu gir (kg):', finalGoalCurrent);
  if (finalGoalInput === null) return;

  const startWeight = parseLocaleNumber(startWeightInput);
  const startWaist = parseLocaleNumber(startWaistInput);
  const firstGoal = parseLocaleNumber(firstGoalInput);
  const finalGoal = parseLocaleNumber(finalGoalInput);

  if ([startWeight, startWaist, firstGoal, finalGoal].some(value => Number.isNaN(value))) {
    alert('LÃ¼tfen tÃ¼m hedef alanlarÄ±na geÃ§erli sayÄ± gir.');
    return;
  }

  state.startWeight = parseFloat(startWeight.toFixed(1));
  state.startWaist = parseFloat(startWaist.toFixed(1));
  state.goalWeight = parseFloat(finalGoal.toFixed(1));
  state.milestones = [parseFloat(firstGoal.toFixed(1)), state.goalWeight];
  ensureSyncMeta().pendingProfile = true;

  if (!state.measurements?.length) {
    state.measurements = [{
      date: state.startDate || START_DATE,
      weight: state.startWeight,
      waist: state.startWaist,
    }];
  } else {
    const sorted = [...state.measurements].sort((a, b) => a.date.localeCompare(b.date));
    sorted[0] = {
      ...sorted[0],
      weight: state.startWeight,
      waist: state.startWaist,
    };
    state.measurements = sorted;
  }

  const firstDate = getSortedMeasurements()[0]?.date;
  if (firstDate) markPendingSync('measurements', firstDate);

  stateSave();
  renderAll();
  if (canUseCloud()) {
    saveProfileToSupabase().catch(recordSyncError);
  }
  setStatus('Hedefler gÃ¼ncellendi âœ“', 'ok');
}

function updatePreference(key, value) {
  state.preferences = {
    measureReminder: true,
    dailyReminder: false,
    ...(state.preferences || {}),
    [key]: Boolean(value),
  };
  ensureSyncMeta().pendingProfile = true;
  stateSave();
  renderSettings();
  if (canUseCloud()) {
    saveProfileToSupabase().catch(recordSyncError);
  }
}

function showAuth() {
  if (document.getElementById('authModal')) return;

  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'onboarding-modal';
  modal.innerHTML = `
    <div class="onboarding-card auth-card">
      <div class="onboarding-kicker">FitTracker hesabÄ±</div>
      <h2 id="authTitle">GiriÅŸ yap</h2>
      <p id="authCopy">Web ve iPhone PWA aynÄ± hesapla senkron Ã§alÄ±ÅŸÄ±r.</p>

      <div class="auth-tabs">
        <button class="active" id="authSignInTab" type="button">GiriÅŸ</button>
        <button id="authSignUpTab" type="button">KayÄ±t</button>
      </div>

      <div class="onboarding-grid single">
        <label>
          E-posta
          <input id="authEmail" type="email" autocomplete="email" placeholder="ornek@mail.com" />
        </label>
        <label>
          Åifre
          <input id="authPassword" type="password" autocomplete="current-password" placeholder="En az 6 karakter" />
        </label>
      </div>

      <button class="btn onboarding-submit" id="authSubmit">GiriÅŸ yap</button>
      <button class="auth-secondary" id="authResetPassword" type="button">Åifremi unuttum</button>
      <div class="auth-message" id="authMessage"></div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('authSignInTab')?.addEventListener('click', () => setAuthMode('signIn'));
  document.getElementById('authSignUpTab')?.addEventListener('click', () => setAuthMode('signUp'));
  document.getElementById('authSubmit')?.addEventListener('click', submitAuth);
  document.getElementById('authResetPassword')?.addEventListener('click', resetPassword);
}

function setAuthMode(mode) {
  authMode = mode;
  const signInTab = document.getElementById('authSignInTab');
  const signUpTab = document.getElementById('authSignUpTab');
  const title = document.getElementById('authTitle');
  const copy = document.getElementById('authCopy');
  const submit = document.getElementById('authSubmit');

  signInTab?.classList.toggle('active', mode === 'signIn');
  signUpTab?.classList.toggle('active', mode === 'signUp');

  if (title) title.textContent = mode === 'signIn' ? 'GiriÅŸ yap' : 'Hesap oluÅŸtur';
  if (copy) copy.textContent = mode === 'signIn'
    ? 'Web ve iPhone PWA aynÄ± hesapla senkron Ã§alÄ±ÅŸÄ±r.'
    : 'Bir hesap oluÅŸtur, sonra iPhoneâ€™da aynÄ± hesapla giriÅŸ yap.';
  if (submit) submit.textContent = mode === 'signIn' ? 'GiriÅŸ yap' : 'Hesap oluÅŸtur';
}

function setAuthMessage(message, isError = false) {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = getFriendlyAuthMessage(message);
  el.classList.toggle('error', isError);
}

function getFriendlyAuthMessage(message = '') {
  const text = String(message);

  if (/invalid login credentials/i.test(text)) {
    return 'E-posta veya ÅŸifre hatalÄ±. Daha Ã¶nce kayÄ±t olduysan tekrar kayÄ±t olma; aynÄ± bilgilerle giriÅŸ yapmayÄ± dene veya ÅŸifre sÄ±fÄ±rla.';
  }

  if (/email not confirmed/i.test(text)) {
    return 'E-posta henÃ¼z onaylanmamÄ±ÅŸ gÃ¶rÃ¼nÃ¼yor. Gelen kutundaki doÄŸrulama linkine tÄ±kla, sonra giriÅŸ yap.';
  }

  if (/user already registered|already registered/i.test(text)) {
    return 'Bu e-posta ile hesap zaten var. KayÄ±t yerine GiriÅŸ sekmesini kullan.';
  }

  if (/password/i.test(text) && /6|six|short/i.test(text)) {
    return 'Åifre en az 6 karakter olmalÄ±.';
  }

  return text;
}

async function submitAuth() {
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value || '';
  const submitBtn = document.getElementById('authSubmit');

  if (!email || password.length < 6) {
    setAuthMessage('E-posta ve en az 6 karakterli ÅŸifre gir.', true);
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = 'Ä°ÅŸleniyor...';
  }

  setAuthMessage('Ä°ÅŸleniyor...');

  try {
    const authPromise = authMode === 'signIn'
      ? db.auth.signInWithPassword({ email, password })
      : db.auth.signUp({ email, password });

    const authResult = await withTimeout(authPromise, 12000, 'GiriÅŸ');

    if (authResult.timedOut) {
      const { data } = await db.auth.getSession();
      if (data?.session) {
        await continueWithSession(data.session, { skipCloudWait: true });
        return;
      }
      setAuthMessage('GiriÅŸ isteÄŸi uzun sÃ¼rdÃ¼. Ä°nternet baÄŸlantÄ±nÄ± kontrol edip tekrar dene.', true);
      return;
    }

    if (authResult.error) {
      setAuthMessage(authResult.error.message || 'GiriÅŸ sÄ±rasÄ±nda hata oluÅŸtu.', true);
      return;
    }

    const result = authResult.value;

    if (result?.error) {
      setAuthMessage(result.error.message, true);
      return;
    }

    let session = result?.data?.session;

    if (!session) {
      const sessionResult = await withTimeout(db.auth.getSession(), 3500, 'Oturum alma');
      session = sessionResult?.value?.data?.session;
    }

    if (!session) {
      setAuthMessage(
        authMode === 'signUp'
          ? 'KayÄ±t tamamlandÄ±. E-posta doÄŸrulamasÄ± aÃ§Ä±ksa gelen kutunu kontrol et.'
          : 'GiriÅŸ tamamlandÄ±ysa birkaÃ§ saniye iÃ§inde aÃ§Ä±lmazsa sayfayÄ± yenile.',
        false
      );
      return;
    }

    await continueWithSession(session, { skipCloudWait: true });
  } catch (error) {
    console.error('Auth iÅŸlem hatasÄ±:', error);
    setAuthMessage(error?.message || 'GiriÅŸ sÄ±rasÄ±nda beklenmeyen hata oluÅŸtu.', true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText || (authMode === 'signIn' ? 'GiriÅŸ yap' : 'Hesap oluÅŸtur');
    }
  }
}

async function resetPassword() {
  const email = document.getElementById('authEmail')?.value.trim();
  if (!email) {
    setAuthMessage('Åifre sÄ±fÄ±rlamak iÃ§in e-posta gir.', true);
    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email);
  setAuthMessage(error ? error.message : 'Åifre sÄ±fÄ±rlama baÄŸlantÄ±sÄ± gÃ¶nderildi.', Boolean(error));
}

async function signOut() {
  activeSessionLoad = null;
  try {
    await db.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('Ã‡Ä±kÄ±ÅŸ yapÄ±lÄ±rken hata:', error);
  }

  try {
    localStorage.removeItem('fittracker-pro-auth');
    Object.keys(localStorage)
      .filter(key => key.includes('supabase') || key.includes('auth-token'))
      .forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Auth cache temizlenemedi:', error);
  }

  state = {
    ...state,
    userId: '',
    userEmail: '',
    onboarded: false,
    name: '',
    measurements: [],
    workouts: [],
    notes: [],
    sleep: [],
    deletedRecords: {
      measurements: [],
      sleep: [],
      workouts: [],
      notes: [],
    },
    syncMeta: {
      lastSuccess: '',
      lastAttempt: '',
      lastError: '',
      pendingMeasurements: [],
      pendingSleep: [],
    },
  };
  document.getElementById('authModal')?.remove();
  document.getElementById('onboardingModal')?.remove();
  renderAll();
  setStatus('GiriÅŸ bekleniyor', '');
  showAuth();
}

async function continueWithSession(session, options = {}) {
  if (!session?.user?.id) {
    showAuth();
    return;
  }

  state.userId = session.user.id;
  state.userEmail = session.user.email || state.userEmail || '';
  stateLoad();
  state.userId = session.user.id;
  state.userEmail = session.user.email || state.userEmail || '';
  state.name = state.name || getSessionDisplayName(session);

  if (!hasTrackedData() && !Number.isFinite(Number(state.startWeight))) {
    state.onboarded = false;
  }

  stateSave();
  document.getElementById('authModal')?.remove();

  renderAll();
  updateOnlineStatus();

  setStatus('Veriler yÃ¼kleniyor...', '');
  const cloudLoad = withTimeout(loadAllCloudData({ force: true }), options.skipCloudWait ? 4500 : 12000, 'Bulut veri yÃ¼kleme');

  const finishAfterCloud = result => {
    if (result?.error) console.warn('Bulut veri yÃ¼kleme hatasÄ±:', result.error);
    normalizeProfileState();
    renderAll();

    const hasProfileStart = Number.isFinite(Number(state.startWeight));
    if (!state.onboarded && !hasTrackedData() && !hasProfileStart) {
      setStatus('BaÅŸlangÄ±Ã§ kurulumu bekleniyor', '');
      showOnboarding();
      return;
    }

    if (result?.timedOut) {
      setStatus('Cloud yanÄ±tÄ± gecikti - yerel veriler hazÄ±r', 'error');
    } else if (result?.value?.busy) {
      setStatus('Senkronizasyon devam ediyor', 'ok');
    } else if (result?.error || result?.value?.ok === false) {
      setStatus('Yerel veriler hazÄ±r - senkron kontrol edilmeli', 'error');
    } else {
      setStatus('Senkron aktif', 'ok');
    }
  };

  if (options.skipCloudWait) {
    cloudLoad.then(finishAfterCloud);
  } else {
    const cloudResult = await cloudLoad;
    finishAfterCloud(cloudResult);
  }
}

function showOnboarding() {
  if (document.getElementById('onboardingModal')) return;

  const modal = document.createElement('div');
  modal.id = 'onboardingModal';
  modal.className = 'onboarding-modal';
  modal.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-kicker">FitTracker kurulumu</div>
      <h2>BaÅŸlangÄ±Ã§ bilgilerini ekle</h2>
      <p>Bu bilgiler hedef kartlarÄ±nÄ±, haftalÄ±k Ã¶lÃ§Ã¼m akÄ±ÅŸÄ±nÄ± ve ilerleme grafiklerini kiÅŸiselleÅŸtirir.</p>

      <div class="onboarding-grid">
        <label>
          Ä°sim
          <input id="onboardName" type="text" placeholder="AdÄ±n" />
        </label>
        <label>
          BaÅŸlangÄ±Ã§ tarihi
          <input id="onboardStartDate" type="date" min="${START_DATE}" value="${START_DATE}" />
        </label>
        <label>
          BaÅŸlangÄ±Ã§ kilosu
          <input id="onboardStartWeight" type="number" step="0.1" placeholder="kg" />
        </label>
        <label>
          BaÅŸlangÄ±Ã§ bel Ã¶lÃ§Ã¼mÃ¼
          <input id="onboardStartWaist" type="number" step="0.1" placeholder="cm" />
        </label>
        <label>
          Ä°lk hedef kilo
          <input id="onboardFirstGoal" type="number" step="0.1" placeholder="Ã¶rn: 95" />
        </label>
        <label>
          Ana hedef kilo
          <input id="onboardGoalWeight" type="number" step="0.1" placeholder="Ã¶rn: 85" />
        </label>
      </div>

      <button class="btn onboarding-submit" id="onboardSubmit">BaÅŸla</button>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('onboardSubmit')?.addEventListener('click', completeOnboarding);
}

async function completeOnboarding() {
  const name = document.getElementById('onboardName')?.value.trim();
  const startDate = document.getElementById('onboardStartDate')?.value || START_DATE;
  const startWeight = parseLocaleNumber(document.getElementById('onboardStartWeight')?.value || '');
  const startWaist = parseLocaleNumber(document.getElementById('onboardStartWaist')?.value || '');
  const firstGoal = parseLocaleNumber(document.getElementById('onboardFirstGoal')?.value || '');
  const goalWeight = parseLocaleNumber(document.getElementById('onboardGoalWeight')?.value || '');

  if (!name || Number.isNaN(startWeight) || Number.isNaN(startWaist) || Number.isNaN(firstGoal) || Number.isNaN(goalWeight)) {
    alert('LÃ¼tfen tÃ¼m baÅŸlangÄ±Ã§ bilgilerini doldur.');
    return;
  }

  if (startDate < START_DATE) {
    alert('BaÅŸlangÄ±Ã§ tarihi 31 MayÄ±s 2026â€™dan Ã¶nce olamaz.');
    return;
  }

  state.onboarded = true;
  state.name = name;
  state.startDate = startDate;
  state.startWeight = parseFloat(startWeight.toFixed(1));
  state.startWaist = parseFloat(startWaist.toFixed(1));
  state.goalWeight = parseFloat(goalWeight.toFixed(1));
  state.milestones = [parseFloat(firstGoal.toFixed(1)), state.goalWeight];
  ensureSyncMeta().pendingProfile = true;
  state.measurements = [{
    date: startDate,
    weight: state.startWeight,
    waist: state.startWaist,
  }];
  state.sleep = [];
  state.workouts = [];
  state.notes = [];
  state.weights = [];
  state.nutrition = [];
  state.deletedRecords = {
    measurements: [],
    sleep: [],
    workouts: [],
  notes: [],
};

  stateSave();

  if (!canUseCloud()) {
    setStatus('Kurulum yerel kaydedildi - giriÅŸ sonrasÄ± cloud senkronlanacak', 'ok');
    document.getElementById('onboardingModal')?.remove();
    renderAll();
    return;
  }

  await saveProfileToSupabase();

  const { error } = await db
    .from('measurements')
    .insert([{
      user_id: getUserId(),
      date: startDate,
      weight: state.startWeight,
      waist: state.startWaist,
    }]);

  if (error) {
    console.warn('Ä°lk Ã¶lÃ§Ã¼m cloud kaydÄ± yapÄ±lamadÄ±:', error);
    setStatus('Kurulum kaydedildi, cloud Ã¶lÃ§Ã¼m daha sonra senkronlanacak', 'ok');
  } else {
    setStatus('Kurulum tamamlandÄ± âœ“', 'ok');
  }

  document.getElementById('onboardingModal')?.remove();
  renderAll();
  if (!error) {
    await loadAllCloudData();
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ ONLINE STATUS Ã¢â€â‚¬Ã¢â€â‚¬
function updateOnlineStatus() {
  const notice = document.getElementById('offlineNotice');

  if (navigator.onLine) {
    if (notice) notice.classList.remove('visible');
    const pendingCount = getPendingSyncCount();
    setStatus(pendingCount ? `${pendingCount} deÄŸiÅŸiklik senkron bekliyor` : 'Ã‡evrimiÃ§i', 'ok');
    setSyncDot(pendingCount ? 'busy' : ensureSyncMeta().lastError ? 'err' : 'ok');
  } else {
    if (notice) notice.classList.add('visible');
    setStatus('Ã‡evrimdÄ±ÅŸÄ± - veriler yerel olarak saklanÄ±r', 'error');
    setSyncDot('err');
  }
  renderSettings();
}

function handleOnline() {
  updateOnlineStatus();
  if (state.onboarded && hasActiveUser()) loadAllCloudData({ force: true });
}

async function syncNow() {
  if (!navigator.onLine) {
    setStatus('Senkron iÃ§in internet baÄŸlantÄ±sÄ± gerekiyor', 'error');
    return;
  }

  const result = await loadAllCloudData({ force: true });
  if (result?.ok) setStatus('Web ve PWA verileri senkronize edildi', 'ok');
}

// Ã¢â€â‚¬Ã¢â€â‚¬ PWA INSTALL Ã¢â€â‚¬Ã¢â€â‚¬
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;

  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.add('visible');
});

function installApp() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(({ outcome }) => {
    deferredPrompt = null;

    const banner = document.getElementById('installBanner');
    if (banner) banner.classList.remove('visible');

    if (outcome === 'accepted') {
      setStatus('Uygulama yÃ¼klendi âœ“', 'ok');
    }
  });
}

// Ã¢â€â‚¬Ã¢â€â‚¬ INIT Ã¢â€â‚¬Ã¢â€â‚¬
function bindUiEvents() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.onboarded) loadAllCloudData();
  });

  const sleepBtn = document.getElementById('saveSleepBtn');
  if (sleepBtn) sleepBtn.addEventListener('click', saveSleep);

  const sleepDateInput = document.getElementById('sleepDateInput');
  if (sleepDateInput) sleepDateInput.value = today();

  const workoutDateInput = document.getElementById('workoutDateInput');
  if (workoutDateInput) workoutDateInput.value = today();

  const measureDateInput = document.getElementById('measureDateInput');
  if (measureDateInput) {
    syncMeasureFormDate(true);
    measureDateInput.addEventListener('change', updateWaistHint);
  }

  const workoutBtn = document.getElementById('saveWorkoutBtn');
  if (workoutBtn) workoutBtn.addEventListener('click', saveWorkout);

  const measurementBtn = document.getElementById('saveMeasurementBtn');
  if (measurementBtn) measurementBtn.addEventListener('click', saveMeasurementFromForm);

  const workoutCategoryInput = document.getElementById('workoutCategoryInput');
  if (workoutCategoryInput) {
    workoutCategoryInput.addEventListener('change', updateWorkoutTypes);
    updateWorkoutTypes();
  }

  const workoutTypeInput = document.getElementById('workoutTypeInput');
  if (workoutTypeInput) {
    workoutTypeInput.addEventListener('change', updateWorkoutGuidance);
  }

  document.querySelectorAll('[data-sleep-hours]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('sleepInput');
      if (input) input.value = btn.dataset.sleepHours;
    });
  });

  document.querySelectorAll('[data-workout-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('workoutDurationInput');
      if (input) input.value = btn.dataset.workoutMinutes;
    });
  });

  document.querySelectorAll('[data-daily-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      dailyView = btn.dataset.dailyView || 'week';
      renderDailyViewControls();
      renderSleepSummary();
      renderSleepList();
      renderWorkoutSummary();
      renderWorkoutList();
    });
  });

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);

  const syncNowBtn = document.getElementById('syncNowBtn');
  if (syncNowBtn) syncNowBtn.addEventListener('click', syncNow);

  window.addEventListener('focus', () => {
    if (state.onboarded) loadAllCloudData();
  });

  const weightBtn = document.getElementById('openAddWeightBtn');
  if (weightBtn) weightBtn.addEventListener('click', addMeasurement);

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const profileThemeToggle = document.getElementById('profileThemeToggle');
  if (profileThemeToggle) {
    profileThemeToggle.addEventListener('change', event => {
      state.theme = event.target.checked ? 'dark' : 'light';
      applyTheme();
      stateSave();
      renderSettings();
    });
  }

  const measureReminderToggle = document.getElementById('measureReminderToggle');
  if (measureReminderToggle) {
    measureReminderToggle.addEventListener('change', event => {
      updatePreference('measureReminder', event.target.checked);
    });
  }

  const dailyReminderToggle = document.getElementById('dailyReminderToggle');
  if (dailyReminderToggle) {
    dailyReminderToggle.addEventListener('change', event => {
      updatePreference('dailyReminder', event.target.checked);
    });
  }

  const editNameBtn = document.getElementById('editNameBtn');
  if (editNameBtn) editNameBtn.addEventListener('click', editName);

  const editGoalsBtn = document.getElementById('editGoalsBtn');
  if (editGoalsBtn) editGoalsBtn.addEventListener('click', editGoals);

  const addNoteBtn = document.getElementById('addNoteBtn');
  if (addNoteBtn) addNoteBtn.addEventListener('click', addNote);

  const installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.addEventListener('click', installApp);

  const dismissInstall = document.getElementById('dismissInstall');
  if (dismissInstall) {
    dismissInstall.addEventListener('click', () => {
      const banner = document.getElementById('installBanner');
      if (banner) banner.classList.remove('visible');
    });
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', updateOnlineStatus);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then(reg => {
          console.log('[SW] KayÄ±tlÄ±:', reg.scope);
          reg.update();

          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;

            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                worker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(err => console.warn('[SW] KayÄ±t hatasÄ±:', err));
    });
  }
}

async function checkAuthSession() {
  setStatus('Oturum kontrol ediliyor...', '');

  const fallback = window.setTimeout(() => {
    setStatus('GiriÅŸ bekleniyor', '');
    showAuth();
  }, 4500);

  try {
    const { data } = await db.auth.getSession();
    window.clearTimeout(fallback);

    if (!data.session) {
      updateOnlineStatus();
      setStatus('GiriÅŸ bekleniyor', '');
      showAuth();
      return;
    }

    if (activeSessionLoad) {
      await activeSessionLoad;
      return;
    }

    activeSessionLoad = continueWithSession(data.session)
      .finally(() => {
        activeSessionLoad = null;
      });
    await activeSessionLoad;
  } catch (error) {
    window.clearTimeout(fallback);
    console.warn('Oturum kontrolÃ¼ yapÄ±lamadÄ±:', error);
    updateOnlineStatus();
    setStatus('GiriÅŸ bekleniyor', '');
    showAuth();
  }
}

function setupAuthListener() {
  db.auth.onAuthStateChange((_event, session) => {
    if (_event === 'SIGNED_OUT' || !session?.user?.id) {
      if (_event === 'SIGNED_OUT') {
        activeSessionLoad = null;
        state = {
          ...state,
          userId: '',
          userEmail: '',
          onboarded: false,
          name: '',
          measurements: [],
          workouts: [],
          notes: [],
          sleep: [],
          deletedRecords: {
            measurements: [],
            sleep: [],
            workouts: [],
            notes: [],
          },
        };
        document.getElementById('onboardingModal')?.remove();
        renderAll();
        showAuth();
      }
      return;
    }

    const shouldLoad =
      session.user.id !== state.userId ||
      _event === 'SIGNED_IN' ||
      _event === 'INITIAL_SESSION' ||
      (!state.measurements.length && !state.sleep.length && !state.workouts.length);

    if (!shouldLoad || activeSessionLoad) return;

    activeSessionLoad = continueWithSession(session, { skipCloudWait: true })
      .finally(() => {
        activeSessionLoad = null;
      });
  });
}

function init() {
  renderAll();
  bindUiEvents();
  updateOnlineStatus();
  setupAuthListener();
  checkAuthSession();
}

// Expose for inline HTML handlers
window.goPanel = goPanel;
window.deleteWeight = deleteWeight;
window.deleteNote = deleteNote;
window.deleteSleep = deleteSleep;
window.deleteWorkout = deleteWorkout;

init();

