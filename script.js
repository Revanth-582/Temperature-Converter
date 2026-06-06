/* ============================================================
   ThermoLux — Temperature Converter  |  script.js
   Features: conversion engine, stats, history, frequent pairs,
             dark mode, local storage, toast, animations
   ============================================================ */

'use strict';

/* ────────────────────────────────────────────
   1. CONSTANTS & STATE
──────────────────────────────────────────── */
const STORAGE_KEYS = {
  history:  'thermolux_history',
  stats:    'thermolux_stats',
  freq:     'thermolux_freq',
  theme:    'thermolux_theme',
};

const UNIT_LABELS = { C: '°C', F: '°F', K: 'K' };
const UNIT_NAMES  = { C: 'Celsius', F: 'Fahrenheit', K: 'Kelvin' };
const MAX_HISTORY = 50;

// ── Conversion Formulas ──────────────────────
const CONVERSIONS = {
  C: {
    F: (v) => ({ val: (v * 9 / 5) + 32,   formula: `(${v} × 9/5) + 32` }),
    K: (v) => ({ val: v + 273.15,          formula: `${v} + 273.15` }),
    C: (v) => ({ val: v,                   formula: `${v}` }),
  },
  F: {
    C: (v) => ({ val: (v - 32) * 5 / 9,   formula: `(${v} − 32) × 5/9` }),
    K: (v) => ({ val: (v - 32) * 5 / 9 + 273.15, formula: `(${v} − 32) × 5/9 + 273.15` }),
    F: (v) => ({ val: v,                   formula: `${v}` }),
  },
  K: {
    C: (v) => ({ val: v - 273.15,          formula: `${v} − 273.15` }),
    F: (v) => ({ val: (v - 273.15) * 9 / 5 + 32, formula: `(${v} − 273.15) × 9/5 + 32` }),
    K: (v) => ({ val: v,                   formula: `${v}` }),
  },
};

// ── Load persisted data ─────────────────────
let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');
let stats   = JSON.parse(localStorage.getItem(STORAGE_KEYS.stats)   || '{"total":0,"today":0,"todayDate":"","lastTemp":"—","unitCount":{}}');
let freq    = JSON.parse(localStorage.getItem(STORAGE_KEYS.freq)    || '{}');

/* ────────────────────────────────────────────
   2. DOM REFERENCES
──────────────────────────────────────────── */
const $  = (id) => document.getElementById(id);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

const tempInput    = $('tempInput');
const inputError   = $('inputError');
const convertBtn   = $('convertBtn');
const resetBtn     = $('resetBtn');
const swapBtn      = $('swapBtn');
const resultBox    = $('resultBox');
const resultOrig   = $('resultOriginal');
const resultConv   = $('resultConverted');
const resultForm   = $('resultFormula');
const copyBtn      = $('copyBtn');
const themeToggle  = $('themeToggle');
const toggleIcon   = $('toggleIcon');
const clearAllBtn  = $('clearAllBtn');
const historyList  = $('historyList');
const freqList     = $('freqList');

// Stats
const statTotal   = $('statTotal');
const statToday   = $('statToday');
const statFavUnit = $('statFavUnit');
const statLast    = $('statLast');

/* ────────────────────────────────────────────
   3. UNIT SELECTION LOGIC
──────────────────────────────────────────── */
function getSelectedUnit(group) {
  const checked = document.querySelector(`input[name="${group}Unit"]:checked`);
  return checked ? checked.value : (group === 'from' ? 'C' : 'F');
}

function setUnitPillActive(group, val) {
  $$(`[data-group="${group}"]`).forEach(pill => {
    const active = pill.dataset.val === val;
    pill.classList.toggle('active', active);
    pill.querySelector('input').checked = active;
  });
}

// Pill click handler
document.querySelectorAll('.unit-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const group = pill.dataset.group;
    const val   = pill.dataset.val;
    setUnitPillActive(group, val);
  });
});

/* ────────────────────────────────────────────
   4. SWAP UNITS
──────────────────────────────────────────── */
swapBtn.addEventListener('click', () => {
  const from = getSelectedUnit('from');
  const to   = getSelectedUnit('to');
  setUnitPillActive('from', to);
  setUnitPillActive('to',   from);
  swapBtn.style.transform = 'scale(1.1) rotate(180deg)';
  setTimeout(() => { swapBtn.style.transform = ''; }, 300);
  showToast('Units swapped ⇅');
});

/* ────────────────────────────────────────────
   5. RESET
──────────────────────────────────────────── */
resetBtn.addEventListener('click', () => {
  tempInput.value = '';
  clearError();
  resultBox.hidden = true;
  tempInput.focus();
});

function clearError() {
  inputError.textContent = '';
  tempInput.classList.remove('error');
}

/* ────────────────────────────────────────────
   6. CONVERSION ENGINE
──────────────────────────────────────────── */
function doConvert() {
  clearError();

  const raw  = tempInput.value.trim();
  const from = getSelectedUnit('from');
  const to   = getSelectedUnit('to');

  // Validate
  if (raw === '') {
    showError('Please enter a temperature value.');
    return;
  }
  const num = parseFloat(raw);
  if (isNaN(num)) {
    showError('That doesn\'t look like a valid number. Try again!');
    return;
  }
  // Kelvin cannot be negative
  if (from === 'K' && num < 0) {
    showError('Kelvin cannot be negative. Absolute zero is 0 K.');
    return;
  }

  // Animate button
  convertBtn.classList.add('loading', 'ripple');
  setTimeout(() => convertBtn.classList.remove('ripple'), 500);

  // Simulate brief async
  setTimeout(() => {
    convertBtn.classList.remove('loading');

    const { val, formula } = CONVERSIONS[from][to](num);
    const rounded = parseFloat(val.toFixed(4));

    // Show result
    resultOrig.textContent  = `${num}${UNIT_LABELS[from]}`;
    resultConv.textContent  = `${rounded}${UNIT_LABELS[to]}`;
    resultForm.textContent  = `Formula: ${formula} = ${rounded}${UNIT_LABELS[to]}`;
    resultBox.hidden = false;

    // Persist & update
    saveConversion({ from, to, input: num, output: rounded });
    updateStats(from, to, num);
    renderHistory();
    renderFreq();
    renderStats();
  }, 420);
}

