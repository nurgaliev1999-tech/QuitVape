import { initStorage, saveState, exportData, importData } from './storage.js';
import { pickTechnique } from './techniques.js';
import { MILESTONES, getStreakDays } from './achievements.js';
import { buildTimeOfDayStats, buildWeekdayStats } from './retrospective.js';

const DISPOSABLE_PRICE = 2000;
const DISPOSABLE_DAYS = 14;
const DAILY_RATE = DISPOSABLE_PRICE / DISPOSABLE_DAYS; // ₽/день
const CRAVING_SECONDS = 4 * 60;

const state = await initStorage();
let cravingSecondsLeft = CRAVING_SECONDS;
let cravingTimerHandle = null;
let currentTechnique = null;
let selectedReason = null;
let resetSnapshot = null; // { prevLastUseAt, addedEntryId } — для отмены сброса

// ---------- навигация ----------
const tabButtons = document.querySelectorAll('.tab');
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

// ---------- форматирование ----------
function formatMoney(v) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v) + ' ₽';
}

function formatDateTimeLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ---------- главный экран: счётчик ----------
function tickMain() {
  const elapsedMs = Date.now() - new Date(state.lastUseAt).getTime();
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  document.getElementById('time-days').textContent = days;
  document.getElementById('time-hours').textContent = hours;
  document.getElementById('time-minutes').textContent = minutes;

  const elapsedDays = Math.max(0, elapsedMs / 86400000);
  const moneySaved = elapsedDays * DAILY_RATE;
  document.getElementById('money-saved').textContent = formatMoney(moneySaved);
  document.getElementById('disposables-saved').textContent = (moneySaved / DISPOSABLE_PRICE).toFixed(1);

  document.getElementById('cravings-resisted').textContent = state.cravingsResisted;
  document.getElementById('start-current').textContent = formatDateTimeLabel(state.lastUseAt);

  updateHeroProgress(elapsedDays);
}

setInterval(tickMain, 1000);
tickMain();

// ---------- прогресс-кольцо и подпись на главном экране ----------
function nextMilestone(streakDays) {
  return MILESTONES.find(m => streakDays < m.days) || null;
}

function updateHeroProgress(streakDays) {
  const ring = document.getElementById('progress-ring');
  const caption = document.getElementById('hero-caption');
  const next = nextMilestone(streakDays);

  let pct;
  if (!next) {
    pct = 100;
    caption.textContent = 'Все вехи открыты — рекорд продолжается';
  } else {
    const prev = [...MILESTONES].reverse().find(m => streakDays >= m.days);
    const floor = prev ? prev.days : 0;
    pct = Math.round(((streakDays - floor) / (next.days - floor)) * 100);
    const remaining = Math.max(0, Math.ceil(next.days - streakDays));
    caption.textContent = remaining <= 1
      ? `Следующая веха «${next.label}» — меньше дня`
      : `Следующая веха «${next.label}» — ещё ${remaining} дн.`;
  }
  ring.style.background = `conic-gradient(var(--green) 0 ${pct}%, var(--green-soft) 0 100%)`;
}

// ---------- достижения ----------
const LOCK_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const MEDAL_ICON = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="m9 13-1.5 7L12 18l4.5 2L15 13"/></svg>';

function renderAchievements() {
  const streakDays = getStreakDays(state.lastUseAt);
  const lastUseMs = new Date(state.lastUseAt).getTime();

  const list = document.getElementById('achievements-list');
  list.innerHTML = '';
  let unlockedCount = 0;

  for (const m of MILESTONES) {
    const unlocked = streakDays >= m.days;
    if (unlocked) unlockedCount++;
    const el = document.createElement('div');
    el.className = 'achievement ' + (unlocked ? 'unlocked' : 'locked');
    let when;
    if (unlocked) {
      const unlockDate = new Date(lastUseMs + m.days * 86400000);
      when = unlockDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    } else {
      const remaining = Math.max(1, Math.ceil(m.days - streakDays));
      when = `ещё ${remaining} дн.`;
    }
    el.innerHTML = `<div class="medal">${unlocked ? MEDAL_ICON : LOCK_ICON}</div><div class="label">${m.label}</div><div class="when">${when}</div>`;
    list.appendChild(el);
  }

  document.getElementById('ach-subtitle').textContent = `${unlockedCount} из ${MILESTONES.length} открыто`;

  const next = nextMilestone(streakDays);
  if (!next) {
    document.getElementById('progress-next-label').textContent = 'Все вехи открыты';
    document.getElementById('progress-next-sub').textContent = '';
    document.getElementById('progress-next-fill').style.width = '100%';
  } else {
    const prev = [...MILESTONES].reverse().find(m => streakDays >= m.days);
    const floor = prev ? prev.days : 0;
    const pct = Math.round(((streakDays - floor) / (next.days - floor)) * 100);
    const remaining = Math.max(1, Math.ceil(next.days - streakDays));
    document.getElementById('progress-next-label').textContent = `Следующая веха «${next.label}»`;
    document.getElementById('progress-next-sub').textContent = `осталось ${remaining} дн.`;
    document.getElementById('progress-next-fill').style.width = pct + '%';
  }
}

