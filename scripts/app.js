'use strict';

// â”€â”€ SUPABASE â”€â”€
const SUPABASE_URL = 'https://wqbnghfduryuwcjrffyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8ZycJCD6a6qdgYbfPqh6Sg_FaYY_XMb';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase haz?r:', db);

// â”€â”€ CONSTANTS â”€â”€
const PANELS = ['pHome', 'pWeight', 'pDaily', 'pProgress', 'pSettings'];
const BN_IDS = ['bn0', 'bn1', 'bn2', 'bn3', 'bn4'];
const STORAGE_KEY = 'ft_state_v2';
const START_DATE = '2026-05-31';
const WEEKLY_MEASURE_DAY = 0;
const SLEEP_TARGET = 49;
const WORKOUT_TARGET = 180;

const WORKOUT_CATALOG = {
  Kuvvet: [
    'Full Body A',
    'Full Body B',
    'Full Body C',
    'Squat Odaklı',
    'Deadlift Odaklı',
    'Üst Vücut',
    'Alt Vücut',
  ],
  Core: [
    'Core Temel',
    'Core / Tabata',
    'Karın Bölgesi',
    'Bel ve Stabilizasyon',
    'Plank Serisi',
  ],
  Challenge: [
    'Sabah Yağ Yakım',
    'GrowWithJo Challenge',
    'Squat Challenge',
    'Deadlift Challenge',
    'Core Challenge',
    'HIIT Challenge',
    '30 Gün Challenge',
  ],
  Kardiyo: [
    'GrowWithJo',
    'Yürüyüş',
    'Koşu',
    'Bisiklet',
    'Eliptik',
    'HIIT',
    'Zone 2 Kardiyo',
  ],
  Recovery: ['Esneme', 'Mobility', 'Yoga', 'Foam Rolling', 'Aktif Dinlenme'],
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

// â”€â”€ STATE â”€â”€
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
  goalWeight: 85,
  milestones: [95, 85],
  preferences: {
    measureReminder: true,
    dailyReminder: false,
  }
};

let measurementChart = null;
let sleepChart = null;
let workoutChart = null;
let authMode = 'signIn';
// â”€â”€ HELPERS â”€â”€
function today() {
  return new Date().toISOString().slice(0, 10);
}