function showError(msg) {
  inputError.textContent = msg;
  tempInput.classList.add('error');
  tempInput.focus();
}

/* ────────────────────────────────────────────
   7. DATA PERSISTENCE
──────────────────────────────────────────── */
function saveConversion({ from, to, input, output }) {
  const entry = {
    id:     Date.now(),
    from, to, input, output,
    time:   new Date().toISOString(),
  };

  // History (max 50)
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));

  // Frequency
  const key = `${from}→${to}`;
  freq[key] = (freq[key] || 0) + 1;
  localStorage.setItem(STORAGE_KEYS.freq, JSON.stringify(freq));
}

function updateStats(from, to, input) {
  // Today check
  const today = new Date().toDateString();
  if (stats.todayDate !== today) {
    stats.today     = 0;
    stats.todayDate = today;
  }

  stats.total++;
  stats.today++;
  stats.lastTemp = `${input}${UNIT_LABELS[from]}`;

  // Track unit usage
  if (!stats.unitCount) stats.unitCount = {};
  stats.unitCount[from] = (stats.unitCount[from] || 0) + 1;
  stats.unitCount[to]   = (stats.unitCount[to]   || 0) + 1;

  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
}

/* ────────────────────────────────────────────
   8. RENDER FUNCTIONS
──────────────────────────────────────────── */
function animateCountUp(el, target) {
  const duration = 600;
  const start    = parseInt(el.textContent) || 0;
  const diff     = target - start;
  if (diff === 0) return;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    el.textContent = Math.round(start + diff * ease);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderStats() {
  animateCountUp(statTotal, stats.total);
  animateCountUp(statToday, stats.today);
  statLast.textContent = stats.lastTemp || '—';

  // Most used unit
  const uc = stats.unitCount || {};
  const best = Object.entries(uc).sort((a,b) => b[1]-a[1])[0];
  statFavUnit.textContent = best ? `${UNIT_LABELS[best[0]]}` : '—';
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<p class="empty-msg">Your conversions will appear here.</p>';
    return;
  }
  historyList.innerHTML = history.map(item => {
    const d = new Date(item.time);
    const dateStr = d.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
    return `
      <div class="history-item" data-id="${item.id}">
        <div class="history-info">
          <div class="history-conv">${item.input}${UNIT_LABELS[item.from]} → ${item.output}${UNIT_LABELS[item.to]}</div>
          <div class="history-time">${dateStr} · ${timeStr}</div>
        </div>
        <button class="history-del" data-id="${item.id}" title="Delete entry" aria-label="Delete this history entry">🗑</button>
      </div>`;
  }).join('');

  // Attach delete listeners
  $$('.history-del', historyList).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(parseInt(btn.dataset.id));
    });
  });
}

function renderFreq() {
  const entries = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, 5);
  if (entries.length === 0) {
    freqList.innerHTML = '<p class="empty-msg">No conversions yet. Start converting!</p>';
    return;
  }
  freqList.innerHTML = entries.map(([key, count]) => {
    const [f, t] = key.split('→');
    return `
      <div class="freq-item">
        <span class="freq-pair">${UNIT_LABELS[f]} → ${UNIT_LABELS[t]}</span>
        <span class="freq-count">Used ${count} time${count === 1 ? '' : 's'}</span>
      </div>`;
  }).join('');
}

/* ────────────────────────────────────────────
   9. HISTORY MANAGEMENT
──────────────────────────────────────────── */
function deleteHistoryItem(id) {
  history = history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  renderHistory();
  showToast('Entry deleted 🗑');
}

clearAllBtn.addEventListener('click', () => {
  if (history.length === 0) { showToast('History is already empty!'); return; }
  history = [];
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  renderHistory();
  showToast('History cleared ✓');
});

/* ────────────────────────────────────────────
   10. COPY RESULT
──────────────────────────────────────────── */
copyBtn.addEventListener('click', () => {
  const text = `${resultOrig.textContent} = ${resultConv.textContent}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard 📋');
  }).catch(() => {
    showToast('Could not copy. Try manually!');
  });
});

/* ────────────────────────────────────────────
   11. DARK MODE
──────────────────────────────────────────── */
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  toggleIcon.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem(STORAGE_KEYS.theme, dark ? 'dark' : 'light');
}

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
});

// Apply saved theme
const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
if (savedTheme === 'dark') applyTheme(true);

/* ────────────────────────────────────────────
   12. TOAST
──────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ────────────────────────────────────────────
   13. EVENT LISTENERS
──────────────────────────────────────────── */
convertBtn.addEventListener('click', doConvert);

// Keyboard: Enter to convert
tempInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doConvert();
});

// Clear error on typing
tempInput.addEventListener('input', () => {
  if (inputError.textContent) clearError();
});

/* ────────────────────────────────────────────
   14. INIT
──────────────────────────────────────────── */
(function init() {
  // Reset today's count if new day
  const today = new Date().toDateString();
  if (stats.todayDate !== today) {
    stats.today     = 0;
    stats.todayDate = today;
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  }

  renderStats();
  renderHistory();
  renderFreq();

  // Focus input
  setTimeout(() => tempInput.focus(), 300);
})();
