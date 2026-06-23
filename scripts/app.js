'use strict';

// SUPABASE
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

console.log('Supabase hazır:', db);

// CONSTANTS
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
  Kardiyo: ['Yürüyüş', 'Bisiklet', 'GrowwithJo', 'Diğer Kardiyo'],
};

const LEGACY_WORKOUT_CATEGORY_MAP = {
  'Core Temel': 'Kuvvet',
  'Core / Tabata': 'Kuvvet',
  'Karın Bölgesi': 'Kuvvet',
  'Bel ve Stabilizasyon': 'Kuvvet',
  'Plank Serisi': 'Kuvvet',
  'Squat Odaklı': 'Kuvvet',
  'Deadlift Odaklı': 'Kuvvet',
  'Üst Vücut': 'Kuvvet',
  'Alt Vücut': 'Kuvvet',
  'Sabah Yağ Yakım': 'Kardiyo',
  'GrowWithJo': 'Kardiyo',
  'GrowWithJo Challenge': 'Kardiyo',
  'GrowwithJo': 'Kardiyo',
  'Squat Challenge': 'Kardiyo',
  'Deadlift Challenge': 'Kardiyo',
  'Core Challenge': 'Kardiyo',
  'HIIT Challenge': 'Kardiyo',
  '30 Gün Challenge': 'Kardiyo',
  'Koşu': 'Kardiyo',
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
  'Bugün küçük bir adım at, yarın farkı hissedeceksin.',
  'Mükemmel olmak zorunda değilsin; devam etmek yeterli.',
  'Her kayıt, hedefe biraz daha yaklaştığının kanıtı.',
  'Bugün kendine yatırım yaptığın bir gün olsun.',
  'Disiplin, motivasyonun azaldığı günlerde seni taşır.',
  'Uyku, hareket ve istikrar: değişimin üç anahtarı.',
  'Vücudun emeğini hatırlar; bugün boşa gitmez.',
  'Küçük kazanımlar büyük dönüşümlerin temelidir.',
  'Bugün devam edersen, yarın daha güçlü başlarsın.',
  'Hedef uzak görünse de sıradaki adım çok yakın.',
];

