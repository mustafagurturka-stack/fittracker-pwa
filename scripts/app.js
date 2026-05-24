'use strict';

// ── SUPABASE ──
const SUPABASE_URL = 'https://wqbnghfduryuwcjrffyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8ZycJCD6a6qdgYbfPqh6Sg_FaYY_XMb';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase hazır:', db);

// ── CONSTANTS ──
const PANELS = ['pHome', 'pWeight', 'pDaily', 'pProgress', 'pSettings'];
const BN_IDS = ['bn0', 'bn1', 'bn2', 'bn3', 'bn4'];
const STORAGE_KEY = 'ft_state_v1';

const MOTIVATIONS = [
  'Bugün küçük bir adım at, yarın farkı hissedeceksin. 🌱',
  'Mükemmel olmak zorunda değilsin; devam etmek yeterli. 💪',
  'Her kayıt, hedefe biraz daha yaklaştığının kanıtı. 🎯',
  'Bugün kendine yatırım yaptığın bir gün olsun. ✨',
  'Disiplin, motivasyonun bittiği yerde seni taşır. 🔥',
  'Uyku, hareket ve istikrar: değişimin üç anahtarı. 🔑',
  'Vücudun emeğini hatırlar; bugün boşa gitmez. 🏆',
  'Küçük kazanımlar büyük dönüşümlerin temelidir. ✅',
  'Bugün bırakırsan aynı yerde kalırsın; devam edersen değişirsin. 🚀',
  'Hedef uzak görünse de sıradaki adım çok yakın. 👣',
];

// ── STATE ──
let state = {
  theme: 'light',
  name: 'Mustafa Gürtürk Avcı',
  measurements: [],
  weights: [],
  nutrition: [],
  workouts: [],
  notes: [],
  sleep: [],
  goalWeight: 85,
  milestones: [95, 90, 85]
};

let measurementChart = null;
let sleepChart = null;
let workoutChart = null;
// ── HELPERS ──
function today() {
  return new Date().toISOString().slice(0, 10);
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

// ── PERSISTENCE ──
function stateSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSyncDot('ok');
  } catch (e) {
    console.error('State kaydedilemedi:', e);
    setSyncDot('err');
    setStatus('Kayıt hatası: ' + e.message, 'error');
  }
}

function stateLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const savedState = JSON.parse(raw);

    state = {
      ...state,
      ...savedState,
      name: 'Mustafa Gürtürk Avcı',
      goalWeight: 85,
      milestones: [95, 90, 85],
      measurements: Array.isArray(savedState.measurements) ? savedState.measurements : [],
      weights: Array.isArray(savedState.weights) ? savedState.weights : [],
      nutrition: Array.isArray(savedState.nutrition) ? savedState.nutrition : [],
      workouts: Array.isArray(savedState.workouts) ? savedState.workouts : [],
      notes: Array.isArray(savedState.notes) ? savedState.notes : [],
      sleep: Array.isArray(savedState.sleep) ? savedState.sleep : [],
    };
  } catch (e) {
    console.warn('State yüklenemedi:', e);
  }
}

// ── THEME ──
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

// ── NAVIGATION ──
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

