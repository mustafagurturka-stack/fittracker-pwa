'use strict';

// ── CONSTANTS ──
const PANELS = ['pHome','pWeight','pDaily','pSettings'];
const BN_IDS  = ['bn0','bn1','bn2','bn3'];
const MOTIVATIONS = [
  'Her adım seni hedefe yaklaştırıyor. 🎯',
  'Bugün verdiğin mücadele yarın gücüne dönüşür. 💪',
  'Küçük adımlar büyük değişimlerin temelidir. 🌱',
  'Vücuduna verdiğin özen, geleceğine yapılan yatırımdır. 🏆',
  'Disiplin, motivasyonun bittiği yerde devreye girer. 🔥',
];
const STORAGE_KEY = 'ft_state_v1';

// ── STATE ──
let state = {
  theme: 'light',
  name: 'Sporcu',
  weights: [],
  water: { ml: 0, date: '' },
  nutrition: [],
  workouts: [],
  notes: [],
  goalWeight: 74,
};

// ── HELPERS ──
function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' });
}

function setStatus(msg, cls = '') {
  const bar  = document.getElementById('statusBar');
  const text = document.getElementById('statusText');
  bar.className = 'status-bar ' + cls;
  text.textContent = msg;
}

function setSyncDot(cls) {
  const dot = document.getElementById('syncDot');
  dot.className = 'sync-dot ' + cls;
}

// ── PERSISTENCE ──
function stateSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSyncDot('ok');
    console.log('State saved:', state);
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
      weights: Array.isArray(savedState.weights) ? savedState.weights : [],
      nutrition: Array.isArray(savedState.nutrition) ? savedState.nutrition : [],
      workouts: Array.isArray(savedState.workouts) ? savedState.workouts : [],
      notes: Array.isArray(savedState.notes) ? savedState.notes : [],
      water: savedState.water || { ml: 0, date: '' },
    };

  } catch (e) {
    console.warn('State yüklenemedi, sıfırlanıyor.', e);
  }
}

// ── THEME ──
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeColorMeta').content = state.theme === 'dark' ? '#0f1117' : '#3b82f6';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  stateSave();
}

// ── NAVIGATION ──
function goPanel(idx) {
  PANELS.forEach((id, i) => {
    document.getElementById(id).classList.toggle('active', i === idx);
  });
  BN_IDS.forEach((id, i) => {
    document.getElementById(id).classList.toggle('active', i === idx);
  });
}

// ── RENDER ──
function renderHero() {
  const dateEl = document.getElementById('heroDate');
  const nameEl = document.getElementById('heroName');
  const opts = { weekday:'long', day:'numeric', month:'long' };
  dateEl.textContent = new Date().toLocaleDateString('tr-TR', opts).toUpperCase();
  nameEl.textContent = state.name;
}

function renderMoti() {
  const idx  = Math.floor(Date.now() / 86400000) % MOTIVATIONS.length;
  document.getElementById('motiText').textContent = MOTIVATIONS[idx];
}

function renderStats() {
  // Water
  const todayWater = (state.water?.date === today()) ? (state.water.ml || 0) : 0;
  const waterPct   = Math.min(100, Math.round(todayWater / 30));
  document.getElementById('statWater').textContent = todayWater;
  document.getElementById('statWaterPct').textContent = waterPct + '%';
  document.getElementById('waterBar').style.width = waterPct + '%';

  // Weight
  const weights = [...(state.weights || [])].sort((a,b) => a.date.localeCompare(b.date));
  const last    = weights[weights.length - 1];
  if (last) {
    document.getElementById('statWeight').textContent = last.weight;
    const goal   = state.goalWeight || 74;
    const start  = weights[0]?.weight || last.weight;
    const prog   = start > goal
      ? Math.min(100, Math.round(((start - last.weight) / (start - goal)) * 100))
      : 100;
    document.getElementById('statWeightPct').textContent = prog + '%';
    document.getElementById('weightBar').style.width = prog + '%';
  }

  // Kcal today
  const kcal = (state.nutrition || [])
    .filter(n => n.date === today())
    .reduce((s, n) => s + (parseFloat(n.kcal) || 0), 0);
  document.getElementById('statKcal').textContent = Math.round(kcal);

  // Workouts this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const wo = (state.workouts || [])
    .filter(w => w.date >= weekAgo.toISOString().slice(0,10)).length;
  document.getElementById('statWorkouts').textContent = wo;
}