// STATE
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
  achievementState: {
    seen: [],
    initialized: false,
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
let achievementSessionReady = false;
let progressWeekStart = '';

function withTimeout(promise, ms = 10000, label = 'İşlem') {
  let timer;
  const timeout = new Promise(resolve => {
    timer = window.setTimeout(() => {
      resolve({ timedOut: true, error: new Error(`${label} zaman aşımına uğradı`) });
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
  if (!value) return 'Henüz yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Henüz yok';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getSyncErrorMessage(error) {
  return String(error?.message || error?.details || error || 'Bilinmeyen senkron hatası');
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
// HELPERS
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

function releaseMobileInputFocus() {
  const active = document.activeElement;
  if (active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName)) {
    active.blur();
  }

  window.setTimeout(() => {
    window.scrollTo({ top: window.scrollY, left: 0, behavior: 'instant' });
  }, 60);
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

  updateWorkoutDistanceField();
  updateWorkoutGuidance();
}

function isWalkingWorkout(type = '') {
  return String(type).toLocaleLowerCase('tr-TR').includes('yürü');
}

function updateWorkoutDistanceField() {
  const typeInput = document.getElementById('workoutTypeInput');
  const distanceInput = document.getElementById('workoutDistanceInput');
  if (!typeInput || !distanceInput) return;

  const visible = isWalkingWorkout(typeInput.value);
  distanceInput.hidden = !visible;
  distanceInput.disabled = !visible;
  if (!visible) distanceInput.value = '';
}

function getWorkoutGuidance(category = 'Kuvvet', type = '') {
  const guide = {
    Kuvvet: {
      title: 'Kuvvet planı',
      text: 'Full Body A/B/C/D rotasyonunu sürdür. Core seçeneğini kısa destek bölümü gibi girerek ana kuvvet gününe ekleyebilirsin.',
    },
    Kardiyo: {
      title: 'Kardiyo planı',
      text: 'Yürüyüş, bisiklet, GrowwithJo veya diğer kardiyo seanslarını burada tut. Tempoyu zorluk alanıyla ayırman yeterli.',
    },
  };

  const selected = guide[category] || guide.Kuvvet;
  const suffix = type ? ` Seçili program: ${type}.` : '';
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

function getWorkoutDistanceFromNote(note = '') {
  const match = String(note).match(/Mesafe:\s*([\d.,]+)\s*km/i);
  if (!match) return 0;
  return parseLocaleNumber(match[1]) || 0;
}

function setWorkoutDistanceInNote(note = '', distance = 0) {
  const cleaned = String(note)
    .replace(/\s*·?\s*Mesafe:\s*[\d.,]+\s*km/gi, '')
    .trim();
  if (!distance || distance <= 0) return cleaned;
  return [cleaned, `Mesafe: ${formatDistanceKm(distance)} km`].filter(Boolean).join(' · ');
}

function getWalkingStatsForRange(range) {
  const entries = (state.workouts || []).filter(item =>
    item.date >= range.start &&
    item.date <= range.end &&
    isWalkingWorkout(item.type) &&
    getWorkoutDistanceFromNote(item.note) > 0
  );
  const distance = entries.reduce((total, item) => total + getWorkoutDistanceFromNote(item.note), 0);
  const duration = entries.reduce((total, item) => total + Number(item.duration || 0), 0);
  return {
    distance,
    duration,
    pace: distance > 0 ? duration / distance : 0,
  };
}

function getWorkoutCategoryFromNote(note = '', type = '') {
  const match = String(note).match(/Kategori:\s*([^·]+)/i);
  return match ? match[1].trim() : getWorkoutCategory(type);
}

function getCleanWorkoutNote(note = '') {
  return String(note)
    .replace(/\s*·?\s*Mesafe:\s*[\d.,]+\s*km/gi, '')
    .replace(/^Kategori:\s*[^·]+·\s*/i, '')
    .replace(/^Zorluk:\s*(Kolay|Orta|Zor)\s*·\s*/i, '')
    .replace(/^Kategori:\s*[^·]+\s*/i, '')
    .replace(/^Zorluk:\s*(Kolay|Orta|Zor)\s*/i, '')
    .trim();
}

function formatDecimal(value, digits = 1) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function formatDistanceKm(value) {
  const number = Number(value || 0);
  if (!number) return '0';
  return number
    .toFixed(2)
    .replace(/\.?0+$/, '');
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
  if (value > 9) return 'Yüksek';
  if (value >= 6) return 'Sınırda';
  return 'Düşük';
}

function getWorkoutDayLabel(item) {
  const category = Object.entries(item.categories || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Antrenman';
  return `${category} · ${Number(item.duration || 0)} dk`;
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

  const shouldShow = cls === 'error' || !['Hazır', 'Senkron aktif'].includes(msg);
  bar.className = `status-bar ${cls}${shouldShow ? ' visible' : ''}`;
  text.textContent = msg;
}

function clearInitialLoadingStatus() {
  const text = document.getElementById('statusText');
  if (text && text.textContent.includes('Yükleniyor')) {
    setStatus('Hazır', 'ok');
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
            <strong>${first ? Number(first.weight).toFixed(1) : '—'} → ${last ? Number(last.weight).toFixed(1) : '—'} kg</strong>
          </div>
          <div class="${diff <= 0 ? 'good' : 'bad'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg</div>
        </div>
        <div class="fallback-line-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Kilo grafiği">
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
        <p>Bel ölçümü başlangıçta ve her 4. tartıda takip edilir.</p>
        <div class="waist-rhythm">
          <i class="active"></i><i></i><i></i><i></i>
        </div>
      </div>
    </div>
  `;
}

function getWeightChartSuggestion(first, last, diff) {
  if (!first || !last) return 'İlk iki ölçümden sonra trend netleşir.';
  if (diff < 0) return `${formatDate(first.date)} başlangıcından beri düşüş var.`;
  if (diff > 0) return 'Bu hafta artış var; uyku, su ve antrenman ritmini kontrol et.';
  return 'Kilo aynı seviyede; trend için sonraki pazar ölçümünü bekle.';
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
            <strong>${Number(first.weight).toFixed(1)} → ${Number(last.weight).toFixed(1)} kg</strong>
          </div>
          <div class="${weightDiff <= 0 ? 'good' : 'bad'}">${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg</div>
        </div>

        <div class="measurement-detail-row">
          <div>
            <span>Başlangıç</span>
            <strong>${formatDate(first.date)}</strong>
          </div>
          <div>
            <span>Son ölçüm</span>
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
        <p>${waistDiff === null ? 'Yeni bel ölçümü 4. tartıda alınacak. Şimdilik başlangıç değeri referans olarak tutuluyor.' : `Toplam değişim: ${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm`}</p>
        <div class="waist-rhythm" aria-label="Bel ölçüm döngüsü">
          ${renderWaistRhythm(rhythmStep)}
        </div>
        <small>4 tartıda 1 bel ölçümü</small>
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
    waistInput.placeholder = required ? 'cm' : '4. tartıda';
    if (!required) waistInput.value = '';
  }

  hint.textContent = required
    ? sequence === 1
      ? 'Başlangıç tartısı: bel ölçümünü de ekle.'
      : `${sequence}. tartı: bu hafta bel ölçümünü de ekle.`
    : `${sequence}. tartı: sadece kilo gir. Bel ölçümü 4. tartıda takip edilir.`;

  if (existing) {
    hint.textContent = `${formatDate(date)} tarihinde kayıt var. Kaydedersen bu ölçüm güncellenir.`;
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

// PERSISTENCE
function stateSave() {
  try {
    localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
  } catch (e) {
    console.error('State kaydedilemedi:', e);
    setSyncDot('err');
    setStatus('Kayıt hatası: ' + e.message, 'error');
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
      achievementState: {
        seen: Array.isArray(savedState.achievementState?.seen) ? savedState.achievementState.seen : [],
        initialized: Boolean(savedState.achievementState?.initialized),
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
    console.warn('State yüklenemedi:', e);
  }
}

// THEME
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

// NAVIGATION
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

// RENDER
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

function getAchievementMetrics() {
  const measurements = getSortedMeasurements();
  const firstWeight = Number(measurements[0]?.weight ?? state.startWeight ?? 0);
  const lastWeight = Number(measurements.at(-1)?.weight ?? firstWeight);
  const weightLoss = Math.max(0, firstWeight - lastWeight);
  const firstGoal = Number((state.milestones || [])[0]);
  const walkingDistance = (state.workouts || [])
    .reduce((total, item) => total + getWorkoutDistanceFromNote(item.note), 0);
  const activityCount = (state.sleep || []).length + (state.workouts || []).length + (state.notes || []).length;
  const weeks = new Map();

  [...(state.sleep || []), ...(state.workouts || [])].forEach(item => {
    if (!item?.date) return;
    const start = getWeekRange(item.date).start;
    if (!weeks.has(start)) weeks.set(start, { sleep: new Set(), workouts: new Set() });
    const bucket = weeks.get(start);
    if ((state.sleep || []).includes(item)) bucket.sleep.add(item.date);
    else bucket.workouts.add(item.date);
  });

  VERIFIED_WEEK_TOTALS && Object.entries(VERIFIED_WEEK_TOTALS).forEach(([start, values]) => {
    if (!weeks.has(start)) weeks.set(start, { sleep: new Set(), workouts: new Set() });
    const bucket = weeks.get(start);
    if (values.sleepNights >= 7) {
      for (let day = 0; day < 7; day += 1) bucket.sleep.add(shiftIsoDate(start, day));
    }
  });

  const maxActiveDays = Math.max(0, ...[...weeks.values()].map(week => week.workouts.size));
  const maxSleepDays = Math.max(0, ...[...weeks.values()].map(week => week.sleep.size));
  const activeWeekStarts = [...weeks.entries()]
    .filter(([, week]) => week.sleep.size || week.workouts.size)
    .map(([start]) => start)
    .sort();
  let currentStreak = 0;
  let bestStreak = 0;
  let previous = '';
  activeWeekStarts.forEach(start => {
    currentStreak = previous && shiftIsoDate(previous, 7) === start ? currentStreak + 1 : 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    previous = start;
  });

  return {
    activityCount,
    maxActiveDays,
    maxSleepDays,
    walkingDistance,
    weightLoss,
    firstGoalReached: Number.isFinite(firstGoal) && lastWeight > 0 && lastWeight <= firstGoal,
    bestStreak,
  };
}

function getAchievements() {
  const metrics = getAchievementMetrics();
  return [
    { id: 'first-step', icon: '01', title: 'İlk Adım', detail: 'İlk günlük kaydını tamamla', current: metrics.activityCount, target: 1 },
    { id: 'active-3', icon: '3G', title: 'Ritim Kuruldu', detail: 'Bir haftada 3 aktif gün', current: metrics.maxActiveDays, target: 3 },
    { id: 'active-5', icon: '5G', title: 'Güçlü Hafta', detail: 'Bir haftada 5 aktif gün', current: metrics.maxActiveDays, target: 5 },
    { id: 'sleep-7', icon: '7U', title: 'Uyku Ustası', detail: '7 gecelik uyku kaydı', current: metrics.maxSleepDays, target: 7 },
    { id: 'walk-5', icon: '5K', title: 'Yol Başladı', detail: 'Toplam 5 km yürüyüş', current: metrics.walkingDistance, target: 5, unit: 'km' },
    { id: 'walk-25', icon: '25', title: 'Mesafe Avcısı', detail: 'Toplam 25 km yürüyüş', current: metrics.walkingDistance, target: 25, unit: 'km' },
    { id: 'loss-5', icon: '5-', title: 'Dönüşüm', detail: 'Toplam 5 kg ilerleme', current: metrics.weightLoss, target: 5, unit: 'kg' },
    { id: 'goal-1', icon: 'H1', title: 'İlk Hedef', detail: 'İlk kilo hedefine ulaş', current: metrics.firstGoalReached ? 1 : 0, target: 1 },
    { id: 'streak-3', icon: '3H', title: 'İstikrar', detail: '3 hafta üst üste kayıt', current: metrics.bestStreak, target: 3 },
  ].map(item => ({
    ...item,
    unlocked: Number(item.current) >= Number(item.target),
    progress: Math.min(100, Math.round((Number(item.current || 0) / Number(item.target || 1)) * 100)),
  }));
}

function formatAchievementProgress(item) {
  const current = item.unit === 'km'
    ? formatDistanceKm(item.current)
    : item.unit
      ? formatDecimal(item.current)
      : Math.floor(item.current);
  return `${current} / ${item.target}${item.unit ? ` ${item.unit}` : ''}`;
}

function showAchievementToast(items) {
  document.querySelector('.achievement-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  const title = items.length > 1 ? `${items.length} yeni başarı` : items[0].title;
  toast.innerHTML = `
    <span class="achievement-toast-icon">${items.length > 1 ? items.length : items[0].icon}</span>
    <div><strong>${title}</strong><small>Rozet vitrinin güncellendi.</small></div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 300);
  }, 3400);
}

function updateAchievementState(achievements) {
  if (!state.achievementState || typeof state.achievementState !== 'object') {
    state.achievementState = { seen: [], initialized: false };
  }
  const unlocked = achievements.filter(item => item.unlocked);
  const seen = new Set(state.achievementState.seen || []);
  const newlyUnlocked = unlocked.filter(item => !seen.has(item.id));

  if (!achievementSessionReady) {
    unlocked.forEach(item => seen.add(item.id));
    state.achievementState.seen = [...seen];
    state.achievementState.initialized = true;
    achievementSessionReady = true;
    stateSave();
    return;
  }

  if (newlyUnlocked.length) {
    newlyUnlocked.forEach(item => seen.add(item.id));
    state.achievementState.seen = [...seen];
    stateSave();
    showAchievementToast(newlyUnlocked);
  }
}

function renderAchievements() {
  const showcase = document.getElementById('achievementShowcase');
  const dashboard = document.getElementById('dashboardAchievement');
  const achievements = getAchievements();
  const unlocked = achievements.filter(item => item.unlocked);
  const next = achievements
    .filter(item => !item.unlocked)
    .sort((a, b) => b.progress - a.progress)[0];

  if (dashboard) {
    dashboard.innerHTML = `
      <div class="dashboard-achievement-card">
        <span class="achievement-ring">${unlocked.length}</span>
        <div>
          <strong>${unlocked.length} / ${achievements.length} başarı tamamlandı</strong>
          <small>${next ? `Sıradaki: ${next.title} · ${formatAchievementProgress(next)}` : 'Tüm başarılar tamamlandı.'}</small>
        </div>
        <button type="button" onclick="goPanel(4)">Rozetler</button>
      </div>
    `;
  }

  if (showcase) {
    showcase.innerHTML = `
      <div class="achievement-showcase-head">
        <div>
          <span>Başarılar</span>
          <strong>${unlocked.length} rozet kazanıldı</strong>
        </div>
        ${next ? `<small>Sıradaki hedef: ${next.title}</small>` : '<small>Tüm rozetler açıldı</small>'}
      </div>
      <div class="achievement-grid">
        ${achievements.map(item => `
          <article class="achievement-badge ${item.unlocked ? 'is-unlocked' : 'is-locked'}">
            <span class="achievement-icon">${item.icon}</span>
            <div class="achievement-copy">
              <strong>${item.title}</strong>
              <small>${item.detail}</small>
              <div class="achievement-progress"><i style="width:${item.progress}%"></i></div>
              <em>${item.unlocked ? 'Tamamlandı' : formatAchievementProgress(item)}</em>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  updateAchievementState(achievements);
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
  const walkingStats = getWalkingStatsForRange(range);
  const walkingDistance = walkingStats.distance;
  const walkingPace = walkingStats.pace;
  const sleepAverage = sleepDays ? sleepTotal / sleepDays : 0;
  const weekStatus = sleepPct >= 100 && workoutPct >= 100
    ? 'Hedef üstü'
    : sleepAverage >= 7 && workoutPct >= 70
      ? 'İyi gidiyorsun'
      : sleepDays || workoutDays
        ? 'Takipte'
        : 'Başla';
  const sleepInsight = sleepDays
    ? `Kayıtlı gün ort. ${sleepAverage.toFixed(1)} saat`
    : 'Uyku kaydı bekleniyor';
  const workoutInsight = workoutDays
    ? `${workoutDays} aktif gün`
    : 'Antrenman kaydı bekleniyor';
  const balanceInsight = sleepAverage >= 7 && workoutPct >= 100
    ? 'Uyku ve hareket güçlü'
    : sleepAverage >= 7
      ? 'Uyku hedefte'
      : workoutPct >= 100
        ? 'Hareket güçlü'
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

      ${walkingDistance > 0
        ? `<div class="week-metric walking-distance-metric">
            <div class="week-metric-top">
              <span>Yürüyüş mesafesi</span>
              <strong>${formatDistanceKm(walkingDistance)} km</strong>
            </div>
            <small>${formatDecimal(walkingPace)} dk/km ortalama tempo</small>
          </div>`
        : ''}
    </div>

    <div class="week-mini-insights${walkingDistance > 0 ? ' has-distance' : ''}">
      <span>Uyku <strong>${sleepInsight}</strong></span>
      <span>Antrenman <strong>${workoutInsight}</strong></span>
      <span>Durum <strong>${balanceInsight}</strong></span>
      ${walkingDistance > 0
        ? `<span>Yürüyüş <strong>${formatDistanceKm(walkingDistance)} km · ${formatDecimal(walkingPace)} dk/km</strong></span>`
        : ''}
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
      'Haftalık rapor henüz oluşmadı',
      'Uyku, antrenman ve ölçüm kayıtları geldikçe haftalık özetler burada listelenir.'
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
          <div class="goal-label">ŞU ANKİ ARA HEDEF</div>

          <div class="goal-big">
            <span>${currentGoal}</span>
            <small>kg</small>
          </div>

          <div class="goal-caption">İlk hedef</div>

          <div class="goal-mini-card">
            <div class="goal-progress-row">
              <span>İlk hedef ilerlemesi</span>
              <strong>%${firstPct}</strong>
            </div>
            <div class="goal-track">
              <div class="goal-fill" style="width:${firstPct}%"></div>
            </div>
          </div>
        </div>

        <div class="goal-right">
          <div class="goal-info-card">
            <span>İlk hedefe kalan</span>
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
        İlk ölçümünü eklediğinde kilo ve bel kartları burada görünecek.
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
        <div class="progress-summary-main">
          <div class="progress-summary-label">Son Kilo</div>
          <div class="progress-summary-value">${last.weight} <span>kg</span></div>
        </div>
        <div class="progress-summary-side">
          <div class="progress-summary-diff ${weightDiff <= 0 ? 'good' : 'bad'}">
            ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg
          </div>
          <div class="progress-summary-small">${startDateText} başlangıcından beri</div>
        </div>
      </div>

      <div class="progress-summary-card">
        <div class="progress-summary-main">
          <div class="progress-summary-label">Son Bel Ölçümü</div>
          <div class="progress-summary-value">${lastWaist?.waist ?? '—'} <span>cm</span></div>
        </div>
        <div class="progress-summary-side">
          <div class="progress-summary-diff ${waistDiff === null || waistDiff <= 0 ? 'good' : 'bad'}">
            ${waistDiff === null ? 'Bekleniyor' : `${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm`}
          </div>
          <div class="progress-summary-small">${waistMeasurements.length ? 'Sonraki bel 4. tartıda' : 'Her 4. tartıda'}</div>
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
      'Grafik için iki ölçüm gerekli',
      'Başlangıç kilosu ve en az bir sonraki kilo ölçümü olduğunda trend burada görünür.',
      'Ölçüm Ekle',
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
          SON KİLO
        </div>

        <div style="font-size:24px;font-weight:900;margin-top:6px">
          ${last.weight} kg
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
          TOPLAM DEĞİŞİM
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
          İLK ARA HEDEF
        </div>

        <div style="font-size:24px;font-weight:900;margin-top:6px">
          ${currentGoal} kg
        </div>

        <div style="font-size:12px;color:var(--muted);margin-top:8px">
          İlk hedefe kalan: ${kgLeft} kg · Final hedef: ${state.goalWeight} kg
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
          %${progressPct} tamamlandı
        </div>
      </div>

      <div class="card" style="padding:16px">
        <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
          BEL DEĞİŞİMİ
        </div>

        <div style="
          font-size:24px;
          font-weight:900;
          margin-top:6px;
          color:${waistDiff === null || waistDiff <= 0 ? 'var(--green)' : 'var(--red)'}
        ">
          ${waistDiff === null ? 'Sonraki ölçüm 4. tartıda' : `${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm`}
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
      : '<span class="delta-pill neutral">Başlangıç</span>';

    const waistDiffHtml = waistDiff
      ? `<span class="delta-pill ${waistDiff < 0 ? 'good' : 'bad'}">${waistDiff > 0 ? '+' : ''}${waistDiff} cm</span>`
      : `<span class="delta-pill neutral">${isWaistWeek ? 'İlk bel' : '4. tartıda'}</span>`;

    const waistText = isWaistWeek && Number.isFinite(Number(m.waist))
      ? `${m.waist} <span style="font-size:12px;color:var(--muted)">cm bel</span>`
      : `<span style="font-size:12px;color:var(--muted)">Bel: aylık takip</span>`;

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-weight:700">
            ${m.weight ?? '?'} <span style="font-size:12px;color:var(--muted)">kg</span>
            ·
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
          aria-label="Sil">×</button>
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
        Bugün için not yok.
      </div>
    `;
    return;
  }

  list.innerHTML = notes.map(note => `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${note.text}</div>
        <div class="daily-row-meta">Bugün</div>
      </div>
      <button onclick="deleteNote(${note.stateIndex})" class="row-delete" aria-label="Sil">×</button>
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
  return `Bu hafta henüz kayıt yok · ${formatDate(range.start)} - ${formatDate(shiftIsoDate(range.end, 1))} gösteriliyor`;
}

function getDailyViewRange() {
  if (dailyView === 'today') {
    const date = today();
    return { start: date, end: date, title: 'Bugün', targetMode: 'today' };
  }

  if (dailyView === 'all') {
    return { start: null, end: null, title: 'Tüm Geçmiş', targetMode: 'all' };
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
      <span>Bugün</span>
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
    list.innerHTML = `<div class="empty-state compact">${range.title} için uyku kaydı yok.</div>`;
    return;
  }

  list.innerHTML = sleep.map(item => `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${formatDecimal(item.hours)} saat</div>
        <div class="daily-row-meta">${item.date === today() ? 'Bugün' : formatDate(item.date)} · ${getSleepQuality(item.hours)}</div>
      </div>
      <button onclick="deleteSleep(${item.sortedIndex})" class="row-delete" aria-label="Sil">×</button>
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
      <span>Bugün</span>
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
    list.innerHTML = `<div class="empty-state compact">${range.title} için antrenman kaydı yok.</div>`;
    return;
  }

  list.innerHTML = workouts.map(item => {
    const distance = getWorkoutDistanceFromNote(item.note);
    return `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${item.type} · ${formatMinutes(item.duration)} dk${distance > 0 ? ` · ${formatDistanceKm(distance)} km` : ''}</div>
        <div class="daily-row-meta">${formatDate(item.date)} · ${getWorkoutCategoryFromNote(item.note, item.type)} · ${getWorkoutIntensityFromNote(item.note)}${getCleanWorkoutNote(item.note) ? ` · ${getCleanWorkoutNote(item.note)}` : ''}</div>
      </div>
      <div class="row-actions">
        <button onclick="editWorkout(${item.sortedIndex})" class="row-edit" aria-label="Düzenle">Düzenle</button>
        <button onclick="deleteWorkout(${item.sortedIndex})" class="row-delete" aria-label="Sil">×</button>
      </div>
    </div>
  `;
  }).join('');
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

function getProgressCoachInsight(current, range, prev) {
  const insights = getWeekInsights(current, range);
  const sleepPct = Math.min(100, Math.round((Number(current.sleep || 0) / SLEEP_TARGET) * 100));
  const workoutPct = Math.min(100, Math.round((Number(current.workouts || 0) / WORKOUT_TARGET) * 100));
  const walkingStats = getWalkingStatsForRange(range);
  const workoutDiff = prev ? Number(current.workouts || 0) - Number(prev.workouts || 0) : 0;
  const sleepDiff = prev ? Number(current.sleep || 0) - Number(prev.sleep || 0) : 0;

  let title = 'Ritim kuruluyor';
  let tone = 'steady';
  let text = 'Bu hafta için veri geldikçe yorum netleşecek. Uyku ve hareketi birlikte takip etmek en iyi resmi verir.';

  if (sleepPct >= 100 && workoutPct >= 100) {
    title = 'Hafta çok güçlü';
    tone = 'strong';
    text = 'Uyku ve antrenman hedefleri birlikte tamamlanmış. Bu tempo sürdürülebilirse gelişim çizgisi çok daha netleşir.';
  } else if (insights.sleepAvg >= 7 && workoutPct >= 80) {
    title = 'Dengeli gidiyorsun';
    tone = 'strong';
    text = 'Uyku hedefte, antrenman tarafı da güçlü. Bir sonraki adım bu düzeni haftadan haftaya korumak.';
  } else if (insights.sleepAvg < 7 && workoutPct >= 80) {
    title = 'Hareket iyi, uyku destek istiyor';
    tone = 'focus';
    text = 'Antrenman tarafı iyi görünüyor. Toparlanma için uyku ortalamasını 7 saate yaklaştırmak bu haftanın ana odağı olabilir.';
  } else if (insights.sleepAvg >= 7 && workoutPct < 65) {
    title = 'Uyku iyi, hareketi yükseltelim';
    tone = 'focus';
    text = 'Uyku tarafı toparlanmış. Antrenmanda 1-2 kısa ek seans bu haftayı daha dengeli hale getirebilir.';
  } else if (insights.workoutDays || insights.sleepDays) {
    title = 'Takip devam ediyor';
    tone = 'steady';
    text = 'Veri girişi başlamış. Bu hafta küçük ama düzenli kayıtlar, sonraki haftanın kıyasını daha anlamlı yapacak.';
  }

  const bullets = [
    prev
      ? `Önceki haftaya göre uyku ${sleepDiff >= 0 ? '+' : ''}${sleepDiff.toFixed(1)} saat`
      : 'Önceki hafta kıyası için veri bekleniyor',
    prev
      ? `Antrenman farkı ${workoutDiff >= 0 ? '+' : ''}${formatMinutes(workoutDiff)} dk`
      : `${insights.workoutDays} aktif gün kaydedildi`,
    walkingStats.distance > 0
      ? `Yürüyüş ${formatDistanceKm(walkingStats.distance)} km · ${formatDecimal(walkingStats.pace)} dk/km`
      : 'Yürüyüş mesafesi girilirse km takibi açılır',
  ];

  return { title, text, tone, bullets, walkingStats };
}

function getSelectedProgressWeek(weekly = getWeeklyProgressData()) {
  if (!weekly.length) return null;
  const sorted = [...weekly].sort((a, b) => a.start.localeCompare(b.start));
  const selected = sorted.find(item => item.start === progressWeekStart);
  if (selected) return selected;
  const latest = sorted[sorted.length - 1];
  progressWeekStart = latest.start;
  return latest;
}

function renderProgressWeekPicker(weekly = getWeeklyProgressData()) {
  const el = document.getElementById('progressWeekPicker');
  if (!el) return;

  if (!weekly.length) {
    el.innerHTML = '';
    return;
  }

  const sorted = [...weekly].sort((a, b) => b.start.localeCompare(a.start));
  const selected = getSelectedProgressWeek(sorted);

  el.innerHTML = `
    <div class="progress-week-picker">
      <div>
        <span>Görüntülenen hafta</span>
        <strong>${formatDate(selected.start)} - ${formatDate(shiftIsoDate(selected.end, 1))}</strong>
      </div>
      <select id="progressWeekSelect" aria-label="İlerleme haftası seç">
        ${sorted.map(item => `
          <option value="${item.start}" ${item.start === selected.start ? 'selected' : ''}>
            ${formatDate(item.start)} - ${formatDate(shiftIsoDate(item.end, 1))}
          </option>
        `).join('')}
      </select>
    </div>
  `;

  document.getElementById('progressWeekSelect')?.addEventListener('change', event => {
    progressWeekStart = event.target.value;
    renderProgressSummary();
    renderProgressCharts();
    renderProgressWeekPicker();
  });
}

function renderProgressSummary() {
  const el = document.getElementById('progressSummary');
  if (!el) return;

  const weekly = getWeeklyProgressData();
  const current = getSelectedProgressWeek(weekly) || { sleep: 0, workouts: 0 };
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
    ? categories.map(([category, minutes]) => `${category}: ${formatMinutes(minutes)} dk`).join(' · ')
    : 'Bu hafta kategori verisi yok';
  const workoutAdjustment = getVerifiedAdjustment(current, 'workouts');
  const categoryAndAdjustmentText = workoutAdjustment
    ? `${categoryText} · Not defteri farkı: ${workoutAdjustment > 0 ? '+' : ''}${formatMinutes(workoutAdjustment)} dk`
    : categoryText;
  const insights = getWeekInsights(current, range);
  const topCategoryLabel = insights.topCategory
    ? `${insights.topCategory[0]} · ${formatMinutes(insights.topCategory[1])} dk`
    : 'Veri bekleniyor';
  const bestSleepLabel = insights.bestSleep
    ? `${formatDate(insights.bestSleep.date)} · ${insights.bestSleep.hours} saat`
    : 'Veri bekleniyor';
  const bestWorkoutLabel = insights.bestWorkout
    ? `${formatDate(insights.bestWorkout.date)} · ${formatMinutes(insights.bestWorkout.duration)} dk`
    : 'Veri bekleniyor';

  const coachInsight = getProgressCoachInsight(current, range, prev);
  const walkingStats = coachInsight.walkingStats;
  const walkingSummary = walkingStats.distance > 0
    ? `${formatDistanceKm(walkingStats.distance)} km toplam`
    : 'Bu hafta yürüyüş mesafesi yok';
  const walkingPace = walkingStats.distance > 0
    ? `${formatDecimal(walkingStats.pace)} dk/km`
    : 'Tempo bekleniyor';

  const periodTitle = `${formatDate(range.start)} - ${formatDate(shiftIsoDate(range.end, 1))}`;
  const periodLabel = range.start === getWeekRange(today()).start ? 'Bu hafta' : 'Son aktif hafta';
  const sleepComparison = prev && previousDailyTotals.sleep.length
    ? `${sleepDiff >= 0 ? '+' : ''}${sleepDiff.toFixed(1)} saat / önceki hafta`
    : 'Önceki hafta kaydı yok';
  const workoutComparison = prev && previousDailyTotals.workouts.length
    ? `${workoutDiff >= 0 ? '+' : ''}${formatMinutes(workoutDiff)} dk / önceki hafta`
    : 'Önceki hafta kaydı yok';

  el.innerHTML = `
    <div class="progress-period">
      <span>${periodLabel}</span>
      <strong>${periodTitle}</strong>
    </div>
    <div class="weekly-coach-panel ${coachInsight.tone}">
      <div class="weekly-coach-main">
        <span>Akıllı haftalık yorum</span>
        <strong>${coachInsight.title}</strong>
        <p>${coachInsight.text}</p>
        <div>
          ${coachInsight.bullets.map(item => `<small>${item}</small>`).join('')}
        </div>
      </div>
      <div class="weekly-walk-summary">
        <span>Yürüyüş özeti</span>
        <strong>${walkingSummary}</strong>
        <div>
          <small>${formatMinutes(walkingStats.duration)} dk yürüyüş</small>
          <small>${walkingPace}</small>
        </div>
      </div>
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
        <strong>${last ? `${last.weight} kg` : '—'}</strong>
        <small>Toplam: ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg · Son: ${lastWeightDiff > 0 ? '+' : ''}${lastWeightDiff.toFixed(1)} kg</small>
      </div>

      <div class="progress-metric-card">
        <span>Bel</span>
        <strong>${lastWaist ? `${lastWaist.waist} cm` : '—'}</strong>
        <small>${waistDiff === null ? 'Her 4. tartıda takip edilir' : `Toplam: ${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm · Son: ${lastWaistDiff === null ? '—' : `${lastWaistDiff > 0 ? '+' : ''}${lastWaistDiff.toFixed(1)} cm`}`}</small>
      </div>
    </div>

    <div class="progress-insight-grid">
      <div class="progress-insight-card">
        <span>Kayıtlı gün ortalaması</span>
        <strong>${insights.sleepAvg.toFixed(1)} saat/gün</strong>
        <small>${insights.sleepDays || 0} kayıtlı gün üzerinden</small>
      </div>
      <div class="progress-insight-card">
        <span>En iyi uyku</span>
        <strong>${bestSleepLabel}</strong>
        <small>Haftanın en yüksek uyku kaydı</small>
      </div>
      <div class="progress-insight-card">
        <span>Antrenman yapılan gün</span>
        <strong>${insights.workoutDays} gün</strong>
        <small>Bu hafta antrenman yapılan gün</small>
      </div>
      <div class="progress-insight-card">
        <span>Öne çıkan kategori</span>
        <strong>${topCategoryLabel}</strong>
        <small>${bestWorkoutLabel}</small>
      </div>
    </div>
  `;
}
function renderProgressCharts() {
  const weekly = getWeeklyProgressData();

  const latestWeek = getSelectedProgressWeek(weekly);

  const sleepWrap = document.getElementById('sleepBars');
  const workoutWrap = document.getElementById('workoutBars');

  if (!latestWeek) {
    setEmptyState(
      sleepWrap,
      'Uyku grafiği için kayıt bekleniyor',
      'İlk uyku kaydını eklediğinde haftalık uyku düzenin burada görünür.',
      'Uyku Ekle',
      2
    );
    setEmptyState(
      workoutWrap,
      'Antrenman grafiği için kayıt bekleniyor',
      'İlk antrenmanı eklediğinde süre ve yoğunluk dağılımı burada görünür.',
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
        'Bu hafta uyku kaydı yok',
        'Bir uyku kaydı eklediğinde günlük uyku düzenin burada grafik olarak görünecek.',
        'Uyku Ekle',
        2
      );
    } else {
    sleepWrap.innerHTML = `
      <div class="chart-mini-head enhanced">
        <div>
          <strong>Günlük uyku dağılımı</strong>
          <span>Hedef aralık: 7-9 saat. Kayıtlı gün ortalaması ${sleepAvg.toFixed(1)} saat/gün</span>
        </div>
        <em>${latestWeek.sleep.toFixed(1)} / ${SLEEP_TARGET} saat</em>
      </div>
      <div class="chart-stat-row">
        <div><span>Kayıtlı gün ort.</span><strong>${sleepAvg.toFixed(1)} saat</strong></div>
        <div><span>En iyi gün</span><strong>${bestSleep ? `${getShortWeekday(bestSleep.date)} · ${formatDecimal(bestSleep.hours)} saat` : '—'}</strong></div>
        <div><span>Durum</span><strong>${sleepAvg >= 7 ? 'Hedefte' : 'Eksik'}</strong></div>
      </div>
      <div class="bar-chart sleep-chart enhanced" style="--target-line: ${Math.min(100, (7 / 10) * 100)}%">
        ${sleepData.map(item => {
          const h = Math.min(140, Math.max(18, item.hours * 14));
          const quality = getSleepQuality(item.hours);

          return `
            <div class="bar-item">
              <div class="bar-fill sleep" style="height:${h}px" title="${formatDecimal(item.hours)} saat · ${quality}">
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
    const walkingStats = getWalkingStatsForRange(latestWeek);
    const recordedCategoryText = categories.length
      ? categories.map(([category, duration]) => `${category}: ${formatMinutes(duration)} dk`).join(' · ')
      : 'Kategori verisi bekleniyor';
    const distanceText = walkingStats.distance > 0
      ? ` · Yürüyüş: ${formatDistanceKm(walkingStats.distance)} km`
      : '';
    const workoutAdjustment = getVerifiedAdjustment(latestWeek, 'workouts');
    const categoryText = workoutAdjustment
      ? `${recordedCategoryText}${distanceText} · Not defteri farkı: ${workoutAdjustment > 0 ? '+' : ''}${formatMinutes(workoutAdjustment)} dk`
      : `${recordedCategoryText}${distanceText}`;
    const bestWorkout = workoutData.reduce((best, item) => item.duration > (best?.duration || 0) ? item : best, null);
    const workoutDays = workoutData.length;

    if (!workoutData.length) {
      setEmptyState(
        workoutWrap,
        'Bu hafta antrenman kaydı yok',
        'Antrenman eklediğinde süre, kategori ve haftalık dağılım burada görünür.',
        'Antrenman Ekle',
        2
      );
    } else {
    workoutWrap.innerHTML = `
      <div class="chart-mini-head enhanced">
        <div>
          <strong>Günlük antrenman dağılımı</strong>
          <span>${categoryText}</span>
        </div>
        <em>${workoutDays} antrenman günü</em>
      </div>
      <div class="chart-stat-row">
        <div><span>Antrenman yapılan gün</span><strong>${workoutDays} gün</strong></div>
        <div><span>En yoğun gün</span><strong>${bestWorkout ? `${getShortWeekday(bestWorkout.date)} · ${formatMinutes(bestWorkout.duration)} dk` : '—'}</strong></div>
        <div><span>Odak</span><strong>${categories[0] ? categories[0][0] : '—'}</strong></div>
      </div>
      <div class="bar-chart workout-chart enhanced">
        ${workoutData.map(item => {
          const h = Math.min(140, Math.max(18, item.duration * 1.35));
          const category = Object.entries(item.categories)
            .sort((a, b) => b[1] - a[1])
            .map(([name, duration]) => `${name}: ${formatMinutes(duration)} dk`)
            .join(' · ');

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
      'Haftalık rapor henüz yok',
      'Uyku ve antrenman kayıtları geldikçe haftalık özetler burada görünür.'
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
        const status = isStrong ? 'Güçlü hafta' : isLight ? 'Takviye gerekli' : 'Dengeli';
        const categories = getWorkoutCategoriesForRange(item);
        const categorySummary = categories.length
          ? categories.slice(0, 2).map(([name, minutes]) => `${name} ${formatMinutes(minutes)} dk`).join(' · ')
          : 'Kategori bekleniyor';
        const walkingStats = getWalkingStatsForRange(item);
        const activitySummary = walkingStats.distance > 0
          ? `${categorySummary} · Yürüyüş ${formatDistanceKm(walkingStats.distance)} km`
          : categorySummary;
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
          ? `Not defteri doğrulandı${workoutAdjustment ? ` · süre farkı ${workoutAdjustment > 0 ? '+' : ''}${formatMinutes(workoutAdjustment)} dk` : ''}`
          : '';
        const workoutMetric = workoutDays
          ? `${formatMinutes(item.workouts)} dk · ${workoutDays} gün · ${workoutRecords} kayıt`
          : 'Kayıt yok';

        return `
          <div class="weekly-report-row">
            <div>
              <strong>${formatDate(item.start)} - ${formatDate(shiftIsoDate(item.end, 1))}</strong>
              <span>${status}</span>
              <small>${activitySummary}</small>
              ${verifiedNote ? `<small>${verifiedNote}</small>` : ''}
            </div>
            <div class="weekly-report-metrics">
              <div>
                <span>Uyku</span>
                <strong>${item.sleep.toFixed(1)} saat</strong>
                <small>${sleepDays}/7 gece${item.verified ? ' · doğrulandı' : ''}</small>
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
  if (emailEl) emailEl.textContent = state.userEmail || '—';
  if (startWeightEl) {
    const startWeight = state.startWeight ?? firstMeasurement?.weight;
    startWeightEl.textContent = Number.isFinite(Number(startWeight)) ? `${Number(startWeight).toFixed(1)} kg` : '— kg';
  }
  if (currentWeightEl) {
    currentWeightEl.textContent = lastMeasurement?.weight ? `${Number(lastMeasurement.weight).toFixed(1)} kg` : '— kg';
  }
  if (currentWaistEl) {
    currentWaistEl.textContent = lastWaistMeasurement?.waist ? `${Number(lastWaistMeasurement.waist).toFixed(1)} cm` : 'Aylık takip';
  }
  if (firstGoalEl) firstGoalEl.textContent = firstGoal ? `${firstGoal} kg` : 'Belirlenmedi';
  if (finalGoalEl) finalGoalEl.textContent = finalGoal ? `${finalGoal} kg` : 'Belirlenmedi';
  const syncMeta = ensureSyncMeta();
  const pendingCount = getPendingSyncCount();
  if (syncEl) {
    syncEl.textContent = cloudSyncInProgress
      ? 'Senkronize ediliyor'
      : !navigator.onLine
        ? 'Çevrimdışı kayıt'
        : syncMeta.lastError
          ? 'Kontrol gerekli'
          : 'Cloud hazır';
    syncEl.className = 'sync-state-badge';
    syncEl.classList.add(
      cloudSyncInProgress
        ? 'is-syncing'
        : !navigator.onLine
          ? 'is-offline'
          : syncMeta.lastError
            ? 'is-error'
            : pendingCount
              ? 'is-pending'
              : 'is-ready'
    );
  }
  if (lastSyncEl) lastSyncEl.textContent = formatSyncTimestamp(syncMeta.lastSuccess);
  if (pendingSyncEl) pendingSyncEl.textContent = `${pendingCount} değişiklik`;
  if (syncErrorEl) {
    syncErrorEl.hidden = !syncMeta.lastError;
    syncErrorEl.textContent = syncMeta.lastError ? `Son hata: ${syncMeta.lastError}` : '';
  }
  if (syncNowBtn) {
    syncNowBtn.disabled = cloudSyncInProgress || !navigator.onLine || !hasActiveUser();
    syncNowBtn.classList.toggle('is-syncing', cloudSyncInProgress);
    const label = syncNowBtn.querySelector('span');
    if (label) label.textContent = cloudSyncInProgress ? 'Senkronize Ediliyor' : 'Şimdi Senkronize Et';
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
    renderAchievements,
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
    renderProgressWeekPicker,
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
      console.error('Render hatası:', renderFn.name, error);
    }
  });
}

// SUPABASE
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
    console.error('Supabase load hatası:', error);
    setStatus('Cloud veri yüklenemedi', 'error');
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
  console.log('Supabase verileri yüklendi:', data);
}

async function loadSleepFromSupabase() {
  const localSleep = Array.isArray(state.sleep) ? [...state.sleep] : [];

  const { data, error } = await db
    .from('sleep_logs')
    .select('*')
    .eq('user_id', getUserId())
    .order('date', { ascending: false });

  if (error) {
    console.error('Sleep load hatası:', error);
    setStatus('Uyku verileri yüklenemedi', 'error');
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
    console.error('Workout load hatası:', error);
    setStatus('Antrenman verileri yüklenemedi', 'error');
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
    console.error('Notes load hatası:', error);
    setStatus('Notlar yüklenemedi', 'error');
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
    if (error) throw new Error(`Silme işlemi: ${getSyncErrorMessage(error)}`);
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
  if (!canUseCloud()) return { ok: false, error: new Error('Çevrimdışı') };

  const syncMeta = ensureSyncMeta();
  if (syncMeta.pendingProfile) {
    await runSyncStage('Profil ve hedefleri gonderme', saveProfileToSupabase);
  }
  const pendingMeasurementDates = new Set(syncMeta.pendingMeasurements);
  const measurements = getSortedMeasurements()
    .filter(item => pendingMeasurementDates.has(item.date));
  for (const item of measurements) {
    if (isRecordDeleted('measurements', item)) continue;
    const { error } = await runSyncStage('Ölçüm gönderme', () => saveMeasurementToSupabase({
      user_id: getUserId(),
      date: item.date,
      weight: Number(item.weight),
      waist: parseOptionalNumber(item.waist),
    }));
    if (error) throw new Error(`Ölçüm gönderme: ${getSyncErrorMessage(error)}`);
    clearPendingSync('measurements', item.date);
  }

  const pendingSleepDates = new Set(syncMeta.pendingSleep);
  const sleepItems = (Array.isArray(state.sleep) ? state.sleep : [])
    .filter(item => pendingSleepDates.has(item.date));
  for (const item of sleepItems) {
    if (isRecordDeleted('sleep', item)) continue;
    const { error } = await runSyncStage('Uyku kaydı gönderme', () => saveSleepToSupabase({
      user_id: getUserId(),
      date: item.date,
      hours: Number(item.hours || 0),
    }));
    if (error) throw new Error(`Uyku kaydı gönderme: ${getSyncErrorMessage(error)}`);
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
      runSyncStage('Ölçümleri okuma', loadMeasurementsFromSupabase),
      runSyncStage('Uyku kayıtlarını okuma', loadSleepFromSupabase),
      runSyncStage('Antrenmanları okuma', loadWorkoutsFromSupabase),
      runSyncStage('Notları okuma', loadNotesFromSupabase),
    ]);

    const rejected = results.find(result => result.status === 'rejected');
    if (rejected) throw rejected.reason;

    recoverOnboardingFromData();
    normalizeProfileState();
    await runSyncStage('Bekleyen kayıtları gönderme', pushLocalPendingToSupabase);

    syncMeta.lastSuccess = new Date().toISOString();
    syncMeta.lastError = '';
    stateSave();
    setStatus('Senkron tamamlandı', 'ok');
    setSyncDot('ok');
    renderAll();
    return { ok: true, results };
  } catch (error) {
    syncMeta.lastError = getSyncErrorMessage(error);
    stateSave();
    setStatus('Senkron tamamlanamadı - yerel kayıtlar korunuyor', 'error');
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

// ACTIONS
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
    alert('Geçerli bir kilo gir.');
    return;
  }

  if (date < START_DATE) {
    alert('Başlangıç tarihi 31 Mayıs 2026. Bu tarihten önce ölçüm eklenemez.');
    return;
  }

  if (waist !== null && (Number.isNaN(waist) || waist <= 0)) {
    alert('Geçerli bir bel ölçümü gir.');
    return;
  }

  if (isWaistWeek && waist === null) {
    alert(getMeasurementSequenceNumber(date) === 1
      ? 'Başlangıç tartısında bel ölçümünü de ekle.'
      : 'Bu 4. tartı günü. Lütfen bel ölçümünü de ekle.');
    return;
  }

  if (new Date(date).getDay() !== WEEKLY_MEASURE_DAY) {
    const ok = confirm('Ölçümler pazar günü alınacak şekilde planlandı. Yine de bu tarihe kayıt eklemek ister misin?');
    if (!ok) return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    weight: parseFloat(weight.toFixed(1)),
    waist: waist === null ? null : parseFloat(waist.toFixed(1)),
  };

  saveMeasurementLocally(payload);
  setStatus('Ölçüm kaydedildi ✓', 'ok');

  weightInput.value = '';
  waistInput.value = '';
  dateInput.value = getSuggestedMeasureDate();
  updateWaistHint();

  if (!canUseCloud()) return;

  const { error } = await saveMeasurementToSupabase(payload);

  if (error) {
    console.error('Measurement save error:', error);
    recordSyncError(error);
    setStatus('Ölçüm yerel kaydedildi - cloud izni kontrol edilecek', 'ok');
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

  const dateInput = prompt('Ölçüm tarihi gir (gg/aa/yyyy):', todayDisplay());
  if (!dateInput) return;

  const date = parseDisplayDate(dateInput);
  if (!date) {
    alert('Tarih formatı hatalı. Örnek: 27/04/2026 veya 27.04.2026');
    return;
  }

  if (date < START_DATE) {
    alert('Başlangıç tarihi 31 Mayıs 2026. Bu tarihten önce ölçüm eklenemez.');
    return;
  }

  if (!Array.isArray(state.measurements)) state.measurements = [];

  const alreadyExists = state.measurements.some(item => item.date === date);

  if (alreadyExists) {
    alert('Bu tarih için zaten kayıt var. Önce mevcut kaydı silmelisin.');
    return;
  }

  const weightInput = prompt('Kilonu gir (kg):');
  const weight = parseLocaleNumber(weightInput);
  if (!weightInput || Number.isNaN(weight)) return;

  const waistInput = prompt(
    shouldTrackWaist(date)
      ? 'Bu 4. tartı günü. Bel ölçünü gir (cm):'
      : 'Bel ölçünü gir (cm, opsiyonel):'
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
  setStatus('Ölçüm eklendi ✓', 'ok');

  if (!canUseCloud()) return;

  const { error } = await saveMeasurementToSupabase(measurement);

  if (error) {
    console.error('Supabase insert hatası:', error);
    recordSyncError(error);
    setStatus('Ölçüm yerel kaydedildi - cloud izni kontrol edilecek', 'ok');
  } else {
    recordSyncSuccess('measurements', measurement.date);
    await loadMeasurementsFromSupabase();
  }
}

async function deleteWeight(sortedIdx) {
  if (!confirm('Bu ölçümü silmek istediğinden emin misin?')) return;

  const sorted = [...(state.measurements || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const target = sorted[sortedIdx];

  if (!target) return;

  markRecordDeleted('measurements', target);
  state.measurements = (state.measurements || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Ölçüm silindi ✓', 'ok');

  if (!canUseCloud()) return;

  const { error } = await db
    .from('measurements')
    .delete()
    .eq('user_id', getUserId())
    .eq('date', target.date);

  if (error) {
    console.error('Supabase delete hatası:', error);
    recordSyncError(error);
    setStatus('Ölçüm cihazdan silindi - cloud izni kontrol edilecek', 'ok');
    return;
  }
  unmarkRecordDeleted('measurements', target);
  recordSyncSuccess();
}

async function deleteNote(index) {
  if (!confirm('Bu notu silmek istediğinden emin misin?')) return;

  const target = state.notes[index];
  if (!target) return;

  markRecordDeleted('notes', target);
  state.notes = (state.notes || []).filter((_, itemIndex) => itemIndex !== index);
  stateSave();
  renderAll();
  setStatus('Not silindi ✓', 'ok');

  if (!isCloudRecordId(target.id)) return;
  if (!canUseCloud()) return;

  const { error } = await db
    .from('notes')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Note silme hatası:', error);
    recordSyncError(error);
    setStatus('Not cihazdan silindi - cloud izni kontrol edilecek', 'ok');
    return;
  }
  unmarkRecordDeleted('notes', target);
  recordSyncSuccess();
}

async function deleteSleep(sortedIdx) {
  if (!confirm('Bu uyku kaydını silmek istediğinden emin misin?')) return;

  const sorted = [...(state.sleep || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  markRecordDeleted('sleep', target);
  state.sleep = (state.sleep || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Uyku kaydı silindi ✓', 'ok');

  if (!isCloudRecordId(target.id)) return;
  if (!canUseCloud()) return;

  const { error } = await db
    .from('sleep_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Sleep silme hatası:', error);
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
  setStatus('Not eklendi ✓', 'ok');
  if (noteInput) noteInput.value = '';

  if (!canUseCloud()) return;

  const { data, error } = await db
    .from('notes')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Note kayıt hatası:', error);
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
    alert('Geçerli bir uyku saati gir');
    return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    hours: parseFloat(hours.toFixed(1)),
  };

  saveSleepLocally(payload);
  setStatus('Uyku kaydedildi ✓', 'ok');
  hourInput.value = '';
  document.querySelectorAll('[data-sleep-hours]').forEach(btn => btn.classList.remove('is-selected'));
  releaseMobileInputFocus();
  dateInput.value = today();

  if (!canUseCloud()) return;

  const { error } = await saveSleepToSupabase(payload);

  if (error) {
    console.error('Sleep kayıt hatası:', error);
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
  const distanceInput = document.getElementById('workoutDistanceInput');
  const intensityInput = document.getElementById('workoutIntensityInput');
  const noteInput = document.getElementById('workoutNoteInput');

  if (!dateInput || !typeInput || !durationInput) return;

  const date = dateInput.value || today();
  const type = typeInput.value;
  const category = categoryInput ? categoryInput.value : getWorkoutCategory(type);
  const intensity = intensityInput ? intensityInput.value : 'Orta';
  const duration = parseLocaleNumber(durationInput.value);
  const distance = isWalkingWorkout(type) && distanceInput?.value
    ? parseLocaleNumber(distanceInput.value)
    : 0;
  const freeNote = noteInput ? noteInput.value.trim() : '';
  const note = [`Kategori: ${category}`, `Zorluk: ${intensity}`, freeNote]
    .filter(Boolean)
    .join(' · ');

  if (!duration || duration <= 0) {
    alert('Geçerli bir antrenman süresi gir');
    return;
  }

  if (distanceInput?.value && (!distance || distance <= 0)) {
    alert('Geçerli bir yürüyüş mesafesi gir');
    return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    type,
    duration: parseFloat(duration.toFixed(1)),
    note: setWorkoutDistanceInNote(note, distance),
  };

  const localId = saveWorkoutLocally(payload);
  setStatus('Antrenman kaydedildi ✓', 'ok');
  durationInput.value = '';
  if (distanceInput) distanceInput.value = '';
  document.querySelectorAll('[data-workout-minutes]').forEach(btn => btn.classList.remove('is-selected'));
  releaseMobileInputFocus();
  if (noteInput) noteInput.value = '';
  dateInput.value = today();

  if (!canUseCloud()) return;

  const { data, error } = await db
    .from('workout_logs')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Workout kayıt hatası:', error);
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

  const durationInput = prompt('Antrenman süresini gir (dk):', formatMinutes(target.duration));
  if (durationInput === null) return;

  const duration = parseLocaleNumber(durationInput);
  if (!duration || duration <= 0) {
    alert('Geçerli bir antrenman süresi gir.');
    return;
  }

  const normalizedDuration = parseFloat(duration.toFixed(1));
  let updatedNote = target.note || '';
  if (isWalkingWorkout(target.type)) {
    const currentDistance = getWorkoutDistanceFromNote(target.note);
    const distanceInput = prompt('Yürüyüş mesafesini gir (km, boş bırakabilirsin):', currentDistance || '');
    if (distanceInput === null) return;
    const distance = distanceInput ? parseLocaleNumber(distanceInput) : 0;
    if (distanceInput && (!distance || distance <= 0)) {
      alert('Geçerli bir yürüyüş mesafesi gir.');
      return;
    }
    updatedNote = setWorkoutDistanceInNote(target.note, distance);
  }
  state.workouts[target.originalIndex] = {
    ...state.workouts[target.originalIndex],
    duration: normalizedDuration,
    note: updatedNote,
  };
  stateSave();
  renderAll();

  if (!isCloudRecordId(target.id) || !canUseCloud()) {
    setStatus('Antrenman süresi cihazda güncellendi', 'ok');
    return;
  }

  const { error } = await db
    .from('workout_logs')
    .update({ duration: normalizedDuration, note: updatedNote })
    .eq('user_id', getUserId())
    .eq('id', target.id);

  if (error) {
    recordSyncError(error);
    setStatus('Süre cihazda güncellendi - cloud güncellemesi başarısız', 'error');
    return;
  }

  recordSyncSuccess();
  setStatus('Antrenman süresi güncellendi ✓', 'ok');
}

async function deleteWorkout(sortedIdx) {
  if (!confirm('Bu antrenman kaydını silmek istediğinden emin misin?')) return;

  const sorted = [...(state.workouts || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  markRecordDeleted('workouts', target);
  state.workouts = (state.workouts || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Antrenman kaydı silindi ✓', 'ok');

  if (!isCloudRecordId(target.id)) return;
  if (!canUseCloud()) return;

  const { error } = await db
    .from('workout_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Workout silme hatası:', error);
    recordSyncError(error);
    setStatus('Antrenman cihazdan silindi - cloud izni kontrol edilecek', 'ok');
    return;
  }
  unmarkRecordDeleted('workouts', target);
  recordSyncSuccess();
}

function editName() {
  const newName = prompt('İsmini gir:', state.name || '');
  if (!newName) return;

  state.name = newName.trim();
  ensureSyncMeta().pendingProfile = true;
  stateSave();
  renderAll();
  if (canUseCloud()) {
    saveProfileToSupabase().catch(recordSyncError);
  }
  setStatus('İsim güncellendi ✓', 'ok');
}

function editGoals() {
  const firstGoalCurrent = (state.milestones || [])[0] || '';
  const finalGoalCurrent = state.goalWeight || '';
  const firstMeasurement = getSortedMeasurements()[0];
  const startWeightCurrent = state.startWeight ?? firstMeasurement?.weight ?? '';
  const startWaistCurrent = state.startWaist ?? firstMeasurement?.waist ?? '';

  const startWeightInput = prompt('Başlangıç kilonu gir (kg):', startWeightCurrent);
  if (startWeightInput === null) return;

  const startWaistInput = prompt('Başlangıç bel ölçünü gir (cm):', startWaistCurrent);
  if (startWaistInput === null) return;

  const firstGoalInput = prompt('İlk hedef kilonu gir (kg):', firstGoalCurrent);
  if (firstGoalInput === null) return;

  const finalGoalInput = prompt('Final hedef kilonu gir (kg):', finalGoalCurrent);
  if (finalGoalInput === null) return;

  const startWeight = parseLocaleNumber(startWeightInput);
  const startWaist = parseLocaleNumber(startWaistInput);
  const firstGoal = parseLocaleNumber(firstGoalInput);
  const finalGoal = parseLocaleNumber(finalGoalInput);

  if ([startWeight, startWaist, firstGoal, finalGoal].some(value => Number.isNaN(value))) {
    alert('Lütfen tüm hedef alanlarına geçerli sayı gir.');
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
  setStatus('Hedefler güncellendi ✓', 'ok');
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
      <div class="onboarding-kicker">FitTracker hesabı</div>
      <h2 id="authTitle">Giriş yap</h2>
      <p id="authCopy">Web ve iPhone PWA aynı hesapla senkron çalışır.</p>

      <div class="auth-tabs">
        <button class="active" id="authSignInTab" type="button">Giriş</button>
        <button id="authSignUpTab" type="button">Kayıt</button>
      </div>

      <div class="onboarding-grid single">
        <label>
          E-posta
          <input id="authEmail" type="email" autocomplete="email" placeholder="ornek@mail.com" />
        </label>
        <label>
          Şifre
          <input id="authPassword" type="password" autocomplete="current-password" placeholder="En az 6 karakter" />
        </label>
      </div>

      <button class="btn onboarding-submit" id="authSubmit">Giriş yap</button>
      <button class="auth-secondary" id="authResetPassword" type="button">Şifremi unuttum</button>
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

  if (title) title.textContent = mode === 'signIn' ? 'Giriş yap' : 'Hesap oluştur';
  if (copy) copy.textContent = mode === 'signIn'
    ? 'Web ve iPhone PWA aynı hesapla senkron çalışır.'
    : 'Bir hesap oluştur, sonra iPhone’da aynı hesapla giriş yap.';
  if (submit) submit.textContent = mode === 'signIn' ? 'Giriş yap' : 'Hesap oluştur';
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
    return 'E-posta veya şifre hatalı. Daha önce kayıt olduysan tekrar kayıt olma; aynı bilgilerle giriş yapmayı dene veya şifre sıfırla.';
  }

  if (/email not confirmed/i.test(text)) {
    return 'E-posta henüz onaylanmamış görünüyor. Gelen kutundaki doğrulama linkine tıkla, sonra giriş yap.';
  }

  if (/user already registered|already registered/i.test(text)) {
    return 'Bu e-posta ile hesap zaten var. Kayıt yerine Giriş sekmesini kullan.';
  }

  if (/password/i.test(text) && /6|six|short/i.test(text)) {
    return 'Şifre en az 6 karakter olmalı.';
  }

  return text;
}

async function submitAuth() {
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value || '';
  const submitBtn = document.getElementById('authSubmit');

  if (!email || password.length < 6) {
    setAuthMessage('E-posta ve en az 6 karakterli şifre gir.', true);
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = 'İşleniyor...';
  }

  setAuthMessage('İşleniyor...');

  try {
    const authPromise = authMode === 'signIn'
      ? db.auth.signInWithPassword({ email, password })
      : db.auth.signUp({ email, password });

    const authResult = await withTimeout(authPromise, 12000, 'Giriş');

    if (authResult.timedOut) {
      const { data } = await db.auth.getSession();
      if (data?.session) {
        await continueWithSession(data.session, { skipCloudWait: true });
        return;
      }
      setAuthMessage('Giriş isteği uzun sürdü. İnternet bağlantını kontrol edip tekrar dene.', true);
      return;
    }

    if (authResult.error) {
      setAuthMessage(authResult.error.message || 'Giriş sırasında hata oluştu.', true);
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
          ? 'Kayıt tamamlandı. E-posta doğrulaması açıksa gelen kutunu kontrol et.'
          : 'Giriş tamamlandıysa birkaç saniye içinde açılmazsa sayfayı yenile.',
        false
      );
      return;
    }

    await continueWithSession(session, { skipCloudWait: true });
  } catch (error) {
    console.error('Auth işlem hatası:', error);
    setAuthMessage(error?.message || 'Giriş sırasında beklenmeyen hata oluştu.', true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.originalText || (authMode === 'signIn' ? 'Giriş yap' : 'Hesap oluştur');
    }
  }
}

async function resetPassword() {
  const email = document.getElementById('authEmail')?.value.trim();
  if (!email) {
    setAuthMessage('Şifre sıfırlamak için e-posta gir.', true);
    return;
  }

  const { error } = await db.auth.resetPasswordForEmail(email);
  setAuthMessage(error ? error.message : 'Şifre sıfırlama bağlantısı gönderildi.', Boolean(error));
}

async function signOut() {
  activeSessionLoad = null;
  try {
    await db.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('Çıkış yapılırken hata:', error);
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
  setStatus('Giriş bekleniyor', '');
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

  setStatus('Veriler yükleniyor...', '');
  const cloudLoad = withTimeout(loadAllCloudData({ force: true }), options.skipCloudWait ? 4500 : 12000, 'Bulut veri yükleme');

  const finishAfterCloud = result => {
    if (result?.error) console.warn('Bulut veri yükleme hatası:', result.error);
    normalizeProfileState();
    renderAll();

    const hasProfileStart = Number.isFinite(Number(state.startWeight));
    if (!state.onboarded && !hasTrackedData() && !hasProfileStart) {
      setStatus('Başlangıç kurulumu bekleniyor', '');
      showOnboarding();
      return;
    }

    if (result?.timedOut) {
      setStatus('Cloud yanıtı gecikti - yerel veriler hazır', 'error');
    } else if (result?.value?.busy) {
      setStatus('Senkronizasyon devam ediyor', 'ok');
    } else if (result?.error || result?.value?.ok === false) {
      setStatus('Yerel veriler hazır - senkron kontrol edilmeli', 'error');
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
      <h2>Başlangıç bilgilerini ekle</h2>
      <p>Bu bilgiler hedef kartlarını, haftalık ölçüm akışını ve ilerleme grafiklerini kişiselleştirir.</p>

      <div class="onboarding-grid">
        <label>
          İsim
          <input id="onboardName" type="text" placeholder="Adın" />
        </label>
        <label>
          Başlangıç tarihi
          <input id="onboardStartDate" type="date" min="${START_DATE}" value="${START_DATE}" />
        </label>
        <label>
          Başlangıç kilosu
          <input id="onboardStartWeight" type="number" step="0.1" placeholder="kg" />
        </label>
        <label>
          Başlangıç bel ölçümü
          <input id="onboardStartWaist" type="number" step="0.1" placeholder="cm" />
        </label>
        <label>
          İlk hedef kilo
          <input id="onboardFirstGoal" type="number" step="0.1" placeholder="örn: 95" />
        </label>
        <label>
          Ana hedef kilo
          <input id="onboardGoalWeight" type="number" step="0.1" placeholder="örn: 85" />
        </label>
      </div>

      <button class="btn onboarding-submit" id="onboardSubmit">Başla</button>
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
    alert('Lütfen tüm başlangıç bilgilerini doldur.');
    return;
  }

  if (startDate < START_DATE) {
    alert('Başlangıç tarihi 31 Mayıs 2026’dan önce olamaz.');
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
    setStatus('Kurulum yerel kaydedildi - giriş sonrası cloud senkronlanacak', 'ok');
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
    console.warn('İlk ölçüm cloud kaydı yapılamadı:', error);
    setStatus('Kurulum kaydedildi, cloud ölçüm daha sonra senkronlanacak', 'ok');
  } else {
    setStatus('Kurulum tamamlandı ✓', 'ok');
  }

  document.getElementById('onboardingModal')?.remove();
  renderAll();
  if (!error) {
    await loadAllCloudData();
  }
}

// ONLINE STATUS
function updateOnlineStatus() {
  const notice = document.getElementById('offlineNotice');

  if (navigator.onLine) {
    if (notice) notice.classList.remove('visible');
    const pendingCount = getPendingSyncCount();
    setStatus(pendingCount ? `${pendingCount} değişiklik senkron bekliyor` : 'Çevrimiçi', 'ok');
    setSyncDot(pendingCount ? 'busy' : ensureSyncMeta().lastError ? 'err' : 'ok');
  } else {
    if (notice) notice.classList.add('visible');
    setStatus('Çevrimdışı - veriler yerel olarak saklanır', 'error');
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
    setStatus('Senkron için internet bağlantısı gerekiyor', 'error');
    return;
  }

  const result = await loadAllCloudData({ force: true });
  if (result?.ok) setStatus('Web ve PWA verileri senkronize edildi', 'ok');
}

// PWA INSTALL
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
      setStatus('Uygulama yüklendi ✓', 'ok');
    }
  });
}

// INIT
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
    workoutTypeInput.addEventListener('change', () => {
      updateWorkoutDistanceField();
      updateWorkoutGuidance();
    });
    updateWorkoutDistanceField();
  }

  document.querySelectorAll('[data-sleep-hours]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('sleepInput');
      if (input) input.value = btn.dataset.sleepHours;
      btn.closest('.quick-picks')?.querySelectorAll('button').forEach(item => item.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      releaseMobileInputFocus();
    });
  });

  document.querySelectorAll('[data-workout-minutes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('workoutDurationInput');
      if (input) input.value = btn.dataset.workoutMinutes;
      btn.closest('.quick-picks')?.querySelectorAll('button').forEach(item => item.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      releaseMobileInputFocus();
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
          console.log('[SW] Kayıtlı:', reg.scope);
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
        .catch(err => console.warn('[SW] Kayıt hatası:', err));
    });
  }
}

async function checkAuthSession() {
  setStatus('Oturum kontrol ediliyor...', '');

  const fallback = window.setTimeout(() => {
    setStatus('Giriş bekleniyor', '');
    showAuth();
  }, 4500);

  try {
    const { data } = await db.auth.getSession();
    window.clearTimeout(fallback);

    if (!data.session) {
      updateOnlineStatus();
      setStatus('Giriş bekleniyor', '');
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
    console.warn('Oturum kontrolü yapılamadı:', error);
    updateOnlineStatus();
    setStatus('Giriş bekleniyor', '');
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
