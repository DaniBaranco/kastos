// db.js — Capa de persistencia con IndexedDB.
// Usa la API nativa sin dependencias externas.
// Almacena: transacciones, categorías, metas y ajustes de usuario.

const DB_NAME    = 'kastos-db';
const DB_VERSION = 1;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        txStore.createIndex('date', 'date');
        txStore.createIndex('type', 'type');
        txStore.createIndex('categoryId', 'categoryId');
      }

      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
  });
}

function withStore(storeName, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req   = fn(store);
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror    = () => reject(tx.error);
  }));
}

// ── Transacciones ──────────────────────────────────────────────

export function addTransaction(data) {
  return withStore('transactions', 'readwrite', (s) => s.add(data));
}

export function updateTransaction(data) {
  return withStore('transactions', 'readwrite', (s) => s.put(data));
}

export function deleteTransaction(id) {
  return withStore('transactions', 'readwrite', (s) => s.delete(id));
}

export function getAllTransactions() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx    = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

// ── Categorías ────────────────────────────────────────────────

export function addCategory(data) {
  return withStore('categories', 'readwrite', (s) => s.add(data));
}

export function updateCategory(data) {
  return withStore('categories', 'readwrite', (s) => s.put(data));
}

export function deleteCategory(id) {
  return withStore('categories', 'readwrite', (s) => s.delete(id));
}

export function getAllCategories() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx    = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

// ── Metas ─────────────────────────────────────────────────────

export function addGoal(data) {
  return withStore('goals', 'readwrite', (s) => s.add(data));
}

export function updateGoal(data) {
  return withStore('goals', 'readwrite', (s) => s.put(data));
}

export function deleteGoal(id) {
  return withStore('goals', 'readwrite', (s) => s.delete(id));
}

export function getAllGoals() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx    = db.transaction('goals', 'readonly');
    const store = tx.objectStore('goals');
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

// ── Ajustes ───────────────────────────────────────────────────

export function getSetting(key) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx    = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req   = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

export function setSetting(key, value) {
  return withStore('settings', 'readwrite', (s) => s.put(value, key));
}

// ── Reset total ───────────────────────────────────────────────

export async function resetAllData() {
  await withStore('transactions', 'readwrite', (s) => s.clear());
  await withStore('categories',   'readwrite', (s) => s.clear());
  await withStore('goals',        'readwrite', (s) => s.clear());
  await withStore('settings',     'readwrite', (s) => s.clear());
}

// ── Exportar / Importar ───────────────────────────────────────

export async function exportAllData() {
  const [transactions, categories, goals] = await Promise.all([
    getAllTransactions(),
    getAllCategories(),
    getAllGoals(),
  ]);
  const currency = await getSetting('currency') || 'EUR';
  const userName = await getSetting('userName') || '';
  return { transactions, categories, goals, settings: { currency, userName }, exportedAt: new Date().toISOString() };
}

export async function importAllData(data) {
  // Limpia y vuelca los datos importados preservando IDs originales.
  await withStore('transactions', 'readwrite', (s) => s.clear());
  await withStore('categories',   'readwrite', (s) => s.clear());
  await withStore('goals',        'readwrite', (s) => s.clear());

  const db = await openDB();

  await new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    (data.transactions || []).forEach((t) => tx.objectStore('transactions').put(t));
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });

  await new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    (data.categories || []).forEach((c) => tx.objectStore('categories').put(c));
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });

  await new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    (data.goals || []).forEach((g) => tx.objectStore('goals').put(g));
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });

  if (data.settings) {
    await setSetting('currency', data.settings.currency || 'EUR');
    await setSetting('userName', data.settings.userName || '');
  }
}