function renderWeightList() {
  const list  = document.getElementById('weightList');
  const empty = document.getElementById('weightEmpty');
  const data  = [...(state.weights || [])].sort((a,b) => b.date.localeCompare(a.date));

  if (!data.length) {
    empty.style.display = 'block';
    list.innerHTML = '';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = data.map((w, i) => {
    const prev = data[i + 1];
    const diff = prev ? (parseFloat(w.weight) - parseFloat(prev.weight)).toFixed(1) : null;
    const diffStr = diff
      ? `<span style="color:${diff < 0 ? 'var(--green)' : 'var(--red)'}">${diff > 0 ? '+' : ''}${diff} kg</span>`
      : '<span style="color:var(--muted)">—</span>';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-weight:700">${w.weight} <span style="font-size:12px;color:var(--muted)">kg</span></div>
          <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono)">${formatDate(w.date)}</div>
        </div>
        <div style="font-family:var(--font-mono);font-size:12px">${diffStr}</div>
        <button onclick="deleteWeight(${i})" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px" aria-label="Sil">✕</button>
      </div>`;
  }).join('');
}

function renderAll() {
  renderHero();
  renderMoti();
  renderStats();
  renderWeightList();
  applyTheme();
}

// ── WEIGHT ACTIONS ──
function deleteWeight(sortedIdx) {
  if (!confirm('Bu kaydı silmek istediğinden emin misin?')) return;

  const sorted = [...state.weights]
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const target = sorted[sortedIdx];

  if (!target) return;

  state.weights.splice(target.originalIndex, 1);

  stateSave();

  // Ana sayfa + kilo listesi birlikte güncellensin
  renderStats();
  renderWeightList();

  // Eğer tüm kilo kayıtları silindiyse ana sayfadaki kilo kartını sıfırla
  if (!state.weights.length) {
    document.getElementById('statWeight').textContent = '—';
    document.getElementById('statWeightPct').textContent = '—';
    document.getElementById('weightBar').style.width = '0%';
  }

  setStatus('Kayıt silindi ✓', 'ok');
}

// ── ADD WEIGHT (simple prompt, will be a modal in Phase 2) ──
document.getElementById('openAddWeightBtn').addEventListener('click', () => {
  const kg = prompt('Kilonu gir (kg):');
  if (!kg || isNaN(parseFloat(kg))) return;

  if (!state.weights) state.weights = [];

  state.weights.push({
    date: today(),
    weight: parseFloat(kg).toFixed(1)
  });

  stateSave();
  renderAll();
  setStatus('Kayıt eklendi ✓', 'ok');
});

document.getElementById('editNameBtn').addEventListener('click', () => {
  const newName = prompt('İsmini gir:', state.name || 'Sporcu');
  if (!newName) return;

  state.name = newName.trim();
  stateSave();
  renderHero();
  setStatus('İsim güncellendi ✓', 'ok');
});

// ── THEME BUTTON ──
document.getElementById('themeBtn').addEventListener('click', toggleTheme);

// ── OFFLINE ──
function updateOnlineStatus() {
  const notice = document.getElementById('offlineNotice');
  if (navigator.onLine) {
    notice.classList.remove('visible');
    setStatus('Çevrimiçi — veriler yerel olarak saklanıyor', 'ok');
    setSyncDot('ok');
  } else {
    notice.classList.add('visible');
    setStatus('Çevrimdışı — değişiklikler saklandı', 'error');
    setSyncDot('err');
  }
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ── PWA INSTALL ──
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').classList.add('visible');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBanner').classList.remove('visible');
  if (outcome === 'accepted') setStatus('Uygulama yüklendi ✓', 'ok');
});
document.getElementById('dismissInstall').addEventListener('click', () => {
  document.getElementById('installBanner').classList.remove('visible');
});
window.addEventListener('appinstalled', () => {
  document.getElementById('installBanner').classList.remove('visible');
  setStatus('FitTracker yüklendi ✓', 'ok');
});

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] Kayıtlı:', reg.scope);
      })
      .catch(err => {
        console.warn('[SW] Kayıt hatası:', err);
      });
  });
}

// ── INIT ──
stateLoad();
renderAll();
updateOnlineStatus();
setStatus('Hazır', 'ok');

// Expose for inline handlers
window.goPanel     = goPanel;
window.deleteWeight = deleteWeight;
