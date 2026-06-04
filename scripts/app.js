'use strict';

// â”€â”€ SUPABASE â”€â”€
const SUPABASE_URL = 'https://wqbnghfduryuwcjrffyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8ZycJCD6a6qdgYbfPqh6Sg_FaYY_XMb';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase hazÄ±r:', db);

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
  milestones: [95, 85]
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

  bar.className = 'status-bar ' + cls;
  text.textContent = msg;
}

function setSyncDot(cls) {
  const dot = document.getElementById('syncDot');
  if (!dot) return;
  dot.className = 'sync-dot ' + cls;
}

// â”€â”€ PERSISTENCE â”€â”€
function stateSave() {
  try {
    localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
    setSyncDot('ok');
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
      onboarded: Boolean(savedState.onboarded),
      name: savedState.name || '',
      startDate: savedState.startDate || START_DATE,
      startWeight: savedState.startWeight ?? null,
      startWaist: savedState.startWaist ?? null,
      goalWeight: Number(savedState.goalWeight || 85),
      milestones: Array.isArray(savedState.milestones) ? savedState.milestones : [95, 85],
      measurements: Array.isArray(savedState.measurements) ? savedState.measurements : [],
      weights: Array.isArray(savedState.weights) ? savedState.weights : [],
      nutrition: Array.isArray(savedState.nutrition) ? savedState.nutrition : [],
      workouts: Array.isArray(savedState.workouts) ? savedState.workouts : [],
      notes: Array.isArray(savedState.notes) ? savedState.notes : [],
      sleep: Array.isArray(savedState.sleep) ? savedState.sleep : [],
    };
  } catch (e) {
    console.warn('State yÃ¼klenemedi:', e);
  }
}

