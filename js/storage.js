const STORAGE_KEY = 'quitvape_state_v1';

function defaultState() {
  return {
    lastUseAt: new Date().toISOString(),
    cravingsResisted: 0,
    journal: [] // { id, at: ISOString, reason: 'stress'|'boredom'|'habit'|'company'|'other'|null, note: string }
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = defaultState();
      saveState(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.lastUseAt || !Array.isArray(parsed.journal)) throw new Error('malformed');
    if (typeof parsed.cravingsResisted !== 'number') parsed.cravingsResisted = 0;
    return parsed;
  } catch (e) {
    const fresh = defaultState();
    saveState(fresh);
    return fresh;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