function getSuggestedMeasureDate() {
  const date = new Date();
  const diff = (date.getDay() - WEEKLY_MEASURE_DAY + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

function getUserId() {
  return state.userId;
}

function getStateStorageKey() {
  return state.userId ? `${STORAGE_KEY}_${state.userId}` : `${STORAGE_KEY}_anonymous`;
}

function getWorkoutCategory(type) {
  return Object.entries(WORKOUT_CATALOG)
    .find(([, items]) => items.includes(type))?.[0] || 'Kuvvet';
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
}

function getWorkoutIntensityFromNote(note = '') {
  const match = String(note).match(/Zorluk:\s*(Kolay|Orta|Zor)/i);
  return match ? match[1] : 'Orta';
}

function getWorkoutCategoryFromNote(note = '', type = '') {
  const match = String(note).match(/Kategori:\s*([^·]+)/i);
  return match ? match[1].trim() : getWorkoutCategory(type);
}

function getCleanWorkoutNote(note = '') {
  return String(note)
    .replace(/^Kategori:\s*[^·]+·\s*/i, '')
    .replace(/^Zorluk:\s*(Kolay|Orta|Zor)\s*·\s*/i, '')
    .replace(/^Kategori:\s*[^·]+\s*/i, '')
    .replace(/^Zorluk:\s*(Kolay|Orta|Zor)\s*/i, '')
    .trim();
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

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('tr-TR', {
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

function setSyncDot(cls) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot ' + cls;
}

function getSortedMeasurements() {
  return [...(state.measurements || [])]
    .filter(item => item?.date && Number.isFinite(Number(item.weight)) && Number.isFinite(Number(item.waist)))
    .map(item => ({
      ...item,
      weight: Number(item.weight),
      waist: Number(item.waist),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeProfileState() {
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

// â”€â”€ PERSISTENCE â”€â”€
function stateSave() {
  try {
    localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
    setSyncDot('ok');
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
      measurements: Array.isArray(savedState.measurements) ? savedState.measurements : [],
      weights: Array.isArray(savedState.weights) ? savedState.weights : [],
      nutrition: Array.isArray(savedState.nutrition) ? savedState.nutrition : [],
      workouts: Array.isArray(savedState.workouts) ? savedState.workouts : [],
      notes: Array.isArray(savedState.notes) ? savedState.notes : [],
      sleep: Array.isArray(savedState.sleep) ? savedState.sleep : [],
    };
    normalizeProfileState();
  } catch (e) {
    console.warn('State y?klenemedi:', e);
  }
}

// â”€â”€ THEME â”€â”€
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);

  const themeBtn = document.getElementById('themeBtn');
  const themeMeta = document.getElementById('themeColorMeta');

  if (themeBtn) {
    themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }

  if (themeMeta) {
    themeMeta.content = state.theme === 'dark' ? '#0f1117' : '#3b82f6';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  stateSave();
}

// â”€â”€ NAVIGATION â”€â”€
function goPanel(idx) {
  PANELS.forEach((id, i) => {
    const panel = document.getElementById(id);
    if (panel) panel.classList.toggle('active', i === idx);
  });

  BN_IDS.forEach((id, i) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', i === idx);
  });

  if (idx === 4) {
    normalizeProfileState();
    renderSettings();
  }

  requestAnimationFrame(() => {
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

// â”€â”€ RENDER â”€â”€
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

  const idx = Math.floor(Date.now() / 86400000) % MOTIVATIONS.length;
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
  const insight = sleepPct < 70
    ? 'Uyku toparlanmaya ihtiyaç duyuyor'
    : workoutPct < 70
      ? 'Hareket hedefini tamamla'
      : 'Hafta dengeli ilerliyor';

  el.innerHTML = `
    <div class="week-card-head">
      <div>
        <div class="week-card-title">Bu Hafta</div>
        <div class="week-card-date">${formatDate(range.start)} - ${formatDate(range.end)}</div>
      </div>

      <div class="week-card-pill">
        ${sleepPct >= 100 || workoutPct >= 100 ? 'İyi gidiyorsun' : 'Devam et'}
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
  `;
}

function renderDashboardGoalCard() {
  const el = document.getElementById('dashboardGoalCard');
  if (!el) return;

  const data = [...(state.measurements || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

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

  const data = [...(state.measurements || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (!data.length) {
    el.innerHTML = '';
    return;
  }

  const first = data[0];
  const last = data[data.length - 1];

  const diff = Number(last.weight - first.weight);
  const startDateText = formatDate(first.date);
  const diffText = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`;
  const isGood = diff <= 0;

  el.innerHTML = `
    <div class="progress-summary-card">
      <div>
        <div class="progress-summary-label">SON ÖLÇÜM</div>
        <div class="progress-summary-value">
          ${last.weight} <span>kg</span>
        </div>
      </div>

      <div class="progress-summary-side">
        <div class="progress-summary-small">${startDateText} başlangıcından beri</div>
        <div class="progress-summary-diff ${isGood ? 'good' : 'bad'}">
          ${diffText}
        </div>
      </div>
    </div>
  `;
}
function renderStats() {
  const el = document.getElementById('dashboardProgressCard');
  if (!el) return;

  const data = [...(state.measurements || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

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
  const weightDiff = Number(last.weight - first.weight);
  const waistDiff = Number((last.waist || 0) - (first.waist || 0));
  const startDateText = formatDate(first.date);

  el.innerHTML = `
    <div class="dashboard-measure-grid">
      <div class="progress-summary-card">
        <div>
          <div class="progress-summary-label">Son Kilo</div>
          <div class="progress-summary-value">${last.weight} <span>kg</span></div>
        </div>
        <div class="progress-summary-side">
          <div class="progress-summary-small">${startDateText} başlangıcından beri</div>
          <div class="progress-summary-diff ${weightDiff <= 0 ? 'good' : 'bad'}">
            ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg
          </div>
        </div>
      </div>

      <div class="progress-summary-card">
        <div>
          <div class="progress-summary-label">Son Bel Ölçümü</div>
          <div class="progress-summary-value">${last.waist ?? '—'} <span>cm</span></div>
        </div>
        <div class="progress-summary-side">
          <div class="progress-summary-small">${startDateText} başlangıcından beri</div>
          <div class="progress-summary-diff ${waistDiff <= 0 ? 'good' : 'bad'}">
            ${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm
          </div>
        </div>
      </div>
    </div>

    <div class="week-insight">${insight}</div>
  `;
}

  function renderMeasurementChart() {
  const canvas = document.getElementById('measurementChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const data = [...(state.measurements || [])]
    .sort((a, b) => a.date.localeCompare(b.date));

  if (measurementChart) {
    measurementChart.destroy();
  }

  const host = canvas.parentElement;
  const oldEmpty = host?.querySelector('.empty-state');
  if (oldEmpty) oldEmpty.remove();

  if (data.length < 2) {
    canvas.style.display = 'none';
    setEmptyState(
      host,
      'Grafik için iki ölçüm gerekli',
      'İlk ölçüm kaydedildiğinde başlangıç oluşur. İkinci ölçümden sonra kilo ve bel trendi burada görünür.',
      'Ölçüm Ekle',
      1
    );
    return;
  }

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
          backgroundColor: 'rgba(37,99,235,.10)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#2563eb'
        },
        {
          label: 'Bel (cm)',
          data: data.map(item => item.waist),
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15,118,110,.10)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#0f766e'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8
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
          beginAtZero: false,
          grid: {
            color: 'rgba(113,128,150,.18)'
          }
        }
      }
    }
  });
}

function renderWeightSummary() {
  const el = document.getElementById('weightSummary');
  if (!el) return;

  const data = [...(state.measurements || [])]
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!data.length) {
    el.innerHTML = '';
    return;
  }

  const first = data[0];
  const last = data[data.length - 1];

  const weightDiff = last.weight - first.weight;
  const waistDiff = last.waist - first.waist;

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
          color:${waistDiff <= 0 ? 'var(--green)' : 'var(--red)'}
        ">
          ${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm
        </div>
      </div>

    </div>
  `;
}

function renderWeightList() {
  const list = document.getElementById('weightList');
  const empty = document.getElementById('weightEmpty');
  if (!list || !empty) return;

  const data = [...(state.measurements || [])].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

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

    const waistDiff = prev && m.waist != null && prev.waist != null
      ? (parseFloat(m.waist) - parseFloat(prev.waist)).toFixed(1)
      : null;

    const weightDiffHtml = weightDiff
      ? `<span style="color:${weightDiff < 0 ? 'var(--green)' : 'var(--red)'}">${weightDiff > 0 ? '+' : ''}${weightDiff} kg</span>`
      : '<span style="color:var(--muted)">?</span>';

    const waistDiffHtml = waistDiff
      ? `<span style="color:${waistDiff < 0 ? 'var(--green)' : 'var(--red)'}">${waistDiff > 0 ? '+' : ''}${waistDiff} cm</span>`
      : '<span style="color:var(--muted)">?</span>';

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-weight:700">
            ${m.weight ?? '?'} <span style="font-size:12px;color:var(--muted)">kg</span>
            ?
            ${m.waist ?? '?'} <span style="font-size:12px;color:var(--muted)">cm bel</span>
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
          aria-label="Sil">?</button>
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
        <div class="empty-icon">📝</div>
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
  const date = new Date(dateValue);
  const day = date.getDay() || 7;

  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
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

function getCurrentWeekSleepTotal() {
  const sleep = Array.isArray(state.sleep) ? state.sleep : [];
  const range = getDashboardWeekRange();

  return sleep
    .filter(item => item.date >= range.start && item.date <= range.end)
    .reduce((total, item) => total + Number(item.hours || 0), 0);
}

function renderSleepSummary() {
  const el = document.getElementById('sleepSummary');
  if (!el) return;

  const sleep = Array.isArray(state.sleep) ? state.sleep : [];
  const todayTotal = sleep
    .filter(item => item.date === today())
    .reduce((total, item) => total + Number(item.hours || 0), 0);
  const weekTotal = getCurrentWeekSleepTotal();

  el.innerHTML = `
    <div class="daily-stat-line">
      <span>Bugün</span>
      <strong>${todayTotal.toFixed(1)} saat</strong>
    </div>
    <div class="daily-stat-line muted">
      <span>Bu hafta</span>
      <strong>${weekTotal.toFixed(1)} / 49 saat</strong>
    </div>
  `;
}
function renderSleepList() {
  const list = document.getElementById('sleepList');
  if (!list) return;

  const sorted = [...(state.sleep || [])].sort((a, b) => b.date.localeCompare(a.date));
  const sleep = sorted
    .map((item, sortedIndex) => ({ ...item, sortedIndex }))
    .filter(item => item.date === today());

  if (!sleep.length) {
    list.innerHTML = '<div class="empty-state compact">Bugün uyku kaydı yok.</div>';
    return;
  }

  list.innerHTML = sleep.map(item => `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${Number(item.hours).toFixed(1)} saat</div>
        <div class="daily-row-meta">Bugün</div>
      </div>
      <button onclick="deleteSleep(${item.sortedIndex})" class="row-delete" aria-label="Sil">×</button>
    </div>
  `).join('');
}
function getCurrentWeekWorkoutTotal() {
  const workouts = Array.isArray(state.workouts) ? state.workouts : [];
  const range = getDashboardWeekRange();

  return workouts
    .filter(item => item.date >= range.start && item.date <= range.end)
    .reduce((total, item) => total + Number(item.duration || 0), 0);
}

function renderWorkoutSummary() {
  const el = document.getElementById('workoutSummary');
  if (!el) return;

  const workouts = Array.isArray(state.workouts) ? state.workouts : [];
  const todayTotal = workouts
    .filter(item => item.date === today())
    .reduce((total, item) => total + Number(item.duration || 0), 0);
  const weekTotal = getCurrentWeekWorkoutTotal();

  el.innerHTML = `
    <div class="daily-stat-line">
      <span>Bugün</span>
      <strong>${todayTotal} dk</strong>
    </div>
    <div class="daily-stat-line muted">
      <span>Bu hafta</span>
      <strong>${weekTotal} / 180 dk</strong>
    </div>
  `;
}
function renderWorkoutList() {
  const list = document.getElementById('workoutList');
  if (!list) return;

  const sorted = [...(state.workouts || [])].sort((a, b) => b.date.localeCompare(a.date));
  const workouts = sorted
    .map((item, sortedIndex) => ({ ...item, sortedIndex }))
    .filter(item => item.date === today());

  if (!workouts.length) {
    list.innerHTML = '<div class="empty-state compact">Bugün antrenman kaydı yok.</div>';
    return;
  }

  list.innerHTML = workouts.map(item => `
    <div class="daily-row">
      <div>
        <div class="daily-row-title">${item.type} · ${Number(item.duration)} dk</div>
        <div class="daily-row-meta">${getWorkoutCategoryFromNote(item.note, item.type)} · ${getWorkoutIntensityFromNote(item.note)}${getCleanWorkoutNote(item.note) ? ` · ${getCleanWorkoutNote(item.note)}` : ''}</div>
      </div>
      <button onclick="deleteWorkout(${item.sortedIndex})" class="row-delete" aria-label="Sil">×</button>
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

  return Object.values(weeks)
    .sort((a, b) => a.start.localeCompare(b.start));
}

function getCurrentWeekWorkoutCategories() {
  const range = getDashboardWeekRange();
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

function renderProgressSummary() {
  const el = document.getElementById('progressSummary');
  if (!el) return;

  const weekly = getWeeklyProgressData();
  const current = weekly[weekly.length - 1] || { sleep: 0, workouts: 0 };
  const prev = weekly[weekly.length - 2];
  const measurements = [...(state.measurements || [])].sort((a, b) => a.date.localeCompare(b.date));
  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const previousMeasure = measurements[measurements.length - 2];

  const sleepPct = Math.min(100, Math.round((current.sleep / SLEEP_TARGET) * 100));
  const workoutPct = Math.min(100, Math.round((current.workouts / WORKOUT_TARGET) * 100));
  const sleepDiff = prev ? current.sleep - prev.sleep : 0;
  const workoutDiff = prev ? current.workouts - prev.workouts : 0;
  const weightDiff = first && last ? last.weight - first.weight : 0;
  const lastWeightDiff = previousMeasure && last ? last.weight - previousMeasure.weight : 0;
  const waistDiff = first && last ? last.waist - first.waist : 0;
  const lastWaistDiff = previousMeasure && last ? last.waist - previousMeasure.waist : 0;
  const categories = getCurrentWeekWorkoutCategories();
  const categoryText = categories.length
    ? categories.map(([category, minutes]) => `${category}: ${minutes} dk`).join(' · ')
    : 'Bu hafta kategori verisi yok';

  el.innerHTML = `
    <div class="progress-grid">
      <div class="progress-metric-card">
        <span>Uyku</span>
        <strong>${current.sleep.toFixed(1)} saat</strong>
        <div class="metric-track"><i style="width:${sleepPct}%"></i></div>
        <small>${sleepDiff >= 0 ? '+' : ''}${sleepDiff.toFixed(1)} saat / geçen hafta</small>
      </div>

      <div class="progress-metric-card">
        <span>Antrenman</span>
        <strong>${current.workouts} dk</strong>
        <div class="metric-track"><i style="width:${workoutPct}%"></i></div>
        <small>${workoutDiff >= 0 ? '+' : ''}${workoutDiff} dk / geçen hafta</small>
        <small>${categoryText}</small>
      </div>

      <div class="progress-metric-card">
        <span>Kilo</span>
        <strong>${last ? `${last.weight} kg` : '—'}</strong>
        <small>Toplam: ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg · Son: ${lastWeightDiff > 0 ? '+' : ''}${lastWeightDiff.toFixed(1)} kg</small>
      </div>

      <div class="progress-metric-card">
        <span>Bel</span>
        <strong>${last ? `${last.waist} cm` : '—'}</strong>
        <small>Toplam: ${waistDiff > 0 ? '+' : ''}${waistDiff.toFixed(1)} cm · Son: ${lastWaistDiff > 0 ? '+' : ''}${lastWaistDiff.toFixed(1)} cm</small>
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
    const sleepData = (state.sleep || [])
      .filter(item =>
        item.date >= latestWeek.start &&
        item.date <= latestWeek.end
      )
      .sort((a, b) => a.date.localeCompare(b.date));

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
      <div class="bar-chart sleep-chart">
        ${sleepData.map(item => {
          const h = Math.max(16, item.hours * 14);

          return `
            <div class="bar-item">
              <div class="bar-fill sleep" style="height:${h}px"></div>
              <div class="bar-label">
                ${new Date(item.date)
                  .toLocaleDateString('tr-TR', { weekday: 'short' })}
              </div>
              <div class="bar-value">${item.hours}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    }
  }

  if (workoutWrap) {
    const workoutData = (state.workouts || [])
      .filter(item =>
        item.date >= latestWeek.start &&
        item.date <= latestWeek.end
      )
      .sort((a, b) => a.date.localeCompare(b.date));

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
      <div class="bar-chart workout-chart">
        ${workoutData.map(item => {
          const h = Math.max(12, item.duration * 1.2);
          const category = getWorkoutCategoryFromNote(item.note, item.type);

          return `
            <div class="bar-item">
              <div class="bar-fill workout" style="height:${h}px" title="${category}"></div>
              <div class="bar-label">
                ${new Date(item.date)
                  .toLocaleDateString('tr-TR', { weekday: 'short' })}
              </div>
              <div class="bar-value">${item.duration} dk</div>
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
    el.innerHTML = '';
    return;
  }

  el.innerHTML = data.map(item => `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="font-weight:700">
        ${formatDate(item.start)} - ${formatDate(item.end)}
      </div>

      <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
        Uyku: ${item.sleep.toFixed(1)} saat
      </div>

      <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
        Antrenman: ${item.workouts} dk
      </div>
    </div>
  `).join('');
}

function renderSettings() {
  normalizeProfileState();

  const nameEl = document.getElementById('settingsName');
  const startEl = document.getElementById('settingsStartDate');
  const emailEl = document.getElementById('settingsEmail');
  const startWeightEl = document.getElementById('settingsStartWeight');
  const currentWeightEl = document.getElementById('settingsCurrentWeight');
  const firstGoalEl = document.getElementById('settingsFirstGoal');
  const finalGoalEl = document.getElementById('settingsFinalGoal');
  const syncEl = document.getElementById('settingsSyncState');
  const profileThemeToggle = document.getElementById('profileThemeToggle');
  const measureReminderToggle = document.getElementById('measureReminderToggle');
  const dailyReminderToggle = document.getElementById('dailyReminderToggle');

  const measurements = getSortedMeasurements();
  const firstMeasurement = measurements[0];
  const lastMeasurement = measurements[measurements.length - 1];
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
  if (firstGoalEl) firstGoalEl.textContent = firstGoal ? `${firstGoal} kg` : 'Belirlenmedi';
  if (finalGoalEl) finalGoalEl.textContent = finalGoal ? `${finalGoal} kg` : 'Belirlenmedi';
  if (syncEl) syncEl.textContent = navigator.onLine ? 'Cloud senkron aktif' : 'Çevrimdışı kayıt';
  if (profileThemeToggle) profileThemeToggle.checked = state.theme === 'dark';
  if (measureReminderToggle) measureReminderToggle.checked = Boolean(state.preferences?.measureReminder);
  if (dailyReminderToggle) dailyReminderToggle.checked = Boolean(state.preferences?.dailyReminder);
}

function renderAll() {
  renderHero();
  renderMoti();
  renderDashboardWeekLabel();
  renderDashboardGoalCard();
  renderStats();
  renderMeasurementChart();
  renderWeightSummary();
  renderWeightList();
  renderNotes();
  renderSleepSummary();
  renderSleepList();
  renderWorkoutSummary();
  renderWorkoutList();
  renderProgressSummary();
  renderProgressCharts();
  renderProgressList();
  renderSettings();
  applyTheme();
  clearInitialLoadingStatus();
}

// â”€â”€ SUPABASE DATA â”€â”€
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
    return;
  }

  const cloudMeasurements = (data || []).map(item => ({
    date: item.date,
    weight: parseFloat(item.weight),
    waist: parseFloat(item.waist),
  }));

  if (!cloudMeasurements.length && localMeasurements.length) {
    console.warn('Cloud ölçüm boş döndü; yerel başlangıç ölçümü korunuyor.');
    setStatus('Hazır', 'ok');
    return;
  }

  state.measurements = cloudMeasurements;

  stateSave();
  renderAll();
  console.log('Supabase veriler y?klendi:', data);
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
    return;
  }

  state.sleep = (data || []).map(item => ({
    id: item.id,
    date: item.date,
    hours: parseFloat(item.hours),
  }));

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
    console.error('Workout load hatas?:', error);
    setStatus('Antrenman verileri yüklenemedi', 'error');
    return;
  }

  state.workouts = (data || []).map(item => ({
    id: item.id,
    date: item.date,
    type: item.type,
    duration: Number(item.duration),
    note: item.note || '',
  }));

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
    console.error('Notes load hatas?:', error);
    setStatus('Notlar yüklenemedi', 'error');
    return;
  }

  state.notes = (data || []).map(item => ({
    id: item.id,
    date: item.date,
    text: item.text,
  }));

  stateSave();
  renderAll();
}

function loadAllCloudData() {
  if (!state.onboarded) return;

  loadMeasurementsFromSupabase();
  loadSleepFromSupabase();
  loadWorkoutsFromSupabase();
  loadNotesFromSupabase();

}
// â”€â”€ ACTIONS â”€â”€
async function saveMeasurementFromForm() {
  const dateInput = document.getElementById('measureDateInput');
  const weightInput = document.getElementById('measureWeightInput');
  const waistInput = document.getElementById('measureWaistInput');

  if (!dateInput || !weightInput || !waistInput) return;

  const date = dateInput.value || getSuggestedMeasureDate();
  const weight = parseFloat(weightInput.value);
  const waist = parseFloat(waistInput.value);

  if (!date || Number.isNaN(weight) || weight <= 0) {
    alert('Ge?erli bir kilo gir.');
    return;
  }

  if (Number.isNaN(waist) || waist <= 0) {
    alert('Ge?erli bir bel ?l??m? gir.');
    return;
  }

  if (new Date(date).getDay() !== WEEKLY_MEASURE_DAY) {
    const ok = confirm('?l??mler pazar g?n? al?nacak ?ekilde planland?. Yine de bu tarihe kay?t eklemek ister misin?');
    if (!ok) return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    weight: parseFloat(weight.toFixed(1)),
    waist: parseFloat(waist.toFixed(1)),
  };

  const { error } = await db
    .from('measurements')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (error) {
    console.error('Measurement save error:', error);
    alert('?l??m cloud kay?t hatas?: ' + error.message);
    setStatus('Cloud kayıt hatası', 'error');
    return;
  }

  await loadMeasurementsFromSupabase();

  weightInput.value = '';
  waistInput.value = '';
  dateInput.value = getSuggestedMeasureDate();
  setStatus('Ölçüm kaydedildi ✓', 'ok');
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
    alert('Tarih format? hatal?. ?rnek: 27/04/2026 veya 27.04.2026');
    return;
  }

  if (!Array.isArray(state.measurements)) state.measurements = [];

  const alreadyExists = state.measurements.some(item => item.date === date);

  if (alreadyExists) {
    alert('Bu tarih i?in zaten kay?t var. ?nce mevcut kayd? silmelisin.');
    return;
  }

  const weightInput = prompt('Kilonu gir (kg):');
  if (!weightInput || isNaN(parseFloat(weightInput))) return;

  const waistInput = prompt('Bel ölçünü gir (cm):');
  if (!waistInput || isNaN(parseFloat(waistInput))) return;

  const measurement = {
    date,
    weight: parseFloat(parseFloat(weightInput).toFixed(1)),
    waist: parseFloat(parseFloat(waistInput).toFixed(1)),
    user_id: getUserId(),
  };

  const { data, error } = await db
    .from('measurements')
    .insert([measurement])
    .select();

  if (error) {
    console.error('Supabase insert hatas?:', error);
    alert('Supabase kay?t hatas?: ' + error.message);
    setStatus('Cloud kayıt hatası', 'error');
    return;
  }

  state.measurements.push({
    date: measurement.date,
    weight: measurement.weight,
    waist: measurement.waist,
  });

  stateSave();
  renderAll();
  setStatus('Ölçüm eklendi ✓', 'ok');

  console.log('Supabase kay?t ba?ar?l?:', data);
}

async function deleteWeight(sortedIdx) {
  if (!confirm('Bu ?l??m? silmek istedi?inden emin misin?')) return;

  const sorted = [...state.measurements]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const target = sorted[sortedIdx];

  if (!target) return;

  const { error } = await db
    .from('measurements')
    .delete()
    .eq('user_id', getUserId())
    .eq('date', target.date)
    .eq('weight', target.weight)
    .eq('waist', target.waist);

  if (error) {
    console.error('Supabase delete hatas?:', error);
    alert('Cloud silme hatas?: ' + error.message);
    return;
  }

  state.measurements.splice(target.originalIndex, 1);

  stateSave();
  renderAll();
  setStatus('Ölçüm silindi ✓', 'ok');
}

async function deleteNote(index) {
  if (!confirm('Bu notu silmek istedi?inden emin misin?')) return;

  const target = state.notes[index];
  if (!target) return;

  const { error } = await db
    .from('notes')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Note silme hatas?:', error);
    alert('Not cloud silme hatas?: ' + error.message);
    return;
  }

  await loadNotesFromSupabase();
  setStatus('Not silindi ✓', 'ok');
}

async function deleteSleep(sortedIdx) {
  if (!confirm('Bu uyku kayd?n? silmek istedi?inden emin misin?')) return;

  const sorted = [...(state.sleep || [])].sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  const { error } = await db
    .from('sleep_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Sleep silme hatas?:', error);
    alert('Uyku cloud silme hatas?: ' + error.message);
    return;
  }

  await loadSleepFromSupabase();
  setStatus('Uyku kaydı silindi ✓', 'ok');
}

async function addNote() {
  const noteInput = document.getElementById('noteInput');
  const text = noteInput ? noteInput.value : prompt('Not gir:');
  if (!text || !text.trim()) return;

  const { error } = await db
    .from('notes')
    .insert([{
      user_id: getUserId(),
      date: today(),
      text: text.trim(),
    }]);

  if (error) {
    console.error('Note kay?t hatas?:', error);
    alert('Not cloud kay?t hatas?: ' + error.message);
    return;
  }

  await loadNotesFromSupabase();

  setStatus('Not eklendi ✓', 'ok');
  if (noteInput) noteInput.value = '';
}

async function saveSleep() {
  const dateInput = document.getElementById('sleepDateInput');
  const hourInput = document.getElementById('sleepInput');

  if (!dateInput || !hourInput) return;

  const date = dateInput.value || today();
  const hours = parseFloat(hourInput.value);

  if (!hours || hours <= 0) {
    alert('Ge?erli bir uyku saati gir');
    return;
  }

  const payload = {
    user_id: getUserId(),
    date,
    hours: parseFloat(hours.toFixed(1)),
  };

  const { error } = await db
    .from('sleep_logs')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (error) {
    console.error('Sleep kay?t hatas?:', error);
    alert('Uyku cloud kay?t hatas?: ' + error.message);
    return;
  }

  await loadSleepFromSupabase();

  setStatus('Uyku kaydedildi ✓', 'ok');
  hourInput.value = '';
  dateInput.value = today();
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
  const duration = parseInt(durationInput.value, 10);
  const freeNote = noteInput ? noteInput.value.trim() : '';
  const note = [`Kategori: ${category}`, `Zorluk: ${intensity}`, freeNote]
    .filter(Boolean)
    .join(' · ');

  if (!duration || duration <= 0) {
    alert('Geçerli bir antrenman süresi gir');
    return;
  }

  const { error } = await db
    .from('workout_logs')
    .insert([{
      user_id: getUserId(),
      date,
      type,
      duration,
      note,
    }]);

  if (error) {
    console.error('Workout kay?t hatas?:', error);
    alert('Antrenman cloud kayıt hatası: ' + error.message);
    return;
  }

  await loadWorkoutsFromSupabase();

  setStatus('Antrenman kaydedildi ✓', 'ok');
  durationInput.value = '';
  if (noteInput) noteInput.value = '';
  dateInput.value = today();
}

async function deleteWorkout(sortedIdx) {
  if (!confirm('Bu antrenman kaydını silmek istediğinden emin misin?')) return;

  const sorted = [...(state.workouts || [])].sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  const { error } = await db
    .from('workout_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Workout silme hatas?:', error);
    alert('Antrenman cloud silme hatası: ' + error.message);
    return;
  }

  await loadWorkoutsFromSupabase();
  setStatus('Antrenman kaydı silindi ✓', 'ok');
}

function editName() {
  const newName = prompt('İsmini gir:', state.name || '');
  if (!newName) return;

  state.name = newName.trim();
  stateSave();
  renderAll();
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

  const startWeight = parseFloat(startWeightInput);
  const startWaist = parseFloat(startWaistInput);
  const firstGoal = parseFloat(firstGoalInput);
  const finalGoal = parseFloat(finalGoalInput);

  if ([startWeight, startWaist, firstGoal, finalGoal].some(value => Number.isNaN(value))) {
    alert('Lütfen tüm hedef alanlarına geçerli sayı gir.');
    return;
  }

  state.startWeight = parseFloat(startWeight.toFixed(1));
  state.startWaist = parseFloat(startWaist.toFixed(1));
  state.goalWeight = parseFloat(finalGoal.toFixed(1));
  state.milestones = [parseFloat(firstGoal.toFixed(1)), state.goalWeight];

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

  stateSave();
  renderAll();
  setStatus('Hedefler güncellendi ✓', 'ok');
}

function updatePreference(key, value) {
  state.preferences = {
    measureReminder: true,
    dailyReminder: false,
    ...(state.preferences || {}),
    [key]: Boolean(value),
  };
  stateSave();
  renderSettings();
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

  if (!email || password.length < 6) {
    setAuthMessage('E-posta ve en az 6 karakterli şifre gir.', true);
    return;
  }

  setAuthMessage('İşleniyor...');

  const result = authMode === 'signIn'
    ? await db.auth.signInWithPassword({ email, password })
    : await db.auth.signUp({ email, password });

  if (result.error) {
    setAuthMessage(result.error.message, true);
    return;
  }

  if (!result.data.session) {
    setAuthMessage('Kayıt tamamlandı. E-posta doğrulaması açıksa gelen kutunu kontrol et.');
    return;
  }

  await continueWithSession(result.data.session);
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
  await db.auth.signOut();
  state = {
    ...state,
    userId: '',
    onboarded: false,
    name: '',
    measurements: [],
    workouts: [],
    notes: [],
    sleep: [],
  };
  document.getElementById('authModal')?.remove();
  document.getElementById('onboardingModal')?.remove();
  renderAll();
  showAuth();
}

async function continueWithSession(session) {
  if (!session?.user?.id) {
    showAuth();
    return;
  }

  state.userId = session.user.id;
  state.userEmail = session.user.email || state.userEmail || '';
  stateLoad();
  state.userId = session.user.id;
  state.userEmail = session.user.email || state.userEmail || '';
  stateSave();
  document.getElementById('authModal')?.remove();

  renderAll();
  updateOnlineStatus();

  if (!state.onboarded) {
    setStatus('Başlangıç kurulumu bekleniyor', '');
    showOnboarding();
    return;
  }

  await loadAllCloudData();
  setStatus('Senkron aktif', 'ok');
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
          <input id="onboardStartDate" type="date" value="${START_DATE}" />
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
  const startWeight = parseFloat(document.getElementById('onboardStartWeight')?.value || '');
  const startWaist = parseFloat(document.getElementById('onboardStartWaist')?.value || '');
  const firstGoal = parseFloat(document.getElementById('onboardFirstGoal')?.value || '');
  const goalWeight = parseFloat(document.getElementById('onboardGoalWeight')?.value || '');

  if (!name || Number.isNaN(startWeight) || Number.isNaN(startWaist) || Number.isNaN(firstGoal) || Number.isNaN(goalWeight)) {
    alert('Lütfen tüm başlangıç bilgilerini doldur.');
    return;
  }

  state.onboarded = true;
  state.name = name;
  state.startDate = startDate;
  state.startWeight = parseFloat(startWeight.toFixed(1));
  state.startWaist = parseFloat(startWaist.toFixed(1));
  state.goalWeight = parseFloat(goalWeight.toFixed(1));
  state.milestones = [parseFloat(firstGoal.toFixed(1)), state.goalWeight];
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

  stateSave();

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

// â”€â”€ ONLINE STATUS â”€â”€
function updateOnlineStatus() {
  const notice = document.getElementById('offlineNotice');

  if (navigator.onLine) {
    if (notice) notice.classList.remove('visible');
    setStatus('Çevrimiçi - cloud senkron aktif', 'ok');
    setSyncDot('ok');
  } else {
    if (notice) notice.classList.add('visible');
    setStatus('Çevrimdışı - veriler yerel olarak saklanır', 'error');
    setSyncDot('err');
  }
}

// â”€â”€ PWA INSTALL â”€â”€
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

// â”€â”€ INIT â”€â”€
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
  if (measureDateInput) measureDateInput.value = getSuggestedMeasureDate();

  const workoutBtn = document.getElementById('saveWorkoutBtn');
  if (workoutBtn) workoutBtn.addEventListener('click', saveWorkout);

  const measurementBtn = document.getElementById('saveMeasurementBtn');
  if (measurementBtn) measurementBtn.addEventListener('click', saveMeasurementFromForm);

  const workoutCategoryInput = document.getElementById('workoutCategoryInput');
  if (workoutCategoryInput) {
    workoutCategoryInput.addEventListener('change', updateWorkoutTypes);
    updateWorkoutTypes();
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

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);

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

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then(reg => console.log('[SW] Kay?tl?:', reg.scope))
        .catch(err => console.warn('[SW] Kay?t hatas?:', err));
    });
  }
}

async function checkAuthSession() {
  setStatus('Oturum kontrol ediliyor...', '');

  const fallback = window.setTimeout(() => {
    setStatus('Hazır', 'ok');
  }, 3500);

  try {
    const { data } = await db.auth.getSession();
    window.clearTimeout(fallback);

    if (!data.session) {
      updateOnlineStatus();
      setStatus('Giriş bekleniyor', '');
      showAuth();
      return;
    }

    await continueWithSession(data.session);
  } catch (error) {
    window.clearTimeout(fallback);
    console.warn('Oturum kontrolü yapılamadı:', error);
    setStatus('Hazır', 'ok');
  }
}

function setupAuthListener() {
  db.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id && session.user.id !== state.userId) {
      continueWithSession(session);
    }
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