// â”€â”€ THEME â”€â”€
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);

  const themeBtn = document.getElementById('themeBtn');
  const themeMeta = document.getElementById('themeColorMeta');

  if (themeBtn) {
    themeBtn.textContent = state.theme === 'dark' ? 'â˜€ï¸' : 'ğŸŒ™';
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
        ${sleepPct >= 100 || workoutPct >= 100 ? 'Ä°yi gidiyorsun' : 'Devam et'}
      </div>
    </div>

    <div class="week-metrics">
      <div class="week-metric">
        <div class="week-metric-top">
          <span>ğŸ˜´ Uyku</span>
          <strong>${sleepTotal.toFixed(1)} / ${SLEEP_TARGET} saat</strong>
        </div>
        <div class="week-track">
          <div class="week-fill sleep" style="width:${sleepPct}%"></div>
        </div>
      </div>

      <div class="week-metric">
        <div class="week-metric-top">
          <span>ğŸ‹ï¸ Antreman</span>
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
    el.innerHTML = '';
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
          <div class="goal-label">ğŸ¯ ÅU ANKÄ° ARA HEDEF</div>

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
        <div class="progress-summary-label">âš–ï¸ SON Ã–LÃ‡ÃœM</div>
        <div class="progress-summary-value">
          ${last.weight} <span>kg</span>
        </div>
      </div>

      <div class="progress-summary-side">
        <div class="progress-summary-small">${startDateText} baÅŸlangÄ±cÄ±ndan beri</div>
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
        Ä°lk Ã¶lÃ§Ã¼mÃ¼nÃ¼ eklediÄŸinde kilo ve bel kartlarÄ± burada gÃ¶rÃ¼necek.
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
          <div class="progress-summary-small">${startDateText} baÅŸlangÄ±cÄ±ndan beri</div>
          <div class="progress-summary-diff ${weightDiff <= 0 ? 'good' : 'bad'}">
            ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg
          </div>
        </div>
      </div>

      <div class="progress-summary-card">
        <div>
          <div class="progress-summary-label">Son Bel Ã–lÃ§Ã¼mÃ¼</div>
          <div class="progress-summary-value">${last.waist ?? 'â€”'} <span>cm</span></div>
        </div>
        <div class="progress-summary-side">
          <div class="progress-summary-small">${startDateText} baÅŸlangÄ±cÄ±ndan beri</div>
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

  if (!data.length) return;

  measurementChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(item => formatDate(item.date)),
      datasets: [
        {
          label: 'Kilo (kg)',
          data: data.map(item => item.weight),
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4
        },
        {
          label: 'Bel (cm)',
          data: data.map(item => item.waist),
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: false
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
      : '<span style="color:var(--muted)">â€”</span>';

    const waistDiffHtml = waistDiff
      ? `<span style="color:${waistDiff < 0 ? 'var(--green)' : 'var(--red)'}">${waistDiff > 0 ? '+' : ''}${waistDiff} cm</span>`
      : '<span style="color:var(--muted)">â€”</span>';

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-weight:700">
            ${m.weight ?? 'â€”'} <span style="font-size:12px;color:var(--muted)">kg</span>
            Â·
            ${m.waist ?? 'â€”'} <span style="font-size:12px;color:var(--muted)">cm bel</span>
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
          aria-label="Sil">âœ•</button>
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

  if (!latestWeek) return;

  const sleepWrap = document.getElementById('sleepBars');
  const workoutWrap = document.getElementById('workoutBars');

  if (sleepWrap) {
    const sleepData = (state.sleep || [])
      .filter(item =>
        item.date >= latestWeek.start &&
        item.date <= latestWeek.end
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    sleepWrap.innerHTML = `
      <div style="
        display:flex;
        align-items:flex-end;
        gap:12px;
        height:180px;
        padding:12px;
      ">
        ${sleepData.map(item => {
          const h = Math.max(16, item.hours * 14);

          return `
            <div style="
              flex:1;
              display:flex;
              flex-direction:column;
              align-items:center;
              gap:8px;
            ">
              <div style="
                width:100%;
                border-radius:16px;
                background:linear-gradient(180deg,#06b6d4,#3b82f6);
                height:${h}px;
                min-height:16px;
                transition:.3s;
              "></div>

              <div style="
                font-size:11px;
                color:var(--muted);
                font-family:var(--font-mono)
              ">
                ${new Date(item.date)
                  .toLocaleDateString('tr-TR', { weekday: 'short' })}
              </div>

              <div style="
                font-size:11px;
                font-weight:700;
              ">
                ${item.hours}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  if (workoutWrap) {
    const workoutData = (state.workouts || [])
      .filter(item =>
        item.date >= latestWeek.start &&
        item.date <= latestWeek.end
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    workoutWrap.innerHTML = `
      <div style="
        display:flex;
        align-items:flex-end;
        gap:12px;
        height:180px;
        padding:12px;
      ">
        ${workoutData.map(item => {
          const h = Math.max(12, item.duration * 1.2);

          return `
            <div style="
              flex:1;
              display:flex;
              flex-direction:column;
              align-items:center;
              gap:8px;
            ">
              <div style="
                width:100%;
                border-radius:16px;
                background:linear-gradient(180deg,#8b5cf6,#ec4899);
                height:${h}px;
                min-height:12px;
                transition:.3s;
              "></div>

              <div style="
                font-size:11px;
                color:var(--muted);
                font-family:var(--font-mono)
              ">
                ${new Date(item.date)
                  .toLocaleDateString('tr-TR', { weekday: 'short' })}
              </div>

              <div style="
                font-size:11px;
                font-weight:700;
              ">
                ${item.duration} dk
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
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
        Antreman: ${item.workouts} dk
      </div>
    </div>
  `).join('');
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
  applyTheme();
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
    console.error('Supabase load hatasÄ±:', error);
    setStatus('Cloud veri yÃ¼klenemedi', 'error');
    return;
  }

  const cloudMeasurements = (data || []).map(item => ({
    date: item.date,
    weight: parseFloat(item.weight),
    waist: parseFloat(item.waist),
  }));

  if (!cloudMeasurements.length && localMeasurements.length) {
    console.warn('Cloud ölçüm boş döndü; yerel başlangıç ölçümü korunuyor.');
    setStatus('Cloud ölçüm bulunamadı, yerel kayıt korunuyor', 'ok');
    return;
  }

  state.measurements = cloudMeasurements;

  stateSave();
  renderAll();
  console.log('Supabase veriler yÃ¼klendi:', data);
}

async function loadSleepFromSupabase() {
  const { data, error } = await db
    .from('sleep_logs')
    .select('*')
    .eq('user_id', getUserId())
    .order('date', { ascending: false });

  if (error) {
    console.error('Sleep load hatasÄ±:', error);
    setStatus('Uyku verileri yÃ¼klenemedi', 'error');
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
    console.error('Workout load hatasÄ±:', error);
    setStatus('Antreman verileri yÃ¼klenemedi', 'error');
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
    console.error('Notes load hatasÄ±:', error);
    setStatus('Notlar yÃ¼klenemedi', 'error');
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
    alert('GeÃ§erli bir kilo gir.');
    return;
  }

  if (Number.isNaN(waist) || waist <= 0) {
    alert('GeÃ§erli bir bel Ã¶lÃ§Ã¼mÃ¼ gir.');
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
    waist: parseFloat(waist.toFixed(1)),
  };

  const { error } = await db
    .from('measurements')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (error) {
    console.error('Measurement save error:', error);
    alert('Ã–lÃ§Ã¼m cloud kayÄ±t hatasÄ±: ' + error.message);
    setStatus('Cloud kayÄ±t hatasÄ±', 'error');
    return;
  }

  await loadMeasurementsFromSupabase();

  weightInput.value = '';
  waistInput.value = '';
  dateInput.value = getSuggestedMeasureDate();
  setStatus('Ã–lÃ§Ã¼m kaydedildi âœ“', 'ok');
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

  if (!Array.isArray(state.measurements)) state.measurements = [];

  const alreadyExists = state.measurements.some(item => item.date === date);

  if (alreadyExists) {
    alert('Bu tarih iÃ§in zaten kayÄ±t var. Ã–nce mevcut kaydÄ± silmelisin.');
    return;
  }

  const weightInput = prompt('Kilonu gir (kg):');
  if (!weightInput || isNaN(parseFloat(weightInput))) return;

  const waistInput = prompt('Bel Ã¶lÃ§Ã¼nÃ¼ gir (cm):');
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
    console.error('Supabase insert hatasÄ±:', error);
    alert('Supabase kayÄ±t hatasÄ±: ' + error.message);
    setStatus('Cloud kayÄ±t hatasÄ±', 'error');
    return;
  }

  state.measurements.push({
    date: measurement.date,
    weight: measurement.weight,
    waist: measurement.waist,
  });

  stateSave();
  renderAll();
  setStatus('Ã–lÃ§Ã¼m eklendi âœ“', 'ok');

  console.log('Supabase kayÄ±t baÅŸarÄ±lÄ±:', data);
}

async function deleteWeight(sortedIdx) {
  if (!confirm('Bu Ã¶lÃ§Ã¼mÃ¼ silmek istediÄŸinden emin misin?')) return;

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
    console.error('Supabase delete hatasÄ±:', error);
    alert('Cloud silme hatasÄ±: ' + error.message);
    return;
  }

  state.measurements.splice(target.originalIndex, 1);

  stateSave();
  renderAll();
  setStatus('Ã–lÃ§Ã¼m silindi âœ“', 'ok');
}

async function deleteNote(index) {
  if (!confirm('Bu notu silmek istediÄŸinden emin misin?')) return;

  const target = state.notes[index];
  if (!target) return;

  const { error } = await db
    .from('notes')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Note silme hatasÄ±:', error);
    alert('Not cloud silme hatasÄ±: ' + error.message);
    return;
  }

  await loadNotesFromSupabase();
  setStatus('Not silindi âœ“', 'ok');
}

async function deleteSleep(sortedIdx) {
  if (!confirm('Bu uyku kaydÄ±nÄ± silmek istediÄŸinden emin misin?')) return;

  const sorted = [...(state.sleep || [])].sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  const { error } = await db
    .from('sleep_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Sleep silme hatasÄ±:', error);
    alert('Uyku cloud silme hatasÄ±: ' + error.message);
    return;
  }

  await loadSleepFromSupabase();
  setStatus('Uyku kaydÄ± silindi âœ“', 'ok');
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
    console.error('Note kayÄ±t hatasÄ±:', error);
    alert('Not cloud kayÄ±t hatasÄ±: ' + error.message);
    return;
  }

  await loadNotesFromSupabase();

  setStatus('Not eklendi âœ“', 'ok');
  if (noteInput) noteInput.value = '';
}

async function saveSleep() {
  const dateInput = document.getElementById('sleepDateInput');
  const hourInput = document.getElementById('sleepInput');

  if (!dateInput || !hourInput) return;

  const date = dateInput.value || today();
  const hours = parseFloat(hourInput.value);

  if (!hours || hours <= 0) {
    alert('GeÃ§erli bir uyku saati gir');
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
    console.error('Sleep kayÄ±t hatasÄ±:', error);
    alert('Uyku cloud kayÄ±t hatasÄ±: ' + error.message);
    return;
  }

  await loadSleepFromSupabase();

  setStatus('Uyku kaydedildi âœ“', 'ok');
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
    alert('GeÃ§erli bir antreman sÃ¼resi gir');
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
    console.error('Workout kayÄ±t hatasÄ±:', error);
    alert('Antreman cloud kayÄ±t hatasÄ±: ' + error.message);
    return;
  }

  await loadWorkoutsFromSupabase();

  setStatus('Antreman kaydedildi âœ“', 'ok');
  durationInput.value = '';
  if (noteInput) noteInput.value = '';
  dateInput.value = today();
}

async function deleteWorkout(sortedIdx) {
  if (!confirm('Bu antreman kaydÄ±nÄ± silmek istediÄŸinden emin misin?')) return;

  const sorted = [...(state.workouts || [])].sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  const { error } = await db
    .from('workout_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Workout silme hatasÄ±:', error);
    alert('Antreman cloud silme hatasÄ±: ' + error.message);
    return;
  }

  await loadWorkoutsFromSupabase();
  setStatus('Antreman kaydÄ± silindi âœ“', 'ok');
}

function editName() {
  const newName = prompt('Ä°smini gir:', state.name || 'Sporcu');
  if (!newName) return;

  state.name = newName.trim();
  stateSave();
  renderAll();
  setStatus('Ä°sim gÃ¼ncellendi âœ“', 'ok');
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
  stateLoad();
  state.userId = session.user.id;
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
    .upsert([{
      user_id: getUserId(),
      date: startDate,
      weight: state.startWeight,
      waist: state.startWaist,
    }], { onConflict: 'user_id,date' });

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
    setStatus('Ã‡evrimiÃ§i â€” cloud senkron aktif', 'ok');
    setSyncDot('ok');
  } else {
    if (notice) notice.classList.add('visible');
    setStatus('Ã‡evrimdÄ±ÅŸÄ± â€” veriler yerel olarak saklanÄ±r', 'error');
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
      setStatus('Uygulama yÃ¼klendi âœ“', 'ok');
    }
  });
}

// â”€â”€ INIT â”€â”€
async function init() {
  const { data } = await db.auth.getSession();

  if (!data.session) {
    renderAll();
    updateOnlineStatus();
    setStatus('Giriş bekleniyor', '');
    showAuth();
  } else {
    await continueWithSession(data.session);
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id && session.user.id !== state.userId) {
      continueWithSession(session);
    }
  });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.onboarded) {
    loadAllCloudData();
  }
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

  function setupRealtime() {
  const channel = db
  .channel('realtime-measurements')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'measurements'
    },
    (payload) => {
      console.log('Realtime geldi:', payload);
      loadMeasurementsFromSupabase();
    }
  )
  .subscribe((status) => {
    console.log('Realtime status:', status);
  });
}

  if (state.userId) setupRealtime();

  const weightBtn = document.getElementById('openAddWeightBtn');
  if (weightBtn) weightBtn.addEventListener('click', addMeasurement);

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const editNameBtn = document.getElementById('editNameBtn');
  if (editNameBtn) editNameBtn.addEventListener('click', editName);

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
        .then(reg => console.log('[SW] KayÄ±tlÄ±:', reg.scope))
        .catch(err => console.warn('[SW] KayÄ±t hatasÄ±:', err));
    });
  }
}

// Expose for inline HTML handlers
window.goPanel = goPanel;
window.deleteWeight = deleteWeight;
window.deleteNote = deleteNote;
window.deleteSleep = deleteSleep;
window.deleteWorkout = deleteWorkout;

init();





