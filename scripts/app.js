'use strict';

// SUPABASE
const SUPABASE_URL = 'https://wqbnghfduryuwcjrffyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8ZycJCD6a6qdgYbfPqh6Sg_FaYY_XMb';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'fittracker-pro-auth-v2',
  },
});

console.log('Supabase hazır:', db);

// CONSTANTS
const PANELS = ['pHome', 'pWeight', 'pDaily', 'pProgress', 'pSettings'];
const BN_IDS = ['bn0', 'bn1', 'bn2', 'bn3', 'bn4'];
const STORAGE_KEY = 'ft_state_v3';
const START_DATE = '2026-08-02';
const FIRST_MEASURE_DATE = '2026-08-09';
const FIRST_REPORT_END = shiftIsoDate(FIRST_MEASURE_DATE, -1);
const WEEKLY_MEASURE_DAY = 0;
const DEFAULT_START_WEIGHT = 105;
const WORKOUT_TARGET = 180;
const VERIFIED_WEEK_TOTALS = {};

const WORKOUT_CATALOG = {
  Kuvvet: ['A - Upper Body Focus', 'B - Lower Body & Core', 'C - Hypertrophy & Pumping', 'Arm & Core Pump'],
  Kardiyo: ['Yürüyüş', 'Halı saha maçı'],
};

const WORKOUT_TYPE_LABELS = {
  'Full Body A': 'A - Upper Body Focus',
  'Full Body B': 'B - Lower Body & Core',
  'Full Body C': 'C - Hypertrophy & Pumping',
  'Full Body D': 'Arm & Core Pump',
  Core: 'Arm & Core Pump',
  'Travel Full Body A': 'A - Upper Body Focus',
  'Travel Full Body B': 'B - Lower Body & Core',
  'Other Strength': 'Arm & Core Pump',
  Bisiklet: 'Yürüyüş',
  GrowWithJo: 'Yürüyüş',
  'GrowWithJo Challenge': 'Yürüyüş',
  GrowwithJo: 'Yürüyüş',
  'Diğer Kardiyo': 'Yürüyüş',
};

const LEGACY_WORKOUT_CATEGORY_MAP = {
  'Full Body A': 'Kuvvet',
  'Full Body B': 'Kuvvet',
  'Full Body C': 'Kuvvet',
  'Full Body D': 'Kuvvet',
  'A - Upper Body Focus': 'Kuvvet',
  'B - Lower Body & Core': 'Kuvvet',
  'C - Hypertrophy & Pumping': 'Kuvvet',
  'Arm & Core Pump': 'Kuvvet',
  'Halı saha maçı': 'Kardiyo',
  'Core Temel': 'Kuvvet',
  'Core / Tabata': 'Kuvvet',
  'Karın Bölgesi': 'Kuvvet',
  'Bel ve Stabilizasyon': 'Kuvvet',
  'Plank Serisi': 'Kuvvet',
  'Squat Odaklı': 'Kuvvet',
  'Deadlift Odaklı': 'Kuvvet',
  'Üst Vücut': 'Kuvvet',
  'Alt Vücut': 'Kuvvet',
  'Travel Full Body A': 'Kuvvet',
  'Travel Full Body B': 'Kuvvet',
  'Other Strength': 'Kuvvet',
  'Direnç Bandı': 'Kuvvet',
  'Vücut Ağırlığı': 'Kuvvet',
  'Diğer Kuvvet': 'Kuvvet',
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

// STATE
let state = {
  theme: 'light',
  userId: '',
  userEmail: '',
  onboarded: false,
  name: '',
  startDate: START_DATE,
  startWeight: DEFAULT_START_WEIGHT,
  startWaist: null,
  measurements: [],
  skippedMeasurements: [],
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
    pendingWorkouts: [],
    pendingNotes: [],
    pendingProfile: false,
  },
};

let authMode = 'signIn';
let achievementSessionReady = false;
let progressWeekStart = '';
let progressWeekManuallySelected = false;
let autoSyncTimer = null;

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
let cloudSyncRerunRequested = false;

function ensureSyncMeta() {
  if (!state.syncMeta || typeof state.syncMeta !== 'object') state.syncMeta = {};
  // Aynı nesne yerinde düzeltilir; önceden alınmış referanslar (lastSuccess vb.) kaybolmaz.
  const meta = state.syncMeta;
  meta.lastSuccess = meta.lastSuccess || '';
  meta.lastAttempt = meta.lastAttempt || '';
  meta.lastError = meta.lastError || '';
  ['pendingMeasurements', 'pendingSleep', 'pendingWorkouts', 'pendingNotes'].forEach(name => {
    if (!Array.isArray(meta[name])) meta[name] = [];
  });
  meta.pendingProfile = Boolean(meta.pendingProfile);
  return meta;
}

function markPendingSync(type, key) {
  if (!key) return;
  const syncMeta = ensureSyncMeta();
  const bucketMap = {
    measurements: 'pendingMeasurements',
    sleep: 'pendingSleep',
    workouts: 'pendingWorkouts',
    notes: 'pendingNotes',
  };
  const bucketName = bucketMap[type];
  if (!bucketName) return;
  const bucket = syncMeta[bucketName];
  if (!bucket.includes(key)) bucket.push(key);
}

const PENDING_BUCKETS = {
  measurements: 'pendingMeasurements',
  sleep: 'pendingSleep',
  workouts: 'pendingWorkouts',
  notes: 'pendingNotes',
};

// Bir kaydın cihazlar arası kimliği. Ölçüm ve uyku günde tek kayıttır (tarih),
// antrenman ve not kimlikle (UUID) izlenir.
function getSyncKey(type, item = {}) {
  if (type === 'measurements' || type === 'sleep') return item.date || '';
  return item.id || '';
}

function isPendingSync(type, item = {}) {
  const key = getSyncKey(type, item);
  if (!key) return false;
  if ((type === 'workouts' || type === 'notes') && /^local-(workout|note)-/.test(String(key))) return true;
  const bucket = ensureSyncMeta()[PENDING_BUCKETS[type]] || [];
  return bucket.includes(key);
}

