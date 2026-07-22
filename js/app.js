import { loadState, saveState } from './storage.js';
import { pickTechnique } from './techniques.js';
import { MILESTONES, getStreakDays } from './achievements.js';
import { buildTimeOfDayStats, buildWeekdayStats, buildReasonStats } from './retrospective.js';

const DISPOSABLE_PRICE = 2000;
const DISPOSABLE_DAYS = 14;
const DAILY_RATE = DISPOSABLE_PRICE / DISPOSABLE_DAYS; // ₽/день
const CRAVING_SECONDS = 4 * 60;

const state = loadState();
let cravingSecondsLeft = CRAVING_SECONDS;
let cravingTimerHandle = null;
let currentTechnique = null;
let selectedReason = null;

// ---------- навигация ----------
const tabButtons = document.querySelectorAll('.tab-btn');
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
  document.getElementById(id).classList.add('screen-active');
  tabButtons.forEach(b => b.classList.toggle('tab-active', b.dataset.screen === id));
  if (id === 'screen-achievements') renderAchievements();
  if (id === 'screen-retro') renderRetrospective();
}

// ---------- главный экран: счётчик ----------
function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v) + ' ₽';
}

function tickMain() {
  const elapsedMs = Date.now() - new Date(state.lastUseAt).getTime();
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  document.getElementById('time-days').textContent = days;
  document.getElementById('time-hours').textContent = hours;
  document.getElementById('time-minutes').textContent = minutes;

  const elapsedDays = elapsedMs / 86400000;
  const moneySaved = elapsedDays * DAILY_RATE;
  document.getElementById('money-saved').textContent = formatMoney(moneySaved);
  document.getElementById('disposables-saved').textContent = (moneySaved / DISPOSABLE_PRICE).toFixed(1);

  document.getElementById('cravings-resisted').textContent = state.cravingsResisted;
}

setInterval(tickMain, 1000);
tickMain();

// ---------- достижения ----------
function renderAchievements() {
  const streakDays = getStreakDays(state.lastUseAt);
  const list = document.getElementById('achievements-list');
  list.innerHTML = '';
  for (const m of MILESTONES) {
    const unlocked = streakDays >= m.days;
    const el = document.createElement('div');
    el.className = 'achievement' + (unlocked ? ' unlocked' : '');
    el.innerHTML = `<div class="badge">${unlocked ? '🏆' : '🔒'}</div><div class="label">${m.label}</div>`;
    list.appendChild(el);
  }
}

// ---------- ретроспектива ----------
function renderBarChart(container, rows) {
  const max = Math.max(1, ...rows.map(r => r.count));
  container.innerHTML = '';
  for (const row of rows) {
    const pct = Math.round((row.count / max) * 100);
    const el = document.createElement('div');
    el.className = 'bar-row';
    el.innerHTML = `
      <div class="bar-label">${row.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${row.count === 0 ? 0 : pct}%"></div></div>
      <div class="bar-count">${row.count}</div>`;
    container.appendChild(el);
  }
}

function renderRetrospective() {
  const empty = document.getElementById('retro-empty');
  const content = document.getElementById('retro-content');
  if (state.journal.length === 0) {
    empty.hidden = false;
    content.hidden = true;
    return;
  }
  empty.hidden = true;
  content.hidden = false;
  renderBarChart(document.getElementById('chart-time'), buildTimeOfDayStats(state.journal));
  renderBarChart(document.getElementById('chart-weekday'), buildWeekdayStats(state.journal));
  renderBarChart(document.getElementById('chart-reason'), buildReasonStats(state.journal));
}

// ---------- оверлей тяги ----------
const cravingOverlay = document.getElementById('craving-overlay');
const journalOverlay = document.getElementById('journal-overlay');

document.getElementById('craving-btn').addEventListener('click', openCravingOverlay);
document.getElementById('craving-close').addEventListener('click', closeCravingOverlay);
document.getElementById('technique-shuffle').addEventListener('click', renderTechnique);
document.getElementById('craving-success').addEventListener('click', onCravingSuccess);
document.getElementById('craving-fail').addEventListener('click', onCravingFail);

function openCravingOverlay() {
  cravingSecondsLeft = CRAVING_SECONDS;
  renderTechnique();
  updateCravingTimerDisplay();
  cravingOverlay.hidden = false;
  cravingTimerHandle = setInterval(() => {
    cravingSecondsLeft--;
    updateCravingTimerDisplay();
    if (cravingSecondsLeft <= 0) {
      clearInterval(cravingTimerHandle);
      cravingTimerHandle = null;
    }
  }, 1000);
}

function closeCravingOverlay() {
  cravingOverlay.hidden = true;
  if (cravingTimerHandle) {
    clearInterval(cravingTimerHandle);
    cravingTimerHandle = null;
  }
}

function updateCravingTimerDisplay() {
  const el = document.getElementById('craving-timer');
  const note = document.getElementById('craving-timer-note');
  const secs = Math.max(0, cravingSecondsLeft);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  if (secs <= 0) {
    el.classList.add('done');
    note.textContent = 'обычно к этому моменту тяга уже отпустила';
  } else {
    el.classList.remove('done');
    note.textContent = 'обычно тяга проходит за это время';
  }
}

function renderTechnique() {
  currentTechnique = pickTechnique();
  document.getElementById('technique-category').textContent = currentTechnique.categoryLabel;
  document.getElementById('technique-title').textContent = currentTechnique.title;
  document.getElementById('technique-desc').textContent = currentTechnique.desc;
}

function onCravingSuccess() {
  state.cravingsResisted++;
  saveState(state);
  tickMain();
  closeCravingOverlay();
  showToast('Ты справился! Тяга позади.');
}

function onCravingFail() {
  closeCravingOverlay();
  openJournalOverlay();
}

// ---------- дневник причин ----------
const reasonChips = document.querySelectorAll('#reason-chips .chip');
reasonChips.forEach(chip => {
  chip.addEventListener('click', () => {
    reasonChips.forEach(c => c.classList.remove('chip-selected'));
    chip.classList.add('chip-selected');
    selectedReason = chip.dataset.reason;
  });
});

document.getElementById('journal-save').addEventListener('click', saveJournalEntry);
document.getElementById('journal-skip').addEventListener('click', skipJournalEntry);

function openJournalOverlay() {
  selectedReason = null;
  reasonChips.forEach(c => c.classList.remove('chip-selected'));
  document.getElementById('journal-note').value = '';
  journalOverlay.hidden = false;
}

function closeJournalOverlay() {
  journalOverlay.hidden = true;
}

function registerUseNow(reason, note) {
  const now = new Date().toISOString();
  if (reason || note) {
    state.journal.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      at: now,
      reason: reason || 'other',
      note: note || ''
    });
  }
  state.lastUseAt = now;
  saveState(state);
  tickMain();
}

function saveJournalEntry() {
  const note = document.getElementById('journal-note').value.trim();
  registerUseNow(selectedReason, note);
  closeJournalOverlay();
}

function skipJournalEntry() {
  registerUseNow(null, '');
  closeJournalOverlay();
}

// ---------- тост ----------
let toastTimeout = null;
function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 2200);
}

// ---------- service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