// ── RENDER ──
function renderHero() {
  const dateEl = document.getElementById('heroDate');
  const nameEl = document.getElementById('heroName');

  if (dateEl) {
    dateEl.textContent = new Date()
      .toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
      .toUpperCase();
  }

  if (nameEl) {
    nameEl.textContent = 'Mustafa Gürtürk Avcı';
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
  const sleepTarget = 49;
  const sleepPct = Math.min(100, Math.round((sleepTotal / sleepTarget) * 100));

  const workoutTotal = getCurrentWeekWorkoutTotal();
  const workoutTarget = 180;
  const workoutPct = Math.min(100, Math.round((workoutTotal / workoutTarget) * 100));

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
          <span>😴 Uyku</span>
          <strong>${sleepTotal.toFixed(1)} / ${sleepTarget} saat</strong>
        </div>
        <div class="week-track">
          <div class="week-fill sleep" style="width:${sleepPct}%"></div>
        </div>
      </div>

      <div class="week-metric">
        <div class="week-metric-top">
          <span>🏋️ Antreman</span>
          <strong>${workoutTotal} / ${workoutTarget} dk</strong>
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

  if (!currentGoal) {
    currentGoal = milestones[milestones.length - 1];
  }

  const kgLeft = Math.max(0, Number(last.weight - currentGoal).toFixed(1));
  const startDateText = formatDate(first.date);
  const finalKgLeft = Math.max(0, Number(last.weight - state.goalWeight).toFixed(1));
  const totalNeeded = first.weight - currentGoal;
  const completed = first.weight - last.weight;

  const progressPct = totalNeeded > 0
    ? Math.min(100, Math.round((completed / totalNeeded) * 100))
    : 100;

  const finalTotalNeeded = first.weight - state.goalWeight;
  const finalProgressPct = finalTotalNeeded > 0
  ? Math.min(100, Math.round((completed / finalTotalNeeded) * 100))
  : 100;

  el.innerHTML = `
    <div class="goal-hero-card">
      <div class="goal-label">🎯 ŞU ANKİ ARA HEDEF</div>
      <div class="goal-value">${currentGoal} kg</div>
      <div class="goal-sub">
  İlk hedefe kalan: ${kgLeft} kg · Final hedefe kalan: ${finalKgLeft} kg
</div>

      <div class="goal-progress-block">
  <div class="goal-progress-row">
    <span>İlk hedef ilerlemesi</span>
    <strong>%${progressPct}</strong>
  </div>
  <div class="goal-track">
    <div class="goal-fill" style="width:${progressPct}%"></div>
  </div>
</div>

<div class="goal-progress-block">
  <div class="goal-progress-row">
    <span>Final hedef ilerlemesi</span>
    <strong>%${finalProgressPct}</strong>
  </div>
  <div class="goal-track final">
    <div class="goal-fill final" style="width:${finalProgressPct}%"></div>
  </div>
</div>

<div class="goal-percent">
  İlk hedef: ${currentGoal} kg · Final hedef: ${state.goalWeight} kg
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
        <div class="progress-summary-label">⚖️ SON ÖLÇÜM</div>
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
      : '<span style="color:var(--muted)">—</span>';

    const waistDiffHtml = waistDiff
      ? `<span style="color:${waistDiff < 0 ? 'var(--green)' : 'var(--red)'}">${waistDiff > 0 ? '+' : ''}${waistDiff} cm</span>`
      : '<span style="color:var(--muted)">—</span>';

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-weight:700">
            ${m.weight ?? '—'} <span style="font-size:12px;color:var(--muted)">kg</span>
            ·
            ${m.waist ?? '—'} <span style="font-size:12px;color:var(--muted)">cm bel</span>
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
          aria-label="Sil">✕</button>
      </div>
    `;
  }).join('');
}

