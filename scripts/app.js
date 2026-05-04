'use strict';

// ── SUPABASE ──
const SUPABASE_URL = 'https://wqbnghfduryuwcjrffyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8ZycJCD6a6qdgYbfPqh6Sg_FaYY_XMb';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase hazır:', db);

// ── CONSTANTS ──
const PANELS = ['pHome', 'pWeight', 'pDaily', 'pSettings'];
const BN_IDS = ['bn0', 'bn1', 'bn2', 'bn3'];
const STORAGE_KEY = 'ft_state_v1';

const MOTIVATIONS = [
  'Her adım seni hedefe yaklaştırıyor. 🎯',
  'Bugün verdiğin mücadele yarın gücüne dönüşür. 💪',
  'Küçük adımlar büyük değişimlerin temelidir. 🌱',
  'Vücuduna verdiğin özen, geleceğine yapılan yatırımdır. 🏆',
  'Disiplin, motivasyonun bittiği yerde devreye girer. 🔥',
];

// ── STATE ──
let state = {
  theme: 'light',
  name: 'Sporcu',
  measurements: [],
  weights: [],
  water: { ml: 0, date: '' },
  nutrition: [],
  workouts: [],
  notes: [],
  goalWeight: 74,
};

let measurementChart = null;
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
      measurements: Array.isArray(savedState.measurements) ? savedState.measurements : [],
      weights: Array.isArray(savedState.weights) ? savedState.weights : [],
      nutrition: Array.isArray(savedState.nutrition) ? savedState.nutrition : [],
      workouts: Array.isArray(savedState.workouts) ? savedState.workouts : [],
      notes: Array.isArray(savedState.notes) ? savedState.notes : [],
      water: savedState.water || { ml: 0, date: '' },
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
    nameEl.textContent = state.name || 'Sporcu';
  }
}

function renderMoti() {
  const el = document.getElementById('motiText');
  if (!el) return;

  const idx = Math.floor(Date.now() / 86400000) % MOTIVATIONS.length;
  el.textContent = MOTIVATIONS[idx];
}

function renderStats() {
  const measurements = [...(state.measurements || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const last = measurements[measurements.length - 1];
  const prev = measurements[measurements.length - 2];

  const statWeight = document.getElementById('statWeight');
  const statWeightPct = document.getElementById('statWeightPct');
  const weightBar = document.getElementById('weightBar');

  if (last) {
    if (statWeight) statWeight.textContent = last.weight ?? '—';

    if (prev) {
      const diff = (last.weight - prev.weight).toFixed(1);
      if (statWeightPct) statWeightPct.textContent = diff > 0 ? `+${diff} kg` : `${diff} kg`;
    } else {
      if (statWeightPct) statWeightPct.textContent = 'İlk kayıt';
    }

    if (weightBar) weightBar.style.width = '100%';
  } else {
    if (statWeight) statWeight.textContent = '—';
    if (statWeightPct) statWeightPct.textContent = '—';
    if (weightBar) weightBar.style.width = '0%';
  }

  const statWaist = document.getElementById('statWaist');
  const statWaistDiff = document.getElementById('statWaistDiff');
  const waistBar = document.getElementById('waistBar');

  if (last && last.waist != null) {
    if (statWaist) statWaist.textContent = last.waist;

    if (prev && prev.waist != null) {
      const diff = (last.waist - prev.waist).toFixed(1);
      if (statWaistDiff) statWaistDiff.textContent = diff > 0 ? `+${diff} cm` : `${diff} cm`;
      if (waistBar) waistBar.style.width = Math.min(100, Math.abs(diff) * 20) + '%';
    } else {
      if (statWaistDiff) statWaistDiff.textContent = 'İlk kayıt';
      if (waistBar) waistBar.style.width = '0%';
    }
  } else {
    if (statWaist) statWaist.textContent = '—';
    if (statWaistDiff) statWaistDiff.textContent = '—';
    if (waistBar) waistBar.style.width = '0%';
  }

  const todayWater = state.water?.date === today() ? state.water.ml || 0 : 0;
  const waterPct = Math.min(100, Math.round(todayWater / 30));

  const statWater = document.getElementById('statWater');
  const statWaterPct = document.getElementById('statWaterPct');
  const waterBar = document.getElementById('waterBar');

  if (statWater) statWater.textContent = todayWater;
  if (statWaterPct) statWaterPct.textContent = waterPct + '%';
  if (waterBar) waterBar.style.width = waterPct + '%';

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const workoutsThisWeek = (state.workouts || []).filter(
    w => w.date >= weekAgo.toISOString().slice(0, 10)
  ).length;

  const statWorkouts = document.getElementById('statWorkouts');
  if (statWorkouts) statWorkouts.textContent = workoutsThisWeek;
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

function renderAll() {
  renderHero();
  renderMoti();
  renderStats();
  renderMeasurementChart();
  renderWeightList();
  renderNotes();
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

function deleteNote(index) {
  if (!confirm('Bu notu silmek istediğinden emin misin?')) return;

  if (!Array.isArray(state.notes)) state.notes = [];

  state.notes.splice(index, 1);

  stateSave();
  renderNotes();
  setStatus('Not silindi ✓', 'ok');
}

function addNote() {
  const text = prompt('Not gir:');
  if (!text || !text.trim()) return;

  if (!Array.isArray(state.notes)) state.notes = [];

  state.notes.push({
    text: text.trim(),
    date: today(),
  });

  stateSave();
  renderNotes();
  setStatus('Not eklendi ✓', 'ok');
}

function editName() {
  const newName = prompt('İsmini gir:', state.name || 'Sporcu');
  if (!newName) return;

  state.name = newName.trim();
  stateSave();
  renderHero();
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

  loadMeasurementsFromSupabase();

  document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadMeasurementsFromSupabase();
  }
});

window.addEventListener('focus', () => {
  loadMeasurementsFromSupabase();
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

init();
