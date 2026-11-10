// Stockage local (IndexedDB) : les données restent sur le téléphone/tablette,
// fonctionnent sans connexion internet, et peuvent être sauvegardées en JSON.

const DB_NAME = "odelices-haccp";
const DB_VERSION = 1;
export const STORES = ["equipments", "temps", "trace", "fryers", "oil", "stock", "moves", "photos", "settings"];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const os = t.objectStore(store);
        let result;
        const r = fn(os);
        if (r) r.onsuccess = () => (result = r.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const getAll = (store) => tx(store, "readonly", (os) => os.getAll()).then((r) => r || []);
export const getOne = (store, id) => tx(store, "readonly", (os) => os.get(id));
export const put = (store, obj) => tx(store, "readwrite", (os) => os.put(obj)).then(() => obj);
export const del = (store, id) => tx(store, "readwrite", (os) => os.delete(id));
export const clearStore = (store) => tx(store, "readwrite", (os) => os.clear());

export function putMany(store, list) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        const os = t.objectStore(store);
        for (const o of list) os.put(o);
        t.oncomplete = () => resolve(list);
        t.onerror = () => reject(t.error);
      })
  );
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------- Sauvegarde / restauration ----------
export async function exportAll() {
  const out = { app: "odelices-haccp", version: 1, exportedAt: new Date().toISOString(), data: {} };
  for (const s of STORES) out.data[s] = await getAll(s);
  return out;
}

export async function importAll(json, { replace = true } = {}) {
  if (!json || json.app !== "odelices-haccp" || !json.data) throw new Error("Fichier de sauvegarde invalide.");
  for (const s of STORES) {
    const list = json.data[s];
    if (!Array.isArray(list)) continue;
    if (replace) await clearStore(s);
    await putMany(s, list);
  }
}

// ---------- Données de départ ----------
export const EQUIP_TYPES = {
  frigo: { label: "Réfrigérateur", min: 0, max: 4 },
  congel: { label: "Congélateur", min: -30, max: -18 },
  chambre: { label: "Chambre froide", min: 0, max: 3 },
  vitrine: { label: "Vitrine réfrigérée", min: 0, max: 4 },
  saladette: { label: "Saladette / Tour réfrigéré", min: 0, max: 4 },
};

let seedPromise = null;
export function seedIfEmpty() {
  if (!seedPromise) seedPromise = doSeed();
  return seedPromise;
}

async function doSeed() {
  const eq = await getAll("equipments");
  const settings = await getOne("settings", "main");
  if (!settings) {
    await put("settings", {
      id: "main",
      shopName: "O'Délices",
      operator: "",
      oilMaxDays: 7,
      oilTpmMax: 25,
      seeded: true,
    });
    if (eq.length === 0) {
      const now = new Date().toISOString();
      await putMany("equipments", [
        { id: uid(), name: "Frigo 1", type: "frigo", min: 0, max: 4, order: 1, createdAt: now },
        { id: uid(), name: "Frigo 2", type: "frigo", min: 0, max: 4, order: 2, createdAt: now },
        { id: uid(), name: "Congélateur 1", type: "congel", min: -30, max: -18, order: 3, createdAt: now },
      ]);
      await putMany("fryers", [{ id: uid(), name: "Friteuse 1", capacity: 10, order: 1, createdAt: now }]);
    }
  }
}