function renderNotes() {
  const list = document.getElementById('noteList');
  if (!list) return;

  const notes = Array.isArray(state.notes) ? state.notes : [];

  if (!notes.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        Henüz not yok.
      </div>
    `;
    return;
  }

  list.innerHTML = notes.map((note, index) => `
    <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-weight:700">${note.text}</div>
        <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono)">
          ${formatDate(note.date)}
        </div>
      </div>
      <button onclick="deleteNote(${index})"
        style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px"
        aria-label="Sil">✕</button>
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

  if (!sleep.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😴</div>
        Henüz uyku kaydı yok.
      </div>
    `;
    return;
  }

  const groups = {};

  sleep.forEach(item => {
    const range = getWeekRange(item.date);
    const key = `${range.start}_${range.end}`;

    if (!groups[key]) {
      groups[key] = {
        start: range.start,
        end: range.end,
        total: 0,
        count: 0,
      };
    }

    groups[key].total += Number(item.hours || 0);
    groups[key].count += 1;
  });

  el.innerHTML = Object.values(groups)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map(week => {
      const avg = (week.total / week.count).toFixed(1);

      return `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700">
            ${formatDate(week.start)} - ${formatDate(week.end)}
          </div>

          <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
            Toplam: ${week.total.toFixed(1)} saat · Ortalama: ${avg} saat · Kayıt: ${week.count} gün
          </div>
        </div>
      `;
    })
    .join('');
}

function renderSleepList() {
  const list = document.getElementById('sleepList');
  if (!list) return;

  const sleep = [...(state.sleep || [])].sort((a, b) => b.date.localeCompare(a.date));

  if (!sleep.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = sleep.map((item, index) => `
    <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-weight:700">${Number(item.hours).toFixed(1)} saat</div>
        <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono)">
          ${formatDate(item.date)}
        </div>
      </div>

      <button onclick="deleteSleep(${index})"
        style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px"
        aria-label="Sil">✕</button>
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

  if (!workouts.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏋️</div>
        Henüz antreman kaydı yok.
      </div>
    `;
    return;
  }

  const groups = {};

  workouts.forEach(item => {
    const range = getWeekRange(item.date);
    const key = `${range.start}_${range.end}`;

    if (!groups[key]) {
      groups[key] = {
        start: range.start,
        end: range.end,
        total: 0,
        count: 0,
        types: {},
      };
    }

    groups[key].total += Number(item.duration || 0);
    groups[key].count += 1;
    groups[key].types[item.type] = (groups[key].types[item.type] || 0) + 1;
  });

  el.innerHTML = Object.values(groups)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map(week => {
      const typeText = Object.entries(week.types)
        .map(([type, count]) => `${type}: ${count}`)
        .join(' · ');

      return `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <div style="font-weight:700">
            ${formatDate(week.start)} - ${formatDate(week.end)}
          </div>

          <div style="font-size:12px;color:var(--muted);font-family:var(--font-mono)">
            Toplam: ${week.total} dk · Kayıt: ${week.count}
          </div>

          <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);margin-top:4px">
            ${typeText}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderWorkoutList() {
  const list = document.getElementById('workoutList');
  if (!list) return;

  const workouts = [...(state.workouts || [])].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  if (!workouts.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = workouts.map((item, index) => `
    <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-weight:700">${item.type} · ${Number(item.duration)} dk</div>
        <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono)">
          ${formatDate(item.date)}
          ${item.note ? ` · ${item.note}` : ''}
        </div>
      </div>

      <button onclick="deleteWorkout(${index})"
        style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px"
        aria-label="Sil">✕</button>
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

function renderProgressSummary() {
  const el = document.getElementById('progressSummary');
  if (!el) return;

  const data = getWeeklyProgressData();

  if (!data.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📈</div>
        Henüz progress verisi yok.
      </div>
    `;
    return;
  }

  const current = data[data.length - 1];
  const prev = data[data.length - 2];

  const sleepTarget = 49;
  const workoutTarget = 180;

  const sleepPct = Math.min(100, Math.round((current.sleep / sleepTarget) * 100));
  const workoutPct = Math.min(100, Math.round((current.workouts / workoutTarget) * 100));

  const sleepDiff = prev ? current.sleep - prev.sleep : 0;
  const workoutDiff = prev ? current.workouts - prev.workouts : 0;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding:14px">

      <div style="border:1px solid var(--border);border-radius:16px;padding:16px;background:var(--card)">
        <div style="font-size:24px">😴</div>
        <div style="font-weight:800;margin-top:6px">Uyku</div>
        <div style="font-size:22px;font-weight:900;margin-top:8px">
          ${current.sleep.toFixed(1)} / ${sleepTarget} saat
        </div>
        <div style="height:8px;background:var(--border);border-radius:999px;margin-top:10px;overflow:hidden">
          <div style="height:100%;width:${sleepPct}%;background:var(--blue);border-radius:999px"></div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:8px">
          ${sleepPct >= 100 ? 'Hedef tamamlandı ✅' : `%${sleepPct} tamamlandı`}
        </div>
        <div style="font-size:12px;color:${sleepDiff >= 0 ? 'var(--green)' : 'var(--red)'};margin-top:4px">
          Geçen haftaya göre ${sleepDiff >= 0 ? '+' : ''}${sleepDiff.toFixed(1)} saat
        </div>
      </div>

      <div style="border:1px solid var(--border);border-radius:16px;padding:16px;background:var(--card)">
        <div style="font-size:24px">🏋️</div>
        <div style="font-weight:800;margin-top:6px">Antreman</div>
        <div style="font-size:22px;font-weight:900;margin-top:8px">
          ${current.workouts} / ${workoutTarget} dk
        </div>
        <div style="height:8px;background:var(--border);border-radius:999px;margin-top:10px;overflow:hidden">
          <div style="height:100%;width:${workoutPct}%;background:var(--blue);border-radius:999px"></div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:8px">
          ${workoutPct >= 100 ? 'Hedef tamamlandı ✅' : `%${workoutPct} tamamlandı`}
        </div>
        <div style="font-size:12px;color:${workoutDiff >= 0 ? 'var(--green)' : 'var(--red)'};margin-top:4px">
          Geçen haftaya göre ${workoutDiff >= 0 ? '+' : ''}${workoutDiff} dk
        </div>
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

// ── SUPABASE DATA ──
async function loadMeasurementsFromSupabase() {
  const { data, error } = await db
    .from('measurements')
    .select('*')
    .eq('user_id', 'demo-user')
    .order('date', { ascending: false });

  if (error) {
    console.error('Supabase load hatası:', error);
    setStatus('Cloud veri yüklenemedi', 'error');
    return;
  }

  state.measurements = (data || []).map(item => ({
    date: item.date,
    weight: parseFloat(item.weight),
    waist: parseFloat(item.waist),
  }));

  stateSave();
  renderAll();
  console.log('Supabase veriler yüklendi:', data);
}

async function loadSleepFromSupabase() {
  const { data, error } = await db
    .from('sleep_logs')
    .select('*')
    .eq('user_id', 'demo-user')
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
    .eq('user_id', 'demo-user')
    .order('date', { ascending: false });

  if (error) {
    console.error('Workout load hatası:', error);
    setStatus('Antreman verileri yüklenemedi', 'error');
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
    .eq('user_id', 'demo-user')
    .order('date', { ascending: false });

  if (error) {
    console.error('Notes load hatası:', error);
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
  loadMeasurementsFromSupabase();
  loadSleepFromSupabase();
  loadWorkoutsFromSupabase();
  loadNotesFromSupabase();

}
// ── ACTIONS ──
async function addMeasurement() {
  const dateInput = prompt('Ölçüm tarihi gir (gg/aa/yyyy):', todayDisplay());
  if (!dateInput) return;

  const date = parseDisplayDate(dateInput);
  if (!date) {
    alert('Tarih formatı hatalı. Örnek: 27/04/2026 veya 27.04.2026');
    return;
  }

  if (!Array.isArray(state.measurements)) state.measurements = [];

  const alreadyExists = state.measurements.some(item => item.date === date);

  if (alreadyExists) {
    alert('Bu tarih için zaten kayıt var. Önce mevcut kaydı silmelisin.');
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
    user_id: 'demo-user',
  };

  const { data, error } = await db
    .from('measurements')
    .insert([measurement])
    .select();

  if (error) {
    console.error('Supabase insert hatası:', error);
    alert('Supabase kayıt hatası: ' + error.message);
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

  console.log('Supabase kayıt başarılı:', data);
}

async function deleteWeight(sortedIdx) {
  if (!confirm('Bu ölçümü silmek istediğinden emin misin?')) return;

  const sorted = [...state.measurements]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const target = sorted[sortedIdx];

  if (!target) return;

  const { error } = await db
    .from('measurements')
    .delete()
    .eq('user_id', 'demo-user')
    .eq('date', target.date)
    .eq('weight', target.weight)
    .eq('waist', target.waist);

  if (error) {
    console.error('Supabase delete hatası:', error);
    alert('Cloud silme hatası: ' + error.message);
    return;
  }

  state.measurements.splice(target.originalIndex, 1);

  stateSave();
  renderAll();
  setStatus('Ölçüm silindi ✓', 'ok');
}

async function deleteNote(index) {
  if (!confirm('Bu notu silmek istediğinden emin misin?')) return;

  const target = state.notes[index];
  if (!target) return;

  const { error } = await db
    .from('notes')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Note silme hatası:', error);
    alert('Not cloud silme hatası: ' + error.message);
    return;
  }

  await loadNotesFromSupabase();
  setStatus('Not silindi ✓', 'ok');
}

async function deleteSleep(sortedIdx) {
  if (!confirm('Bu uyku kaydını silmek istediğinden emin misin?')) return;

  const sorted = [...(state.sleep || [])].sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  const { error } = await db
    .from('sleep_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Sleep silme hatası:', error);
    alert('Uyku cloud silme hatası: ' + error.message);
    return;
  }

  await loadSleepFromSupabase();
  setStatus('Uyku kaydı silindi ✓', 'ok');
}

async function addNote() {
  const text = prompt('Not gir:');
  if (!text || !text.trim()) return;

  const { error } = await db
    .from('notes')
    .insert([{
      user_id: 'demo-user',
      date: today(),
      text: text.trim(),
    }]);

  if (error) {
    console.error('Note kayıt hatası:', error);
    alert('Not cloud kayıt hatası: ' + error.message);
    return;
  }

  await loadNotesFromSupabase();

  setStatus('Not eklendi ✓', 'ok');
}

async function saveSleep() {
  const dateInput = document.getElementById('sleepDateInput');
  const hourInput = document.getElementById('sleepInput');

  if (!dateInput || !hourInput) return;

  const date = dateInput.value || today();
  const hours = parseFloat(hourInput.value);

  if (!hours || hours <= 0) {
    alert('Geçerli bir uyku saati gir');
    return;
  }

  const payload = {
    user_id: 'demo-user',
    date,
    hours: parseFloat(hours.toFixed(1)),
  };

  const { error } = await db
    .from('sleep_logs')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (error) {
    console.error('Sleep kayıt hatası:', error);
    alert('Uyku cloud kayıt hatası: ' + error.message);
    return;
  }

  await loadSleepFromSupabase();

  setStatus('Uyku kaydedildi ✓', 'ok');
  hourInput.value = '';
  dateInput.value = today();
}

async function saveWorkout() {
  const dateInput = document.getElementById('workoutDateInput');
  const typeInput = document.getElementById('workoutTypeInput');
  const durationInput = document.getElementById('workoutDurationInput');
  const noteInput = document.getElementById('workoutNoteInput');

  if (!dateInput || !typeInput || !durationInput) return;

  const date = dateInput.value || today();
  const type = typeInput.value;
  const duration = parseInt(durationInput.value, 10);
  const note = noteInput ? noteInput.value.trim() : '';

  if (!duration || duration <= 0) {
    alert('Geçerli bir antreman süresi gir');
    return;
  }

  const { error } = await db
    .from('workout_logs')
    .insert([{
      user_id: 'demo-user',
      date,
      type,
      duration,
      note,
    }]);

  if (error) {
    console.error('Workout kayıt hatası:', error);
    alert('Antreman cloud kayıt hatası: ' + error.message);
    return;
  }

  await loadWorkoutsFromSupabase();

  setStatus('Antreman kaydedildi ✓', 'ok');
  durationInput.value = '';
  if (noteInput) noteInput.value = '';
  dateInput.value = today();
}

async function deleteWorkout(sortedIdx) {
  if (!confirm('Bu antreman kaydını silmek istediğinden emin misin?')) return;

  const sorted = [...(state.workouts || [])].sort((a, b) => b.date.localeCompare(a.date));
  const target = sorted[sortedIdx];
  if (!target) return;

  const { error } = await db
    .from('workout_logs')
    .delete()
    .eq('id', target.id);

  if (error) {
    console.error('Workout silme hatası:', error);
    alert('Antreman cloud silme hatası: ' + error.message);
    return;
  }

  await loadWorkoutsFromSupabase();
  setStatus('Antreman kaydı silindi ✓', 'ok');
}

function editName() {
  const newName = prompt('İsmini gir:', state.name || 'Sporcu');
  if (!newName) return;

  state.name = newName.trim();
  stateSave();
  renderAll();
  setStatus('İsim güncellendi ✓', 'ok');
}

// ── ONLINE STATUS ──
function updateOnlineStatus() {
  const notice = document.getElementById('offlineNotice');

  if (navigator.onLine) {
    if (notice) notice.classList.remove('visible');
    setStatus('Çevrimiçi — cloud senkron aktif', 'ok');
    setSyncDot('ok');
  } else {
    if (notice) notice.classList.add('visible');
    setStatus('Çevrimdışı — veriler yerel olarak saklanır', 'error');
    setSyncDot('err');
  }
}

// ── PWA INSTALL ──
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

// ── INIT ──
function init() {
  stateLoad();
  renderAll();
  updateOnlineStatus();
  setStatus('Hazır', 'ok');

  loadAllCloudData();

  document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadAllCloudData();
  }
});

  const sleepBtn = document.getElementById('saveSleepBtn');
if (sleepBtn) sleepBtn.addEventListener('click', saveSleep);

  const sleepDateInput = document.getElementById('sleepDateInput');
if (sleepDateInput) sleepDateInput.value = today();

  const workoutDateInput = document.getElementById('workoutDateInput');
if (workoutDateInput) workoutDateInput.value = today();

const workoutBtn = document.getElementById('saveWorkoutBtn');
if (workoutBtn) workoutBtn.addEventListener('click', saveWorkout);

window.addEventListener('focus', () => {
  loadAllCloudData();
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

  setupRealtime();

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
        .then(reg => console.log('[SW] Kayıtlı:', reg.scope))
        .catch(err => console.warn('[SW] Kayıt hatası:', err));
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