// ---------- ретроспектива ----------
function renderBarChart(container, rows) {
  const max = Math.max(1, ...rows.map(r => r.count));
  const peakCount = Math.max(...rows.map(r => r.count));
  container.innerHTML = '';
  for (const row of rows) {
    const pct = Math.round((row.count / max) * 100);
    const isPeak = row.count > 0 && row.count === peakCount;
    const el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = `
      <div class="lbl">${row.label}</div>
      <div class="track"><div class="fill${isPeak ? ' peak' : ''}" style="width:${row.count === 0 ? 0 : pct}%"></div></div>
      <div class="cnt">${row.count}</div>`;
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

  const totalCravings = state.cravingsResisted + state.journal.length;
  document.getElementById('retro-kpi-resisted').textContent = `${state.cravingsResisted} из ${totalCravings}`;

  const timeStats = buildTimeOfDayStats(state.journal);
  const peakBucket = timeStats.reduce((a, b) => (b.count > a.count ? b : a), timeStats[0]);
  document.getElementById('retro-kpi-peak').textContent = peakBucket.count > 0 ? peakBucket.label.split(' ')[0] : '—';

  renderBarChart(document.getElementById('chart-time'), timeStats);
  renderBarChart(document.getElementById('chart-weekday'), buildWeekdayStats(state.journal));
}

// ---------- оверлей тяги ----------
const cravingOverlay = document.getElementById('craving-overlay');
const journalOverlay = document.getElementById('journal-overlay');
const startOverlay = document.getElementById('start-overlay');

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
document.getElementById('journal-close').addEventListener('click', cancelJournalOverlay);

function openJournalOverlay() {
  selectedReason = null;
  reasonChips.forEach(c => c.classList.remove('chip-selected'));
  document.getElementById('journal-note').value = '';
  journalOverlay.hidden = false;
}

function closeJournalOverlay() {
  journalOverlay.hidden = true;
}

// Закрытие крестиком = отмена, БЕЗ сброса счётчика (защита от случайного нажатия).
function cancelJournalOverlay() {
  closeJournalOverlay();
}

function registerUseNow(reason, note) {
  const now = new Date().toISOString();
  const prevLastUseAt = state.lastUseAt;
  let addedEntryId = null;
  if (reason || note) {
    addedEntryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    state.journal.push({
      id: addedEntryId,
      at: now,
      reason: reason || 'other',
      note: note || ''
    });
  }
  state.lastUseAt = now;
  saveState(state);
  tickMain();
  resetSnapshot = { prevLastUseAt, addedEntryId };
  showToast('Счётчик сброшен', 'Отменить', undoReset);
}

function undoReset() {
  if (!resetSnapshot) return;
  state.lastUseAt = resetSnapshot.prevLastUseAt;
  if (resetSnapshot.addedEntryId) {
    state.journal = state.journal.filter(e => e.id !== resetSnapshot.addedEntryId);
  }
  resetSnapshot = null;
  saveState(state);
  tickMain();
  showToast('Отменено, счётчик восстановлен');
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

// ---------- точка отсчёта ----------
document.getElementById('edit-start-btn').addEventListener('click', openStartOverlay);
document.getElementById('start-close').addEventListener('click', closeStartOverlay);
document.getElementById('start-cancel').addEventListener('click', closeStartOverlay);
document.getElementById('start-save').addEventListener('click', saveStartDate);

function isoToLocalInput(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openStartOverlay() {
  document.getElementById('start-input').value = isoToLocalInput(state.lastUseAt);
  document.getElementById('start-error').hidden = true;
  startOverlay.hidden = false;
}

function closeStartOverlay() {
  startOverlay.hidden = true;
}

function saveStartDate() {
  const val = document.getElementById('start-input').value;
  if (!val) { closeStartOverlay(); return; }
  const picked = new Date(val);
  if (isNaN(picked.getTime())) { closeStartOverlay(); return; }
  if (picked.getTime() > Date.now()) {
    document.getElementById('start-error').hidden = false;
    return;
  }
  state.lastUseAt = picked.toISOString();
  saveState(state);
  tickMain();
  closeStartOverlay();
  showToast('Точка отсчёта обновлена');
}

// ---------- бэкап ----------
document.getElementById('export-btn').addEventListener('click', doExport);
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});
document.getElementById('import-file').addEventListener('change', doImport);

function doExport() {
  const json = exportData(state);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `quitvape-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Копия сохранена в файл');
}

function doImport(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = importData(String(reader.result));
      state.lastUseAt = imported.lastUseAt;
      state.cravingsResisted = imported.cravingsResisted;
      state.journal = imported.journal;
      saveState(state);
      tickMain();
      showToast('Данные восстановлены из файла');
    } catch (e) {
      showToast('Не удалось прочитать файл');
    }
  };
  reader.onerror = () => showToast('Не удалось прочитать файл');
  reader.readAsText(file);
}

// ---------- статус защиты хранилища ----------
async function updateBackupStatus() {
  const el = document.getElementById('backup-status');
  let persisted = false;
  try {
    if (navigator.storage && navigator.storage.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch (e) { /* нет поддержки */ }
  if (persisted) {
    el.textContent = 'Постоянное хранилище включено, данные дублируются на телефоне. Файл-копию делай изредка на случай смены телефона.';
  } else {
    el.textContent = 'Данные дублируются на телефоне (два хранилища). Постоянное хранилище не подтверждено — раз в пару недель делай копию в файл.';
  }
}
updateBackupStatus();

// ---------- тост ----------
let toastTimeout = null;
function showToast(text, actionLabel, actionFn) {
  const toast = document.getElementById('toast');
  const textEl = document.getElementById('toast-text');
  const actionEl = document.getElementById('toast-action');
  textEl.textContent = text;

  if (actionLabel && actionFn) {
    actionEl.textContent = actionLabel;
    actionEl.hidden = false;
    actionEl.onclick = () => {
      actionEl.hidden = true;
      toast.hidden = true;
      clearTimeout(toastTimeout);
      actionFn();
    };
  } else {
    actionEl.hidden = true;
    actionEl.onclick = null;
  }

  toast.hidden = false;
  clearTimeout(toastTimeout);
  const duration = actionLabel ? 6000 : 2200;
  toastTimeout = setTimeout(() => { toast.hidden = true; }, duration);
}

// ---------- service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
