const STORAGE_KEY = 'quitvape_state_v1';
const IDB_NAME = 'quitvape';
const IDB_STORE = 'state';
const IDB_KEY = 'main';

function defaultState() {
  return {
    lastUseAt: new Date().toISOString(),
    cravingsResisted: 0,
    journal: [] // { id, at: ISOString, reason: 'stress'|'boredom'|'habit'|'company'|'other'|null, note: string }
  };
}

function normalize(parsed) {
  if (!parsed || !parsed.lastUseAt || !Array.isArray(parsed.journal)) {
    throw new Error('malformed');
  }
  if (typeof parsed.cravingsResisted !== 'number') parsed.cravingsResisted = 0;
  return parsed;
}

// ---------- localStorage ----------
function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}

function writeLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* хранилище недоступно — остаётся зеркало в IndexedDB */ }
}

// ---------- IndexedDB (второе, более живучее зеркало) ----------
function openIDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no idb'));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readIDB() {
  try {
    const db = await openIDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        try { resolve(req.result ? normalize(req.result) : null); }
        catch (e) { resolve(null); }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function writeIDB(state) {
  try {
    const db = await openIDB();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(state, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) { /* не критично, есть localStorage */ }
}

// ---------- постоянное хранилище (чтобы iOS не вычищал) ----------
async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist();
    }
  } catch (e) { /* не поддерживается — ничего страшного */ }
}

// ---------- публичное API ----------

// Пишем сразу в оба хранилища.
export function saveState(state) {
  writeLocal(state);
  writeIDB(state);
}

// Асинхронная инициализация: просим постоянное хранилище и восстанавливаем
// данные из живого зеркала, если localStorage вдруг вычистили.
export async function initStorage() {
  await requestPersist();

  const local = readLocal();
  if (local) {
    writeIDB(local); // держим зеркало в актуальном состоянии
    return local;
  }

  // localStorage пуст/вычищен — пробуем восстановить из IndexedDB
  const idb = await readIDB();
  if (idb) {
    writeLocal(idb); // возвращаем данные обратно в localStorage
    return idb;
  }

  const fresh = defaultState();
  saveState(fresh);
  return fresh;
}

// ---------- ручной бэкап ----------
export function exportData(state) {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const parsed = normalize(JSON.parse(json));
  // чистим до известных полей, чтобы не затащить мусор
  return {
    lastUseAt: parsed.lastUseAt,
    cravingsResisted: parsed.cravingsResisted,
    journal: parsed.journal
  };
}