function newRecordId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Buluttan kalkmış (başka cihazda silinmiş) yerel kayıtlar sessizce yok olmasın:
// son 200 tanesi bu cihazda kurtarma için saklanır.
function rememberDiscardedRecords(type, items) {
  if (!items.length) return;
  try {
    const key = `${STORAGE_KEY}_discarded_${state.userId || 'anonymous'}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const at = new Date().toISOString();
    const next = [...existing, ...items.map(item => ({ type, at, item }))].slice(-200);
    localStorage.setItem(key, JSON.stringify(next));
  } catch (error) {
    console.warn('Kurtarma kaydı yazılamadı:', error);
  }
}

// Tek doğru kaynak bulut; bu cihazda henüz gönderilmemiş (bekleyen) değişiklikler
// buluttaki sürümün önüne geçer. Bekleyen olmayan ve bulutta bulunmayan yerel kayıt
// başka cihazda silinmiştir; geri yüklenmez.
function mergeCloudWithLocal(type, cloudItems, localItems) {
  const cloudVisible = cloudItems.filter(item => !isRecordDeleted(type, item));
  const localPending = localItems.filter(item => !isRecordDeleted(type, item) && isPendingSync(type, item));
  const pendingKeys = new Set(localPending.map(item => getSyncKey(type, item)));
  const cloudKeys = new Set(cloudVisible.map(item => getSyncKey(type, item)));

  const discarded = localItems.filter(item =>
    !isRecordDeleted(type, item) &&
    !isPendingSync(type, item) &&
    !cloudKeys.has(getSyncKey(type, item))
  );
  rememberDiscardedRecords(type, discarded);

  return [
    ...cloudVisible.filter(item => !pendingKeys.has(getSyncKey(type, item))),
    ...localPending,
  ];
}

function clearPendingSync(type, key) {
  const syncMeta = ensureSyncMeta();
  const bucketMap = {
    measurements: 'pendingMeasurements',
    sleep: 'pendingSleep',
    workouts: 'pendingWorkouts',
    notes: 'pendingNotes',
  };
  const bucketName = bucketMap[type];
  if (!bucketName) return;
  syncMeta[bucketName] = syncMeta[bucketName].filter(item => item !== key);
}

function getPendingSyncCount() {
  const syncMeta = ensureSyncMeta();
  const localWorkouts = (state.workouts || []).filter(item => String(item?.id || '').startsWith('local-workout-')).length;
  const localNotes = (state.notes || []).filter(item => String(item?.id || '').startsWith('local-note-')).length;
  const deletionBuckets = Object.values(state.deletedRecords || {})
    .reduce((total, bucket) => total + (Array.isArray(bucket) && bucket.length ? 1 : 0), 0);

  return syncMeta.pendingMeasurements.length +
    syncMeta.pendingSleep.length +
    syncMeta.pendingWorkouts.length +
    syncMeta.pendingNotes.length +
    Number(syncMeta.pendingProfile) +
    localWorkouts +
    localNotes +
    deletionBuckets;
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

function recordSyncError(error) {
  const syncMeta = ensureSyncMeta();
  syncMeta.lastError = getSyncErrorMessage(error);
  stateSave();
  setSyncDot('err');
  renderSettings();
}
// HELPERS
function today() {
  return toLocalIsoDate(new Date());
}

function getSuggestedMeasureDate() {
  const latest = getSortedMeasurements().at(-1);
  const latestSkipped = getSkippedMeasurements().at(-1);
  const latestDate = [latest?.date, latestSkipped?.date]
    .filter(Boolean)
    .sort()
    .at(-1);

  if (latestDate) {
    const parts = parseIsoDateParts(latestDate);
    if (parts) {
      const next = new Date(parts.year, parts.month - 1, parts.day);
      next.setDate(next.getDate() + 7);
      return toLocalIsoDate(next);
    }
  }

  return FIRST_MEASURE_DATE;
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

function isTrackableActivityDate(dateValue) {
  return Boolean(dateValue && dateValue >= START_DATE);
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
  const field = distanceInput.closest('.distance-field');
  if (field) field.hidden = !visible;
  distanceInput.disabled = !visible;
  if (!visible) distanceInput.value = '';
}

function getWorkoutGuidance(category = 'Kuvvet', type = '') {
  const guide = {
    Kuvvet: {
      title: 'Kuvvet planı',
      text: 'A/B/C rotasyonunu ve Arm & Core Pump gününü sürdür. Bu alanı sadece belirlediğin kuvvet programları için kullan.',
    },
    Kardiyo: {
      title: 'Kardiyo planı',
      text: 'Kardiyo tarafında sadece yürüyüş ve halı saha maçını takip et. Yürüyüşte mesafeyi de ekleyebilirsin.',
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
  return Number(number.toFixed(digits)).toLocaleString('tr-TR', { maximumFractionDigits: digits });
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

function getSleepQuality(hours) {
  const value = Number(hours || 0);
  if (value >= 7 && value <= 9) return 'Hedefte';
  if (value > 9) return 'Yüksek';
  if (value >= 6) return 'Sınırda';
  return 'Düşük';
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

function parseWaist(value) {
  const numeric = parseOptionalNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function isValidWaist(value) {
  return parseWaist(value) !== null;
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
  const firstMeasureParts = parseIsoDateParts(FIRST_MEASURE_DATE);
  if (!parts || !firstMeasureParts) return null;

  if (date >= FIRST_MEASURE_DATE) return date;

  const isFirstMeasureDayWrongYear = parts.month === firstMeasureParts.month && parts.day === firstMeasureParts.day;
  return isFirstMeasureDayWrongYear ? FIRST_MEASURE_DATE : null;
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

  const shouldShow = cls === 'error' || !['Hazır', 'Senkron aktif', 'Senkron tamamlandı', 'Çevrimiçi'].includes(msg);
  bar.className = `status-bar ${cls}${shouldShow ? ' visible' : ''}`;
  text.textContent = msg;
  // Bilgi mesajları kısa süre görünür; yalnız hatalar ekranda kalır.
  window.clearTimeout(setStatus.hideTimer);
  if (shouldShow && cls !== 'error') {
    setStatus.hideTimer = window.setTimeout(() => bar.classList.remove('visible'), 2500);
  }
}

function clearInitialLoadingStatus() {
  const text = document.getElementById('statusText');
  if (text && text.textContent.includes('Yükleniyor')) {
    setStatus('Hazır', 'ok');
  }
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
        waist: parseWaist(item.waist),
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
  return getSortedMeasurements()
    .filter(item => item.date >= FIRST_MEASURE_DATE && Number.isFinite(Number(item.weight)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getProfileStartMeasurement() {
  const weight = Number(state.startWeight);
  if (!Number.isFinite(weight)) return null;

  return {
    date: state.startDate || START_DATE,
    weight,
    waist: parseWaist(state.startWaist),
    isProfileStart: true,
  };
}

function getMeasurementSummaryData() {
  const trendData = getMeasurementTrendData();
  const profileStart = getProfileStartMeasurement();

  if (!profileStart) return trendData;
  if (!trendData.length) return [profileStart];
  if (trendData[0].date <= profileStart.date) return trendData;

  return [profileStart, ...trendData];
}

function getSkippedMeasurements() {
  return (Array.isArray(state.skippedMeasurements) ? state.skippedMeasurements : [])
    .filter(item => item?.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getLatestWaistMeasurement() {
  return getSortedMeasurements()
    .filter(item => isValidWaist(item.waist) && shouldTrackWaist(item.date))
    .at(-1);
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
    if (!required) waistInput.value = '';
  }
  const waistField = document.getElementById('waistField');
  if (waistField) waistField.hidden = !required;

  let nextWaist = sequence + 1;
  while (nextWaist % 4 !== 0) nextWaist += 1;
  hint.textContent = required
    ? sequence === 1
      ? 'Başlangıç tartısı: bel ölçümünü de ekle.'
      : `${sequence}. tartı: bu hafta bel ölçümü de var.`
    : `${sequence}. tartı: sadece kilo yeter. Sıradaki bel ölçümü ${nextWaist}. tartıda.`;

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

  if (!Number.isFinite(Number(state.startWeight)) || Number(state.startWeight) !== DEFAULT_START_WEIGHT) {
    state.startWeight = DEFAULT_START_WEIGHT;
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
  const hasProfileStart = Number.isFinite(Number(state.startWeight));
  if (!hasTrackedData() && !hasProfileStart) return false;

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
        pendingWorkouts: Array.isArray(savedState.syncMeta?.pendingWorkouts) ? savedState.syncMeta.pendingWorkouts : [],
        pendingNotes: Array.isArray(savedState.syncMeta?.pendingNotes) ? savedState.syncMeta.pendingNotes : [],
        pendingProfile: Boolean(savedState.syncMeta?.pendingProfile),
      },
      measurements: Array.isArray(savedState.measurements) ? savedState.measurements : [],
      skippedMeasurements: Array.isArray(savedState.skippedMeasurements) ? savedState.skippedMeasurements : [],
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
    themeMeta.content = state.theme === 'dark' ? '#0B0F17' : '#F4F5F7';
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
      renderProgress();
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
function getAchievementMetrics() {
  const measurements = getMeasurementSummaryData();
  const trackedSleep = (state.sleep || []).filter(item => isTrackableActivityDate(item.date));
  const trackedWorkouts = (state.workouts || []).filter(item => isTrackableActivityDate(item.date));
  const trackedNotes = (state.notes || []).filter(item => isTrackableActivityDate(item.date));
  const firstWeight = Number(state.startWeight ?? measurements[0]?.weight ?? 0);
  const lastWeight = Number(measurements.at(-1)?.weight ?? firstWeight);
  const weightLoss = Math.max(0, firstWeight - lastWeight);
  const firstGoal = Number((state.milestones || [])[0]);
  const walkingDistance = trackedWorkouts
    .reduce((total, item) => total + getWorkoutDistanceFromNote(item.note), 0);
  const activityCount = trackedSleep.length + trackedWorkouts.length + trackedNotes.length;
  const weeks = new Map();

  trackedSleep.forEach(item => {
    if (!item?.date) return;
    const start = getSleepReportRangeForDate(item.date).start;
    if (!weeks.has(start)) weeks.set(start, { sleep: new Set(), workouts: new Set() });
    const bucket = weeks.get(start);
    bucket.sleep.add(item.date);
  });

  trackedWorkouts.forEach(item => {
    if (!item?.date) return;
    const start = getWeekRange(item.date).start;
    if (!weeks.has(start)) weeks.set(start, { sleep: new Set(), workouts: new Set() });
    const bucket = weeks.get(start);
    bucket.workouts.add(item.date);
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
    { id: 'walk-50', icon: '50', title: 'Uzun Yol', detail: 'Toplam 50 km yürüyüş', current: metrics.walkingDistance, target: 50, unit: 'km' },
    { id: 'loss-5', icon: '5-', title: 'Dönüşüm', detail: 'Toplam 5 kg ilerleme', current: metrics.weightLoss, target: 5, unit: 'kg' },
    { id: 'loss-10', icon: '10', title: 'Büyük Dönüşüm', detail: 'Toplam 10 kg ilerleme', current: metrics.weightLoss, target: 10, unit: 'kg' },
    { id: 'goal-1', icon: 'H1', title: 'İlk Hedef', detail: 'İlk kilo hedefine ulaş', current: metrics.firstGoalReached ? 1 : 0, target: 1 },
    { id: 'streak-3', icon: '3H', title: 'İstikrar', detail: '3 hafta üst üste kayıt', current: metrics.bestStreak, target: 3 },
    { id: 'streak-6', icon: '6H', title: 'Seri Korundu', detail: '6 hafta üst üste kayıt', current: metrics.bestStreak, target: 6 },
  ].map(item => ({
    ...item,
    unlocked: Number(item.current) >= Number(item.target),
    progress: Math.min(100, Math.round((Number(item.current || 0) / Number(item.target || 1)) * 100)),
  }));
}

function formatAchievementProgress(item) {
  const current = item.unit === 'km'
    ? trNum(item.current, 2)
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

  // Yeni cihazda ilk bulut yüklemesi bitene kadar rozetler sessizce işaretlenir;
  // aksi halde eski rozetler "yeni başarı" gibi bildirilir.
  if (!achievementSessionReady || !ensureSyncMeta().lastSuccess) {
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

function getWeekRange(dateValue) {
  const parts = String(dateValue || '').split('-').map(Number);
  const date = parts.length === 3 && parts.every(Number.isFinite)
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(dateValue);
  const isoDate = toLocalIsoDate(date);

  if (isoDate >= START_DATE && isoDate < FIRST_MEASURE_DATE) {
    return {
      start: START_DATE,
      end: FIRST_REPORT_END,
    };
  }

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

function getInclusiveDayCount(startDate, endDate) {
  const startParts = parseIsoDateParts(startDate);
  const endParts = parseIsoDateParts(endDate);
  if (!startParts || !endParts) return 7;

  const start = new Date(startParts.year, startParts.month - 1, startParts.day);
  const end = new Date(endParts.year, endParts.month - 1, endParts.day);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function getRangeDayCount(range) {
  if (!range?.start || !range?.end) return 7;
  return getInclusiveDayCount(range.start, range.end);
}

function getSleepTargetForRange(range) {
  return getRangeDayCount(range) * 7;
}

function getWorkoutTargetForRange(range) {
  return Math.round((WORKOUT_TARGET / 7) * getRangeDayCount(range));
}

function getSleepReportRangeForDate(dateValue) {
  return getWeekRange(dateValue);
}

function itemMatchesReportRange(item, range, mode = 'activity') {
  if (!item?.date || !range?.start || !range?.end) return false;
  const reportRange = mode === 'sleep'
    ? getSleepReportRangeForDate(item.date)
    : getWeekRange(item.date);
  return reportRange.start === range.start && reportRange.end === range.end;
}

function getWeeklyProgressData() {
  const weeks = {};

  const ensureWeek = range => {
    const key = `${range.start}_${range.end}`;
    if (!weeks[key]) {
      weeks[key] = {
        start: range.start,
        end: range.end,
        sleep: 0,
        workouts: 0,
      };
    }
    return weeks[key];
  };

  (state.sleep || []).filter(item => isTrackableActivityDate(item.date)).forEach(item => {
    const range = getSleepReportRangeForDate(item.date);
    ensureWeek(range).sleep += Number(item.hours || 0);
  });

  (state.workouts || []).filter(item => isTrackableActivityDate(item.date)).forEach(item => {
    const range = getWeekRange(item.date);
    ensureWeek(range).workouts += Number(item.duration || 0);
  });

  getSortedMeasurements().forEach(item => ensureWeek(getWeekRange(item.date)));
  getSkippedMeasurements().forEach(item => ensureWeek(getWeekRange(item.date)));

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

function getWorkoutTypeName(type = '') {
  const cleanType = String(type || 'Antrenman').trim() || 'Antrenman';
  return WORKOUT_TYPE_LABELS[cleanType] || cleanType;
}

function getWorkoutDisplayType(item = {}) {
  const cleanType = String(item.type || '').trim();
  const noteCategory = String(item.note || '').match(/Kategori:\s*([^·]+)/i)?.[1]?.trim() || '';

  if (
    cleanType === 'Yürüyüş' &&
    noteCategory === 'Kuvvet' &&
    Number(item.duration || 0) >= 45 &&
    getWorkoutDistanceFromNote(item.note) <= 0
  ) {
    return 'Halı saha maçı';
  }

  return getWorkoutTypeName(cleanType);
}

function getWorkoutDisplayCategory(item = {}) {
  const displayType = getWorkoutDisplayType(item);
  return getWorkoutCategory(displayType);
}

function getSelectedProgressWeek(weekly = getWeeklyProgressData()) {
  if (!weekly.length) return null;
  const sorted = [...weekly].sort((a, b) => a.start.localeCompare(b.start));
  const currentRange = getWeekRange(today());
  const current = sorted.find(item => item.start === currentRange.start);
  const selected = sorted.find(item => item.start === progressWeekStart);
  if (selected && progressWeekManuallySelected) return selected;
  const hasActivity = item => Number(item?.sleep || 0) > 0 || Number(item?.workouts || 0) > 0;
  if (current && hasActivity(current)) {
    progressWeekStart = current.start;
    return current;
  }
  const latestActive = [...sorted].reverse().find(hasActivity);
  if (latestActive) {
    progressWeekStart = latestActive.start;
    return latestActive;
  }
  if (current) {
    progressWeekStart = current.start;
    return current;
  }
  if (selected) return selected;
  const latest = sorted[sorted.length - 1];
  progressWeekStart = latest.start;
  return latest;
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
    startWeightEl.textContent = Number.isFinite(Number(startWeight)) ? `${trNum(startWeight)} kg` : '— kg';
  }
  if (currentWeightEl) {
    currentWeightEl.textContent = lastMeasurement?.weight ? `${trNum(lastMeasurement.weight)} kg` : '— kg';
  }
  if (currentWaistEl) {
    currentWaistEl.textContent = lastWaistMeasurement?.waist ? `${trNum(lastWaistMeasurement.waist)} cm` : 'Ayda bir';
  }
  if (firstGoalEl) firstGoalEl.textContent = firstGoal ? `${trNum(firstGoal)} kg` : 'Belirlenmedi';
  if (finalGoalEl) finalGoalEl.textContent = finalGoal ? `${trNum(finalGoal)} kg` : 'Belirlenmedi';
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

// ─────────────────────────────────────────────────────────────
// SADE ARAYÜZ (2026-11) — her ekran tek katman kart, tek font.
// Hesaplar mevcut veri fonksiyonlarını kullanır; burada yalnız görünüm var.
// ─────────────────────────────────────────────────────────────
let entryTab = 'workout';
let showAllRecent = false;
let showAllWeights = false;
let showAllWeeks = false;
const COLLAPSED_ROWS = 5;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Türkçe sayı: 99,1 · 1.250
function trNum(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function signedTr(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const rounded = Number(number.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${trNum(Math.abs(rounded), digits)}`;
}

function formatShortDate(iso) {
  const parts = parseIsoDateParts(iso);
  if (!parts) return '';
  return new Date(parts.year, parts.month - 1, parts.day)
    .toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function formatShortRange(range) {
  if (!range?.start || !range?.end) return '';
  const a = parseIsoDateParts(range.start);
  const b = parseIsoDateParts(range.end);
  if (a && b && a.month === b.month) return `${a.day}–${formatShortDate(range.end)}`;
  return `${formatShortDate(range.start)}–${formatShortDate(range.end)}`;
}

// Kilo ilerlemesi: tüm ekranlar aynı başlangıcı (profil başlangıcı) kullanır.
function getWeightProgress() {
  const data = getMeasurementSummaryData();
  if (!data.length) return null;
  const first = data[0];
  const last = data[data.length - 1];
  const milestones = (state.milestones || []).map(Number).filter(Number.isFinite);
  const finalGoal = Number.isFinite(Number(state.goalWeight)) ? Number(state.goalWeight) : milestones.at(-1);
  const goal = milestones.find(value => last.weight > value) ?? finalGoal ?? milestones.at(-1);
  const lost = Number(first.weight) - Number(last.weight);
  const needed = Number(first.weight) - Number(goal);
  const pct = needed > 0 ? Math.max(0, Math.min(100, Math.round((lost / needed) * 100))) : 100;
  const finalNeeded = Number(first.weight) - Number(finalGoal);
  const finalPct = finalNeeded > 0 ? Math.max(0, Math.min(100, Math.round((lost / finalNeeded) * 100))) : 100;
  return {
    first,
    last,
    lost,
    goal,
    finalGoal,
    pct,
    finalPct,
    left: Math.max(0, Number(last.weight) - Number(goal)),
    lastIsMeasured: !last.isProfileStart,
  };
}

// Bel ilerlemesi: başlangıç = profildeki başlangıç beli (yoksa ilk bel ölçümü).
function getWaistProgress() {
  const waists = getSortedMeasurements().filter(item => isValidWaist(item.waist));
  const profileWaist = parseWaist(state.startWaist);
  const start = isValidWaist(profileWaist)
    ? { date: state.startDate || START_DATE, waist: Number(profileWaist) }
    : waists[0] ? { date: waists[0].date, waist: Number(waists[0].waist) } : null;
  const last = waists.at(-1) ? { date: waists.at(-1).date, waist: Number(waists.at(-1).waist) } : start;
  if (!start || !last) return null;
  return { start, last, diff: last.waist - start.waist };
}

function getMeasureDue() {
  const date = getSuggestedMeasureDate();
  return {
    date,
    due: date <= today(),
    seq: getMeasurementSequenceNumber(date),
    waist: shouldTrackWaist(date),
  };
}

function getRangeTotals(range) {
  const sleepNights = new Set();
  let sleep = 0;
  (state.sleep || []).forEach(item => {
    if (itemMatchesReportRange(item, range, 'sleep')) {
      sleep += Number(item.hours || 0);
      sleepNights.add(item.date);
    }
  });
  const workoutDays = new Set();
  let workouts = 0;
  let sessions = 0;
  (state.workouts || []).forEach(item => {
    if (item.date >= range.start && item.date <= range.end) {
      workouts += Number(item.duration || 0);
      workoutDays.add(item.date);
      sessions += 1;
    }
  });
  const verified = VERIFIED_WEEK_TOTALS[range.start];
  if (verified) {
    sleep = verified.sleep;
    workouts = verified.workouts;
  }
  return {
    sleep,
    sleepNights: verified?.sleepNights || sleepNights.size,
    workouts,
    workoutDays: workoutDays.size,
    sessions,
    sleepTarget: getSleepTargetForRange(range),
    workoutTarget: getWorkoutTargetForRange(range),
    walking: getWalkingStatsForRange(range),
  };
}

function getWeekStatus(totals) {
  const sleepPct = totals.sleepTarget ? totals.sleep / totals.sleepTarget : 0;
  const workoutPct = totals.workoutTarget ? totals.workouts / totals.workoutTarget : 0;
  if (sleepPct >= 0.9 && workoutPct >= 0.9) return { label: 'Güçlü', tone: 'good' };
  if (sleepPct < 0.65 || workoutPct < 0.65) return { label: 'Takviye', tone: 'warn' };
  return { label: 'Dengeli', tone: 'neutral' };
}

// Uyku hedefini art arda tutturulan hafta sayısı (bitmemiş bu hafta, tutmadıysa sayılmaz).
function getSleepWeekStreak() {
  const currentStart = getWeekRange(today()).start;
  const weeks = getWeeklyProgressData().sort((a, b) => b.start.localeCompare(a.start));
  let streak = 0;
  for (const week of weeks) {
    const met = Number(week.sleep || 0) >= getSleepTargetForRange(week) - 0.01;
    if (week.start === currentStart && !met) continue;
    if (!met) break;
    streak += 1;
  }
  return streak;
}

function getTodayFocus() {
  const t = today();
  const due = getMeasureDue();
  if (due.due) {
    return {
      kind: 'measure',
      eyebrow: 'Bugünün odağı',
      title: `${due.date === t ? 'Tartı günü' : 'Tartı zamanı geldi'} · ${due.seq}. tartı`,
      sub: due.waist ? 'Bu tartıda bel ölçümü de var' : 'Sabah aç karnına, sadece kilo yeter',
      panel: 1,
    };
  }
  const yesterday = shiftIsoDate(t, -1);
  const hasSleep = (state.sleep || []).some(item => item.date === yesterday || item.date === t);
  if (!hasSleep) {
    return { kind: 'sleep', eyebrow: 'Bugünün odağı', title: 'Dün geceki uykunu gir', sub: 'Tek dokunuş: 7 · 7,5 · 8 saat', panel: 2, tab: 'sleep' };
  }
  const week = getWeekRange(t);
  const totals = getRangeTotals(week);
  const left = Math.max(0, totals.workoutTarget - totals.workouts);
  if (left > 0) {
    return {
      kind: 'workout',
      eyebrow: 'Bu haftanın odağı',
      title: totals.workouts ? `Antrenman hedefine ${trNum(left, 0)} dk kaldı` : 'Haftanın ilk antrenmanı',
      sub: `Hedef ${totals.workoutTarget} dk · yaklaşık ${Math.max(1, Math.ceil(left / 60))} seans`,
      panel: 2,
      tab: 'workout',
    };
  }
  return { kind: 'done', eyebrow: 'Harika gidiyorsun', title: 'Bu haftanın hedefleri tamam', sub: 'Ritmi koru; istersen bugüne bir not ekle.', panel: 2, tab: 'note' };
}

const ICONS = {
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0M12 12l1.5-2"/>',
  moon: '<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  ruler: '<path d="M4 20c0-6 4-8 8-8s8 2 8 8M12 12a4 4 0 1 0 0-8"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
};

function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function renderHero() {
  const dateEl = document.getElementById('heroDate');
  const nameEl = document.getElementById('heroName');
  if (dateEl) {
    const week = Math.floor(getInclusiveDayCount(state.startDate || START_DATE, today()) / 7) + 1;
    const dateText = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
    dateEl.textContent = today() >= (state.startDate || START_DATE) ? `${dateText} · ${week}. hafta` : dateText;
  }
  if (nameEl) nameEl.textContent = String(state.name || 'Sporcu').split(' ')[0];
}

function renderDashboard() {
  const focusEl = document.getElementById('dashFocus');
  const goalEl = document.getElementById('dashGoal');
  const highlightsEl = document.getElementById('dashHighlights');
  const weekEl = document.getElementById('dashWeek');

  if (focusEl) {
    const focus = getTodayFocus();
    const iconName = { measure: 'scale', sleep: 'moon', workout: 'dumbbell', done: 'check' }[focus.kind];
    focusEl.innerHTML = `
      <button type="button" class="focus-card" data-focus-panel="${focus.panel}" data-focus-tab="${focus.tab || ''}">
        <span class="focus-icon">${icon(iconName, 24)}</span>
        <span class="focus-copy">
          <span class="focus-eyebrow">${focus.eyebrow}</span>
          <span class="focus-title">${escapeHtml(focus.title)}</span>
          <span class="focus-sub">${escapeHtml(focus.sub)}</span>
        </span>
        <span class="focus-go">${icon('chevron', 20)}</span>
      </button>`;
    focusEl.querySelector('[data-focus-panel]')?.addEventListener('click', event => {
      const btn = event.currentTarget;
      if (btn.dataset.focusTab) setEntryTab(btn.dataset.focusTab);
      goPanel(Number(btn.dataset.focusPanel));
    });
  }

  const weight = getWeightProgress();
  if (goalEl) {
    if (!weight) {
      goalEl.innerHTML = `<div class="card empty">İlk ölçümünü eklediğinde hedef ilerlemen burada görünür.</div>`;
    } else {
      const circumference = 2 * Math.PI * 50;
      const dash = (weight.pct / 100) * circumference;
      goalEl.innerHTML = `
        <section class="card goal-card" aria-label="Hedefe ilerleme">
          <div class="ring" role="img" aria-label="Ara hedefin yüzde ${weight.pct}'i tamamlandı">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle class="ring-track" cx="60" cy="60" r="50"/>
              <circle class="ring-fill" cx="60" cy="60" r="50" stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}" transform="rotate(-90 60 60)"/>
            </svg>
            <span class="ring-label"><strong>%${weight.pct}</strong><small>ara hedef</small></span>
          </div>
          <div class="goal-copy">
            <span class="label">${weight.lastIsMeasured ? `Güncel kilo · ${formatShortDate(weight.last.date)}` : 'Başlangıç kilosu'}</span>
            <span class="big-number">${trNum(weight.last.weight)} <small>kg</small></span>
            ${weight.lost > 0 ? `<span class="good-text">−${trNum(weight.lost)} kg verdin</span>` : ''}
            <span class="muted-text">${weight.left > 0 ? `${trNum(weight.goal)} kg'a ${trNum(weight.left)} kg kaldı` : `${trNum(weight.goal)} kg hedefine ulaştın`}</span>
          </div>
        </section>`;
    }
  }

  if (highlightsEl) {
    const streak = getSleepWeekStreak();
    const waist = getWaistProgress();
    const walkingTotal = (state.workouts || []).reduce((total, item) => total + getWorkoutDistanceFromNote(item.note), 0);
    const cards = [];
    if (streak > 0) {
      cards.push(`<div class="card stat"><span class="stat-icon sleep">${icon('moon', 20)}</span><strong>${streak} hafta</strong><span>üst üste uyku hedefinde</span></div>`);
    }
    if (waist && waist.diff < 0) {
      cards.push(`<div class="card stat"><span class="stat-icon good">${icon('ruler', 20)}</span><strong>${signedTr(waist.diff)} cm</strong><span>belden · ${trNum(waist.start.waist)} → ${trNum(waist.last.waist)}</span></div>`);
    }
    if (cards.length < 2 && walkingTotal > 0) {
      cards.push(`<div class="card stat"><span class="stat-icon accent">${icon('dumbbell', 20)}</span><strong>${trNum(walkingTotal)} km</strong><span>toplam yürüyüş</span></div>`);
    }
    highlightsEl.innerHTML = cards.slice(0, 2).join('');
    highlightsEl.hidden = !cards.length;
  }

  if (weekEl) {
    const range = getWeekRange(today());
    const totals = getRangeTotals(range);
    const prevRange = getWeekRange(shiftIsoDate(range.start, -1));
    const prev = getRangeTotals(prevRange);
    const sleepPct = Math.min(100, Math.round((totals.sleep / totals.sleepTarget) * 100) || 0);
    const workoutPct = Math.min(100, Math.round((totals.workouts / totals.workoutTarget) * 100) || 0);
    let coach = '';
    if (prev.workouts > 0 || prev.sleep > 0) {
      const prevLeft = prev.workoutTarget - prev.workouts;
      coach = prevLeft > 0
        ? `Geçen hafta antrenman hedefine <b>${trNum(prevLeft, 0)} dk</b> kalmıştı. Bu hafta ${Math.max(1, Math.ceil((totals.workoutTarget - totals.workouts) / 60))} seans yeterli.`
        : `Geçen hafta antrenman hedefini <b>${trNum(prev.workouts, 0)} dk</b> ile tutturdun. Aynı ritim.`;
    }
    weekEl.innerHTML = `
      <section class="card" aria-label="Bu hafta">
        <div class="card-head"><h2>Bu hafta</h2><span class="muted-text">${formatShortRange(range)}</span></div>
        <div class="meter">
          <div class="meter-row"><span>Uyku</span><span><b>${trNum(totals.sleep)}</b> / ${totals.sleepTarget} saat</span></div>
          <div class="bar"><i class="sleep" style="width:${sleepPct}%"></i></div>
        </div>
        <div class="meter">
          <div class="meter-row"><span>Antrenman</span><span><b>${trNum(totals.workouts, 0)}</b> / ${totals.workoutTarget} dk</span></div>
          <div class="bar"><i style="width:${workoutPct}%"></i></div>
        </div>
        ${coach ? `<p class="coach">${coach}</p>` : ''}
      </section>`;
  }
}

function renderAchievements() {
  const showcase = document.getElementById('achievementShowcase');
  const dashboard = document.getElementById('dashboardAchievement');
  const achievements = getAchievements();
  const unlocked = achievements.filter(item => item.unlocked);
  const next = achievements.filter(item => !item.unlocked).sort((a, b) => b.progress - a.progress)[0];

  if (dashboard) {
    dashboard.innerHTML = `
      <button type="button" class="card link-row" data-go-panel="4">
        <span class="badge-count">${unlocked.length}</span>
        <span class="link-copy">
          <strong>${unlocked.length} / ${achievements.length} rozet</strong>
          <small>${next ? `Sıradaki: ${escapeHtml(next.title)} · ${formatAchievementProgress(next)}` : 'Tüm rozetler tamamlandı'}</small>
        </span>
        ${icon('chevron', 18)}
      </button>`;
  }

  if (showcase) {
    showcase.innerHTML = `
      <div class="card-head"><h2>Rozetler</h2><span class="muted-text">${unlocked.length} / ${achievements.length}</span></div>
      <div class="badge-grid">
        ${achievements.map(item => `
          <div class="badge ${item.unlocked ? 'is-on' : ''}">
            <span class="badge-icon">${item.unlocked ? icon('check', 16) : escapeHtml(item.icon)}</span>
            <span class="badge-copy">
              <strong>${escapeHtml(item.title)}</strong>
              <small>${item.unlocked ? escapeHtml(item.detail) : formatAchievementProgress(item)}</small>
            </span>
          </div>`).join('')}
      </div>`;
  }

  updateAchievementState(achievements);
}

function renderWeightSummary() {
  const el = document.getElementById('weightSummary');
  if (!el) return;
  const weight = getWeightProgress();
  const waist = getWaistProgress();
  if (!weight) {
    el.innerHTML = '';
    return;
  }
  const lostClass = weight.lost > 0 ? 'good-text' : weight.lost < 0 ? 'bad-text' : '';
  const waistClass = waist && waist.diff < 0 ? 'good-text' : waist && waist.diff > 0 ? 'bad-text' : '';
  el.innerHTML = `
    <div class="card mini"><span class="label">Son</span><strong>${trNum(weight.last.weight)} kg</strong></div>
    <div class="card mini"><span class="label">Toplam</span><strong class="${lostClass}">${signedTr(-weight.lost)} kg</strong></div>
    <div class="card mini"><span class="label">Bel</span><strong class="${waistClass}">${waist ? `${signedTr(waist.diff)} cm` : '—'}</strong></div>`;
}

function renderWeightList() {
  const list = document.getElementById('weightList');
  const empty = document.getElementById('weightEmpty');
  if (!list || !empty) return;

  const measurementDesc = [...getSortedMeasurements()].sort((a, b) => b.date.localeCompare(a.date));
  const summaryData = getMeasurementSummaryData();
  const rows = [
    ...summaryData.map(item => ({ ...item, measurementIndex: measurementDesc.findIndex(m => m.date === item.date) })),
    ...getSkippedMeasurements().map(item => ({ ...item, isSkipped: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  empty.hidden = rows.length > 0;
  const visibleRows = showAllWeights ? rows : rows.slice(0, COLLAPSED_ROWS);
  list.innerHTML = visibleRows.map(m => {
    if (m.isSkipped) {
      return `<div class="row"><span class="row-date">${formatShortDate(m.date)}</span><span class="row-main"><strong>Atlandı</strong><small>${escapeHtml(m.reason || 'Tartıya erişim yok')}</small></span><button type="button" class="chip-btn" data-unskip="${m.date}">Geri al</button><span class="row-spacer"></span></div>`;
    }
    const prev = summaryData.filter(item => item.date < m.date && Number.isFinite(Number(item.weight))).at(-1);
    const diff = prev ? Number(m.weight) - Number(prev.weight) : null;
    const rounded = diff === null ? null : Number(diff.toFixed(1));
    const tone = rounded === null ? 'neutral' : rounded < 0 ? 'good' : rounded > 0 ? 'bad' : 'neutral';
    const waistText = isValidWaist(m.waist) ? `Bel ${trNum(m.waist)} cm` : m.isProfileStart ? 'Başlangıç' : 'Bel ölçülmedi';
    const deleteBtn = m.isProfileStart || m.measurementIndex < 0
      ? '<span class="row-spacer"></span>'
      : `<button type="button" class="icon-only" onclick="deleteWeight(${m.measurementIndex})" aria-label="${formatShortDate(m.date)} ölçümünü sil">${icon('close', 16)}</button>`;
    return `
      <div class="row">
        <span class="row-date">${formatShortDate(m.date)}</span>
        <span class="row-main"><strong>${trNum(m.weight)} kg</strong><small>${waistText}</small></span>
        <span class="chip ${tone}">${rounded === null ? 'Başlangıç' : `${signedTr(rounded)} kg`}</span>
        ${deleteBtn}
      </div>`;
  }).join('') + (rows.length > COLLAPSED_ROWS
    ? `<button type="button" class="more-btn" data-toggle-weights>${showAllWeights ? 'Daha az göster' : `Tümünü göster (${rows.length})`}</button>`
    : '');
  list.querySelectorAll('[data-unskip]').forEach(btn => btn.addEventListener('click', () => unskipMeasurement(btn.dataset.unskip)));
  list.querySelector('[data-toggle-weights]')?.addEventListener('click', () => {
    showAllWeights = !showAllWeights;
    renderWeightList();
  });
}

function setEntryTab(tab) {
  entryTab = ['sleep', 'workout', 'note'].includes(tab) ? tab : 'workout';
  document.querySelectorAll('[data-entry-tab]').forEach(btn => {
    const active = btn.dataset.entryTab === entryTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-entry-form]').forEach(form => {
    form.hidden = form.dataset.entryForm !== entryTab;
  });
}

function renderEntryTabs() {
  setEntryTab(entryTab);
}

function renderRecentEntries() {
  const list = document.getElementById('recentList');
  const toggle = document.getElementById('recentToggle');
  if (!list) return;

  const sleepSorted = [...(state.sleep || [])].sort((a, b) => b.date.localeCompare(a.date));
  const workoutSorted = [...(state.workouts || [])].sort((a, b) => b.date.localeCompare(a.date));
  const items = [
    ...sleepSorted.map((item, sortedIndex) => ({
      kind: 'sleep', date: item.date, sortedIndex,
      title: `Uyku · ${trNum(item.hours)} saat`,
      sub: `${formatShortDate(item.date)} · ${getSleepQuality(item.hours)}`,
    })),
    ...workoutSorted.map((item, sortedIndex) => {
      const distance = getWorkoutDistanceFromNote(item.note);
      const note = getCleanWorkoutNote(item.note);
      return {
        kind: 'workout', date: item.date, sortedIndex,
        title: `${getWorkoutDisplayType(item)} · ${formatMinutes(item.duration)} dk${distance > 0 ? ` · ${trNum(distance, 2)} km` : ''}`,
        sub: `${formatShortDate(item.date)} · ${getWorkoutDisplayCategory(item)} · ${getWorkoutIntensityFromNote(item.note)}${note ? ` · ${note}` : ''}`,
      };
    }),
    ...(state.notes || []).map((item, stateIndex) => ({
      kind: 'note', date: item.date, stateIndex,
      title: item.text,
      sub: `${formatShortDate(item.date)} · Not`,
    })),
  ].filter(item => isTrackableActivityDate(item.date))
    .sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));

  const shown = showAllRecent ? items : items.slice(0, COLLAPSED_ROWS);

  if (toggle) {
    toggle.hidden = items.length <= COLLAPSED_ROWS;
    toggle.textContent = showAllRecent ? 'Daha az' : `Tümü (${items.length})`;
  }

  if (!shown.length) {
    list.innerHTML = '<p class="empty">Henüz kayıt yok. Yukarıdan ilk kaydını ekle.</p>';
    return;
  }

  const kindLabel = { sleep: 'Uyku', workout: 'Antrenman', note: 'Not' };
  list.innerHTML = shown.map(item => {
    const del = item.kind === 'sleep' ? `deleteSleep(${item.sortedIndex})`
      : item.kind === 'workout' ? `deleteWorkout(${item.sortedIndex})`
        : `deleteNote(${item.stateIndex})`;
    const edit = item.kind === 'workout'
      ? `<button type="button" class="icon-only" onclick="editWorkout(${item.sortedIndex})" aria-label="Antrenmanı düzenle">${icon('edit', 18)}</button>`
      : '';
    return `
      <div class="row">
        <span class="row-dot ${item.kind}" aria-hidden="true"></span>
        <span class="row-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.sub)}</small></span>
        ${edit}
        <button type="button" class="icon-only" onclick="${del}" aria-label="${kindLabel[item.kind]} kaydını sil">${icon('close', 16)}</button>
      </div>`;
  }).join('');
}

function renderWeightChart() {
  const el = document.getElementById('progressChart');
  if (!el) return;
  const data = getMeasurementSummaryData().filter(item => Number.isFinite(Number(item.weight)));
  const weight = getWeightProgress();
  if (data.length < 2 || !weight) {
    el.innerHTML = '<p class="empty">Grafik için en az iki ölçüm gerekiyor.</p>';
    return;
  }
  const W = 640, H = 220, padX = 12, padTop = 14, padBottom = 14;
  const values = data.map(item => Number(item.weight));
  const goal = Number(weight.goal);
  const lo = Math.floor(Math.min(...values, Number.isFinite(goal) ? goal : Infinity) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  const x = i => padX + (i * (W - padX * 2)) / (data.length - 1);
  const y = v => padTop + ((hi - v) / (hi - lo)) * (H - padTop - padBottom);
  const points = data.map((item, i) => `${x(i).toFixed(1)},${y(Number(item.weight)).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${H - padBottom} ${points} ${x(data.length - 1).toFixed(1)},${H - padBottom}`;
  const goalY = Number.isFinite(goal) && goal >= lo ? y(goal) : null;
  const lastPoint = data.at(-1);
  el.innerHTML = `
    <div class="card-head">
      <h2>Kilo trendi</h2>
      <span class="${weight.lost > 0 ? 'good-text' : 'muted-text'}"><b>${trNum(weight.first.weight)} → ${trNum(lastPoint.weight)} kg</b></span>
    </div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${formatShortDate(data[0].date)} ${trNum(data[0].weight)} kg'dan ${formatShortDate(lastPoint.date)} ${trNum(lastPoint.weight)} kg'a kilo grafiği">
      ${goalY !== null ? `<line class="chart-goal" x1="0" x2="${W}" y1="${goalY.toFixed(1)}" y2="${goalY.toFixed(1)}"/>` : ''}
      <polygon class="chart-area" points="${area}"/>
      <polyline class="chart-line" points="${points}"/>
      ${data.map((item, i) => `<circle class="chart-dot" cx="${x(i).toFixed(1)}" cy="${y(Number(item.weight)).toFixed(1)}" r="4"/>`).join('')}
    </svg>
    <div class="chart-axis"><span>${formatShortDate(data[0].date)}</span><span>${formatShortDate(lastPoint.date)}</span></div>
    ${goalY !== null ? `<p class="muted-text small">Kesikli çizgi: ara hedef ${trNum(goal)} kg</p>` : ''}`;
}

function renderProgressWeek() {
  const el = document.getElementById('progressWeek');
  if (!el) return;
  const weekly = getWeeklyProgressData();
  const selected = getSelectedProgressWeek(weekly);
  if (!selected) {
    el.innerHTML = '<p class="empty">Haftalık özet için uyku veya antrenman kaydı ekle.</p>';
    return;
  }
  const sorted = [...weekly].sort((a, b) => a.start.localeCompare(b.start));
  const index = sorted.findIndex(item => item.start === selected.start);
  const range = { start: selected.start, end: selected.end };
  const totals = getRangeTotals(range);
  const status = getWeekStatus(totals);
  const days = [];
  for (let i = 0; i < getRangeDayCount(range); i += 1) days.push(shiftIsoDate(range.start, i));
  const sleepByDay = {};
  (state.sleep || []).forEach(item => {
    if (item.date >= range.start && item.date <= range.end) sleepByDay[item.date] = (sleepByDay[item.date] || 0) + Number(item.hours || 0);
  });
  const avg = totals.sleepNights ? totals.sleep / totals.sleepNights : 0;
  el.innerHTML = `
    <div class="week-nav">
      <button type="button" class="icon-btn" data-week-step="-1" aria-label="Önceki hafta" ${index <= 0 ? 'disabled' : ''}>${icon('chevronLeft', 18)}</button>
      <div class="week-title"><strong>${formatShortRange(range)}</strong><span class="chip ${status.tone}">${status.label} hafta</span></div>
      <button type="button" class="icon-btn" data-week-step="1" aria-label="Sonraki hafta" ${index >= sorted.length - 1 ? 'disabled' : ''}>${icon('chevron', 18)}</button>
    </div>
    <div class="trio">
      <div class="tile"><span class="label">Uyku</span><strong>${trNum(totals.sleep)} sa</strong><small>ort. ${trNum(avg)}</small></div>
      <div class="tile"><span class="label">Antrenman</span><strong>${trNum(totals.workouts, 0)} dk</strong><small>${totals.workoutDays} gün</small></div>
      <div class="tile"><span class="label">Yürüyüş</span><strong>${totals.walking.distance > 0 ? `${trNum(totals.walking.distance, 2)} km` : '—'}</strong><small>${totals.walking.distance > 0 ? `${trNum(totals.walking.pace)} dk/km` : 'kayıt yok'}</small></div>
    </div>
    <div class="sleep-bars" role="img" aria-label="Gece gece uyku saatleri">
      ${days.map(day => {
        const hours = sleepByDay[day] || 0;
        const height = Math.max(4, Math.round((Math.min(hours, 10) / 10) * 64));
        const dayName = new Date(day + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'short' });
        return `<div class="sleep-bar"><small>${hours ? trNum(hours) : '–'}</small><i class="${hours >= 7 ? 'ok' : hours ? 'low' : 'none'}" style="height:${height}px"></i><span>${dayName}</span></div>`;
      }).join('')}
    </div>`;
  el.querySelectorAll('[data-week-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = sorted[index + Number(btn.dataset.weekStep)];
      if (!next) return;
      progressWeekStart = next.start;
      progressWeekManuallySelected = true;
      renderProgressWeek();
    });
  });
}

function renderProgressTable() {
  const el = document.getElementById('progressTable');
  if (!el) return;
  const data = getWeeklyProgressData().sort((a, b) => b.start.localeCompare(a.start));
  if (!data.length) {
    el.innerHTML = '';
    return;
  }
  const allWeeks = data;
  const visibleWeeks = showAllWeeks ? allWeeks : allWeeks.slice(0, COLLAPSED_ROWS);
  el.innerHTML = `
    <div class="card-head"><h2>Haftalar</h2>${allWeeks.length > COLLAPSED_ROWS ? `<button type="button" class="link-btn" data-toggle-weeks>${showAllWeeks ? 'Daha az' : `Tümü (${allWeeks.length})`}</button>` : ''}</div>
    <div class="week-table" role="table" aria-label="Haftalık özet">
      <div class="week-row head" role="row"><span role="columnheader">Hafta</span><span role="columnheader">Uyku</span><span role="columnheader">Antrenman</span><span role="columnheader">Durum</span></div>
      ${visibleWeeks.map(week => {
        const totals = getRangeTotals(week);
        const status = getWeekStatus(totals);
        return `
          <button type="button" class="week-row" role="row" data-week-start="${week.start}">
            <span role="cell"><b>${formatShortRange(week)}</b></span>
            <span role="cell">${trNum(totals.sleep)} sa</span>
            <span role="cell">${trNum(totals.workouts, 0)} dk</span>
            <span role="cell"><span class="chip ${status.tone}">${status.label}</span></span>
          </button>`;
      }).join('')}
    </div>`;
  el.querySelector('[data-toggle-weeks]')?.addEventListener('click', () => {
    showAllWeeks = !showAllWeeks;
    renderProgressTable();
  });
  el.querySelectorAll('[data-week-start]').forEach(btn => {
    btn.addEventListener('click', () => {
      progressWeekStart = btn.dataset.weekStart;
      progressWeekManuallySelected = true;
      renderProgressWeek();
      document.getElementById('progressWeek')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderProgress() {
  renderWeightChart();
  renderProgressWeek();
  renderProgressTable();
}

function renderAll() {
  normalizeProfileState();

  [
    renderHero,
    renderDashboard,
    renderAchievements,
    renderWeightSummary,
    renderWeightList,
    renderEntryTabs,
    renderRecentEntries,
    updateWorkoutGuidance,
    renderProgress,
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
    start_waist: parseWaist(state.startWaist),
    first_goal: parseOptionalNumber((state.milestones || [])[0]),
    goal_weight: parseOptionalNumber(state.goalWeight),
    preferences: {
      measureReminder: state.preferences?.measureReminder ?? true,
      dailyReminder: state.preferences?.dailyReminder ?? false,
      // Atlanan tartılar da profille senkronlanır; web ve PWA aynı "sıradaki tartı"yı görür.
      skippedMeasurements: getSkippedMeasurements().map(item => ({ date: item.date, reason: item.reason || '' })),
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
  state.startWaist = parseWaist(data.start_waist);
  state.onboarded = true;

  const firstGoal = parseOptionalNumber(data.first_goal);
  const finalGoal = parseOptionalNumber(data.goal_weight);
  if (firstGoal !== null && finalGoal !== null) {
    state.goalWeight = finalGoal;
    state.milestones = [firstGoal, finalGoal];
  }

  const localHasPendingProfile = ensureSyncMeta().pendingProfile;
  let needsProfilePush = false;
  if (data.preferences && typeof data.preferences === 'object') {
    state.preferences = {
      measureReminder: data.preferences.measureReminder ?? true,
      dailyReminder: data.preferences.dailyReminder ?? false,
    };
    if (Array.isArray(data.preferences.skippedMeasurements)) {
      if (!localHasPendingProfile) {
        state.skippedMeasurements = data.preferences.skippedMeasurements
          .filter(item => item?.date)
          .map(item => ({ date: item.date, reason: item.reason || '' }));
      }
    } else if (getSkippedMeasurements().length) {
      // Eski sürümde yalnız bu cihazda tutulan atlamalar bir kez buluta taşınır.
      needsProfilePush = true;
    }
  }

  ensureSyncMeta().pendingProfile = localHasPendingProfile || needsProfilePush;
  stateSave();
  renderAll();
}

async function loadMeasurementsFromSupabase() {
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
    waist: parseWaist(item.waist),
  })).filter(item => item.date >= FIRST_MEASURE_DATE);

  // Yerel liste ağ yanıtından SONRA okunur: bekleme sırasında eklenen kayıt kaybolmaz.
  const localMeasurements = (state.measurements || []).filter(item => item.date >= FIRST_MEASURE_DATE);
  state.measurements = mergeCloudWithLocal('measurements', cloudMeasurements, localMeasurements)
    .sort((a, b) => a.date.localeCompare(b.date));

  stateSave();
  renderAll();
}

async function loadSleepFromSupabase() {
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
  })).filter(item => item.date >= START_DATE);

  const localSleep = (Array.isArray(state.sleep) ? state.sleep : []).filter(item => item.date >= START_DATE);
  state.sleep = mergeCloudWithLocal('sleep', cloudSleep, localSleep)
    .sort((a, b) => b.date.localeCompare(a.date));

  stateSave();
  renderAll();
}

async function loadWorkoutsFromSupabase() {
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
  })).filter(item => item.date >= START_DATE);

  const localWorkouts = (Array.isArray(state.workouts) ? state.workouts : []).filter(item => item.date >= START_DATE);
  state.workouts = mergeCloudWithLocal('workouts', cloudWorkouts, localWorkouts)
    .sort((a, b) => b.date.localeCompare(a.date));

  stateSave();
  renderAll();
}

async function loadNotesFromSupabase() {
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
  })).filter(item => item.date >= START_DATE);

  const localNotes = (Array.isArray(state.notes) ? state.notes : []).filter(item => item.date >= START_DATE);
  state.notes = mergeCloudWithLocal('notes', cloudNotes, localNotes)
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

  // İşlenen anahtarlar tek tek çıkarılır; silme sürerken yapılan yeni silmeler korunur.
  const done = key => ({ type }) => {
    state.deletedRecords[type] = ensureDeletedBucket(type).filter(item => item !== key);
  };
  const plan = [];

  for (const key of [...(buckets.measurements || [])]) {
    if (key.startsWith('date:')) {
      const date = key.slice(5);
      plan.push({ type: 'measurements', key, run: () => db.from('measurements').delete().eq('user_id', userId).eq('date', date) });
    } else plan.push({ type: 'measurements', key });
  }

  for (const key of [...(buckets.sleep || [])]) {
    if (isCloudRecordId(key)) {
      plan.push({ type: 'sleep', key, run: () => db.from('sleep_logs').delete().eq('user_id', userId).eq('id', key) });
    } else if (key.startsWith('date:')) {
      const date = key.slice(5);
      plan.push({ type: 'sleep', key, run: () => db.from('sleep_logs').delete().eq('user_id', userId).eq('date', date) });
    } else plan.push({ type: 'sleep', key });
  }

  for (const key of [...(buckets.workouts || [])]) {
    plan.push(isCloudRecordId(key)
      ? { type: 'workouts', key, run: () => db.from('workout_logs').delete().eq('user_id', userId).eq('id', key) }
      : { type: 'workouts', key });
  }

  for (const key of [...(buckets.notes || [])]) {
    plan.push(isCloudRecordId(key)
      ? { type: 'notes', key, run: () => db.from('notes').delete().eq('user_id', userId).eq('id', key) }
      : { type: 'notes', key });
  }

  for (const step of plan) {
    if (step.run) await runDelete(step.run());
    done(step.key)(step);
  }
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
    if (isRecordDeleted('measurements', item)) { clearPendingSync('measurements', item.date); continue; }
    const { error } = await runSyncStage('Ölçüm gönderme', () => saveMeasurementToSupabase({
      user_id: getUserId(),
      date: item.date,
      weight: Number(item.weight),
      waist: parseWaist(item.waist),
    }));
    if (error) throw new Error(`Ölçüm gönderme: ${getSyncErrorMessage(error)}`);
    clearPendingSync('measurements', item.date);
  }

  const pendingSleepDates = new Set(syncMeta.pendingSleep);
  const sleepItems = (Array.isArray(state.sleep) ? state.sleep : [])
    .filter(item => pendingSleepDates.has(item.date));
  for (const item of sleepItems) {
    if (isRecordDeleted('sleep', item)) { clearPendingSync('sleep', item.date); continue; }
    const { error } = await runSyncStage('Uyku kaydı gönderme', () => saveSleepToSupabase({
      user_id: getUserId(),
      date: item.date,
      hours: Number(item.hours || 0),
    }));
    if (error) throw new Error(`Uyku kaydı gönderme: ${getSyncErrorMessage(error)}`);
    clearPendingSync('sleep', item.date);
  }

  // Antrenman ve notlar cihazda üretilen kimlikle "upsert" edilir: yanıt telefona
  // ulaşmasa bile tekrar gönderim aynı satırı günceller, kopya oluşturmaz.
  const pushById = async (type, table, toRow) => {
    const items = (Array.isArray(state[type]) ? state[type] : [])
      .filter(item => item?.id && !isRecordDeleted(type, item) && isPendingSync(type, item));

    for (const item of items) {
      const previousId = item.id;
      if (!isCloudRecordId(item.id)) {
        // Eski sürümden kalan "local-…" kimliği bir kez kalıcı UUID'ye çevrilir.
        item.id = newRecordId();
        clearPendingSync(type, previousId);
        markPendingSync(type, item.id);
        stateSave();
      }
      const { error } = await db.from(table).upsert({ id: item.id, user_id: getUserId(), ...toRow(item) }, { onConflict: 'id' });
      if (error) throw error;
      clearPendingSync(type, item.id);
    }
  };

  await runSyncStage('Antrenman gönderme', () => pushById('workouts', 'workout_logs', item => ({
    date: item.date,
    type: item.type,
    duration: Number(item.duration || 0),
    note: item.note || '',
  })));

  await runSyncStage('Not gönderme', () => pushById('notes', 'notes', item => ({
    date: item.date,
    text: item.text,
  })));

  await flushPendingDeletes();

  // Listede karşılığı kalmamış bekleyen anahtarlar sonsuza dek "bekliyor" görünmesin.
  Object.entries(PENDING_BUCKETS).forEach(([type, bucketName]) => {
    const keys = new Set((state[type] || []).map(item => getSyncKey(type, item)));
    syncMeta[bucketName] = (syncMeta[bucketName] || []).filter(key => keys.has(key));
  });
  stateSave();
  return { ok: true };
}

async function loadAllCloudData({ force = false } = {}) {
  if (!hasActiveUser() || !navigator.onLine) return { ok: false, results: [] };
  if (!force && !state.onboarded) return { ok: false, results: [] };
  if (cloudSyncInProgress) {
    cloudSyncRerunRequested = true;
    return { ok: false, busy: true, results: [] };
  }

  cloudSyncInProgress = true;
  const syncMeta = ensureSyncMeta();
  syncMeta.lastAttempt = new Date().toISOString();
  syncMeta.lastError = '';
  setSyncDot('busy');
  renderSettings();

  try {
    let pushError = null;

    try {
      await runSyncStage('Bekleyen kayıtları gönderme', pushLocalPendingToSupabase);
    } catch (error) {
      pushError = error;
    }

    const results = await Promise.allSettled([
      runSyncStage('Profil ve hedefleri okuma', loadProfileFromSupabase),
      runSyncStage('Ölçümleri okuma', loadMeasurementsFromSupabase),
      runSyncStage('Uyku kayıtlarını okuma', loadSleepFromSupabase),
      runSyncStage('Antrenmanları okuma', loadWorkoutsFromSupabase),
      runSyncStage('Notları okuma', loadNotesFromSupabase),
    ]);

    recoverOnboardingFromData();
    normalizeProfileState();
    const rejected = results.filter(result => result.status === 'rejected');

    if (rejected.length || pushError) {
      const errorText = [
        ...rejected.map(result => getSyncErrorMessage(result.reason)),
        pushError ? getSyncErrorMessage(pushError) : '',
      ].filter(Boolean).join(' | ');

      syncMeta.lastError = errorText;
      stateSave();
      setStatus('Veriler kısmen yüklendi - senkron kontrol edilmeli', 'error');
      setSyncDot('err');
      renderAll();
      return { ok: false, partial: true, error: new Error(errorText), results };
    }

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
    if (cloudSyncRerunRequested) {
      // Senkron sürerken yapılan değişiklik beklemeden ikinci turda gönderilir.
      cloudSyncRerunRequested = false;
      window.setTimeout(() => { void loadAllCloudData({ force: true }); }, 0);
    }
  }
}

async function saveMeasurementToSupabase(payload) {
  // (user_id, date) benzersiz: aynı güne ikinci ölçüm oluşmaz, mevcut olan güncellenir.
  return db
    .from('measurements')
    .upsert({
      user_id: payload.user_id,
      date: payload.date,
      weight: payload.weight,
      waist: payload.waist,
    }, { onConflict: 'user_id,date' });
}

function saveMeasurementLocally(payload) {
  if (!Array.isArray(state.measurements)) state.measurements = [];
  if (getSkippedMeasurements().some(item => item.date === payload.date)) {
    state.skippedMeasurements = getSkippedMeasurements().filter(item => item.date !== payload.date);
    ensureSyncMeta().pendingProfile = true;
  }
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

function skipMeasurementForSelectedDate() {
  const dateInput = document.getElementById('measureDateInput');
  const date = normalizeMeasurementDate(dateInput?.value || getSuggestedMeasureDate());
  if (!date) return;

  if (getSortedMeasurements().some(item => item.date === date)) {
    alert('Bu tarih için zaten ölçüm var. Atlandı olarak işaretlemek için önce mevcut ölçümü silmelisin.');
    return;
  }

  const reason = prompt('Ölçüm neden atlandı?', 'Şehir dışındayım / tartıya erişim yok');
  if (reason === null) return;

  state.skippedMeasurements = [
    ...getSkippedMeasurements().filter(item => item.date !== date),
    {
      date,
      reason: reason.trim() || 'Seyahat / tartıya erişim yok',
      createdAt: new Date().toISOString(),
    },
  ].sort((a, b) => a.date.localeCompare(b.date));

  ensureSyncMeta().pendingProfile = true;
  stateSave();
  renderAll();
  setStatus('Ölçüm atlandı olarak işaretlendi', 'ok');
  void requestSync();
}

function unskipMeasurement(date) {
  if (!getSkippedMeasurements().some(item => item.date === date)) return;
  state.skippedMeasurements = getSkippedMeasurements().filter(item => item.date !== date);
  ensureSyncMeta().pendingProfile = true;
  stateSave();
  renderAll();
  syncMeasureFormDate(true);
  setStatus('Atlama geri alındı', 'ok');
  void requestSync();
}

async function saveSleepToSupabase(payload) {
  return db
    .from('sleep_logs')
    .upsert({
      user_id: payload.user_id,
      date: payload.date,
      hours: payload.hours,
    }, { onConflict: 'user_id,date' });
}

function saveSleepLocally(payload) {
  if (!Array.isArray(state.sleep)) state.sleep = [];
  unmarkRecordDeleted('sleep', payload);
  markPendingSync('sleep', payload.date);
  const reportRange = getSleepReportRangeForDate(payload.date);
  progressWeekStart = reportRange.start;
  progressWeekManuallySelected = false;

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
  const reportRange = getWeekRange(payload.date);
  progressWeekStart = reportRange.start;
  progressWeekManuallySelected = false;

  const id = payload.id || newRecordId();
  markPendingSync('workouts', id);
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

  const id = payload.id || newRecordId();
  markPendingSync('notes', id);
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

  if (date < FIRST_MEASURE_DATE) {
    alert('İlk tartı tarihi 9 Ağustos 2026. Bu tarihten önce ölçüm eklenemez.');
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

  await requestSync();
}

async function deleteWeight(sortedIdx) {
  if (!confirm('Bu ölçümü silmek istediğinden emin misin?')) return;

  const sorted = [...(state.measurements || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const target = sorted[sortedIdx];

  if (!target) return;

  markRecordDeleted('measurements', target);
  clearPendingSync('measurements', target.date);
  state.measurements = (state.measurements || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Ölçüm silindi ✓', 'ok');
  await requestSync();
}

async function deleteNote(index) {
  if (!confirm('Bu notu silmek istediğinden emin misin?')) return;

  const target = state.notes[index];
  if (!target) return;

  markRecordDeleted('notes', target);
  clearPendingSync('notes', target.id);
  state.notes = (state.notes || []).filter((_, itemIndex) => itemIndex !== index);
  stateSave();
  renderAll();
  setStatus('Not silindi ✓', 'ok');
  await requestSync();
}

async function deleteSleep(sortedIdx) {
  if (!confirm('Bu uyku kaydını silmek istediğinden emin misin?')) return;

  const sorted = [...(state.sleep || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  markRecordDeleted('sleep', target);
  clearPendingSync('sleep', target.date);
  state.sleep = (state.sleep || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Uyku kaydı silindi ✓', 'ok');
  await requestSync();
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

  saveNoteLocally(payload);
  setStatus('Not eklendi ✓', 'ok');
  if (noteInput) noteInput.value = '';

  await requestSync();
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
  dateInput.value = shiftIsoDate(today(), -1);

  await requestSync();
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
  const category = categoryInput ? categoryInput.value : getWorkoutCategory(typeInput.value);
  const catalogItems = WORKOUT_CATALOG[category] || WORKOUT_CATALOG.Kuvvet;
  const type = catalogItems.includes(typeInput.value) ? typeInput.value : catalogItems[0];
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

  saveWorkoutLocally(payload);
  setStatus('Antrenman kaydedildi ✓', 'ok');
  durationInput.value = '';
  if (distanceInput) distanceInput.value = '';
  document.querySelectorAll('[data-workout-minutes]').forEach(btn => btn.classList.remove('is-selected'));
  releaseMobileInputFocus();
  if (noteInput) noteInput.value = '';
  dateInput.value = today();

  await requestSync();
  progressWeekStart = getWeekRange(payload.date).start;
  progressWeekManuallySelected = false;
  stateSave();
  renderAll();
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
  // Düzenleme de bekleyenlere girer: çevrimdışıyken yapılsa bile kaybolmaz.
  markPendingSync('workouts', target.id);
  stateSave();
  renderAll();
  setStatus('Antrenman süresi güncellendi ✓', 'ok');
  await requestSync();
}

async function deleteWorkout(sortedIdx) {
  if (!confirm('Bu antrenman kaydını silmek istediğinden emin misin?')) return;

  const sorted = [...(state.workouts || [])]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  markRecordDeleted('workouts', target);
  clearPendingSync('workouts', target.id);
  state.workouts = (state.workouts || []).filter((_, index) => index !== target.originalIndex);
  stateSave();
  renderAll();
  setStatus('Antrenman kaydı silindi ✓', 'ok');
  await requestSync();
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
  window.startupReady?.();
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
    skippedMeasurements: [],
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
      pendingWorkouts: [],
      pendingNotes: [],
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

  window.startupReady?.();
  setStatus('Veriler yükleniyor...', '');
  const cloudLoad = withTimeout(loadAllCloudData({ force: true }), options.skipCloudWait ? 4500 : 12000, 'Bulut veri yükleme');

  const finishAfterCloud = result => {
    if (result?.error) console.warn('Bulut veri yükleme hatası:', result.error);
    normalizeProfileState();
    renderAll();

    const hasProfileStart = Number.isFinite(Number(state.startWeight));
    if (!state.onboarded && !hasTrackedData() && !hasProfileStart) {
      // Kurulum ekranı yalnızca bulut "bu hesapta veri yok" dediğinde açılır.
      // Bulut okunamadıysa (yeni cihaz + zayıf ağ) boş kurulum mevcut profilin üzerine yazmasın.
      if (result?.value?.ok !== true) {
        setStatus('Bulut verilerine ulaşılamadı - tekrar deneniyor', 'error');
        window.setTimeout(() => {
          if (hasActiveUser() && !state.onboarded) {
            withTimeout(loadAllCloudData({ force: true }), 12000, 'Bulut veri yükleme').then(finishAfterCloud);
          }
        }, 8000);
        return;
      }
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
    alert('Başlangıç tarihi 2 Ağustos 2026’dan önce olamaz.');
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
  state.measurements = [];
  state.skippedMeasurements = [];
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

  let cloudReady = true;
  try {
    await saveProfileToSupabase();
    setStatus('Kurulum tamamlandı ✓', 'ok');
  } catch (error) {
    cloudReady = false;
    recordSyncError(error);
    setStatus('Kurulum yerel kaydedildi - cloud daha sonra senkronlanacak', 'ok');
  }

  document.getElementById('onboardingModal')?.remove();
  renderAll();
  if (cloudReady) {
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

// Her yerel değişiklikten sonra tek ortak yol: bekleyenleri gönder, sonra buluttan oku.
function requestSync() {
  if (!canUseCloud()) {
    updateOnlineStatus();
    return Promise.resolve({ ok: false, offline: true });
  }
  return loadAllCloudData({ force: true });
}

async function syncNow() {
  if (!navigator.onLine) {
    setStatus('Senkron için internet bağlantısı gerekiyor', 'error');
    return;
  }

  const result = await loadAllCloudData({ force: true });
  if (result?.ok) setStatus('Web ve PWA verileri senkronize edildi', 'ok');
}

function startAutoSync() {
  if (autoSyncTimer) window.clearInterval(autoSyncTimer);
  // Bekleyen değişiklik varsa 5 sn'de bir, yoksa 30 sn'de bir dener.
  // iPhone "internet geldi" sinyalini her zaman vermediği için bu yedek yol önemlidir.
  let lastAutoSync = Date.now();
  autoSyncTimer = window.setInterval(() => {
    if (document.hidden || !state.onboarded || !hasActiveUser()) return;
    const pending = getPendingSyncCount() > 0;
    const due = pending ? 5000 : 30000;
    if (Date.now() - lastAutoSync < due) return;
    lastAutoSync = Date.now();
    loadAllCloudData({ force: true });
  }, 5000);
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

  // Uyku her sabah bir önceki gecenin tarihiyle girilir.
  const sleepDateInput = document.getElementById('sleepDateInput');
  if (sleepDateInput) sleepDateInput.value = shiftIsoDate(today(), -1);

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

  const skipMeasurementBtn = document.getElementById('skipMeasurementBtn');
  if (skipMeasurementBtn) skipMeasurementBtn.addEventListener('click', skipMeasurementForSelectedDate);

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

  document.querySelectorAll('[data-entry-tab]').forEach(btn => {
    btn.addEventListener('click', () => setEntryTab(btn.dataset.entryTab));
  });

  const recentToggle = document.getElementById('recentToggle');
  if (recentToggle) {
    recentToggle.addEventListener('click', () => {
      showAllRecent = !showAllRecent;
      renderRecentEntries();
    });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-go-panel]');
    if (!target) return;
    if (target.dataset.entry) setEntryTab(target.dataset.entry);
    goPanel(Number(target.dataset.goPanel));
  });

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);

  const syncNowBtn = document.getElementById('syncNowBtn');
  if (syncNowBtn) syncNowBtn.addEventListener('click', syncNow);

  window.addEventListener('focus', () => {
    if (state.onboarded) loadAllCloudData();
  });

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
        })
        .catch(err => console.warn('[SW] Kayıt hatası:', err));
    });
  }
}

async function checkAuthSession() {
  setStatus('Oturum kontrol ediliyor...', '');
  try {
    const result = await withTimeout(db.auth.getSession(), 8000, 'Oturum kontrolü');
    if (result.timedOut || result.error) throw result.error || new Error('Bağlantı gecikti');
    const {data,error} = result.value;
    if (error) throw error;
    if (!data.session) { updateOnlineStatus(); setStatus('Giriş bekleniyor', ''); showAuth(); return; }
    if (activeSessionLoad) { await activeSessionLoad; return; }
    activeSessionLoad = continueWithSession(data.session, {skipCloudWait:true})
      .finally(() => { activeSessionLoad = null; });
    await activeSessionLoad;
  } catch {
    setStatus('Oturum kontrolü gecikti. Yeniden deneyin; kayıtlarınız silinmedi.', 'error');
    window.startupFailure?.();
  }
}
window.retryStartup = checkAuthSession;

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
          skippedMeasurements: [],
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
  startAutoSync();
  checkAuthSession();
}

// Expose for inline HTML handlers
window.goPanel = goPanel;
window.deleteWeight = deleteWeight;
window.deleteNote = deleteNote;
window.deleteSleep = deleteSleep;
window.deleteWorkout = deleteWorkout;

init();



