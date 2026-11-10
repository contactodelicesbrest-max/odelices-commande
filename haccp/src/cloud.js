// Sauvegarde automatique dans le cloud (Firebase Realtime Database du projet O'Délices).
// Chaque modification est envoyée quelques secondes après ; si le téléphone est hors
// connexion, l'envoi est refait automatiquement dès que le réseau revient.
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, update, get } from "firebase/database";
import { firebaseConfig } from "../../src/firebaseConfig.js";
import * as db from "./db.js";

const ROOT = "haccp_v1";
const META_ID = "cloud"; // métadonnées de synchro, stockées dans le store "settings"
const BATCH_BYTES = 4_000_000;

let fdb = null;
function database() {
  if (!fdb) {
    const app = getApps().find((a) => a.name === "haccp") || initializeApp(firebaseConfig, "haccp");
    fdb = getDatabase(app);
  }
  return fdb;
}

// ---------- État (affiché dans l'appli) ----------
let status = { state: "idle", lastOk: null, error: null, pending: 0 };
const listeners = new Set();
function setStatus(patch) {
  status = { ...status, ...patch };
  listeners.forEach((cb) => cb(status));
}
export function onCloudStatus(cb) {
  listeners.add(cb);
  cb(status);
  return () => listeners.delete(cb);
}

async function getMeta() {
  return (await db.getOne("settings", META_ID)) || { id: META_ID, lastSync: "", pendingDeletes: [] };
}
const saveMeta = (m) => db.put("settings", m);

// Les suppressions sont mémorisées pour être répercutées dans le cloud.
export async function markDeleted(store, id) {
  const m = await getMeta();
  m.pendingDeletes = [...(m.pendingDeletes || []), `${store}/${id}`];
  await saveMeta(m);
  scheduleSync();
}

const clean = (o) => JSON.parse(JSON.stringify(o)); // retire les "undefined" refusés par Firebase

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

let running = null;
let again = false;

export function syncNow() {
  if (running) {
    again = true;
    return running;
  }
  running = doSync()
    .catch((e) => {
      const msg = String(e?.message || e);
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setStatus({
        state: offline || msg === "timeout" ? "offline" : "error",
        error: /permission/i.test(msg)
          ? "Accès refusé par Firebase : vérifie les « Règles » de la Realtime Database (voir README)."
          : offline || msg === "timeout"
          ? "Pas de connexion — envoi dès que le réseau revient."
          : msg,
      });
    })
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        scheduleSync(1000);
      }
    });
  return running;
}

async function doSync() {
  const meta = await getMeta();
  const since = meta.lastSync || "";
  const startedAt = new Date().toISOString();
  const updates = [];
  for (const store of db.STORES) {
    const list = await db.getAll(store);
    for (const rec of list) {
      if (store === "settings" && rec.id === META_ID) continue;
      const stamp = rec.updatedAt || rec.createdAt || "";
      if (!since || stamp >= since) updates.push([`${ROOT}/${store}/${rec.id}`, clean(rec)]);
    }
  }
  const deletes = meta.pendingDeletes || [];
  for (const d of deletes) updates.push([`${ROOT}/${d}`, null]);

  setStatus({ pending: updates.length });
  if (updates.length) {
    setStatus({ state: "syncing", error: null });
    // Envoi par paquets (les photos peuvent être lourdes)
    let batch = {};
    let size = 0;
    const flush = async () => {
      if (!Object.keys(batch).length) return;
      await withTimeout(update(ref(database()), batch), 60000);
      batch = {};
      size = 0;
    };
    for (const [path, val] of updates) {
      batch[path] = val;
      size += val ? JSON.stringify(val).length : 10;
      if (size > BATCH_BYTES) await flush();
    }
    await flush();
  }
  const fresh = await getMeta(); // des suppressions ont pu arriver pendant l'envoi
  fresh.pendingDeletes = (fresh.pendingDeletes || []).filter((d) => !deletes.includes(d));
  fresh.lastSync = startedAt;
  fresh.lastOk = new Date().toISOString();
  await saveMeta(fresh);
  setStatus({ state: "ok", lastOk: fresh.lastOk, error: null, pending: 0 });
}

let timer = null;
export function scheduleSync(delay = 4000) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

let started = false;
export async function initCloud() {
  if (started) return;
  started = true;
  const meta = await getMeta();
  setStatus({ lastOk: meta.lastOk || null });
  syncNow();
  setInterval(syncNow, 5 * 60 * 1000);
  window.addEventListener("online", () => scheduleSync(1000));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && scheduleSync(1000));
}

// Récupère toutes les données du cloud (nouveau téléphone, réinstallation…).
// Fusion : pour chaque enregistrement, la version la plus récente est gardée.
export async function restoreFromCloud() {
  const snap = await withTimeout(get(ref(database(), ROOT)), 120000);
  const all = snap.exists() ? snap.val() : {};
  let count = 0;
  for (const store of db.STORES) {
    const remote = Object.values(all[store] || {});
    if (!remote.length) continue;
    const local = new Map((await db.getAll(store)).map((r) => [r.id, r]));
    const toWrite = remote.filter((r) => {
      if (store === "settings" && r.id === META_ID) return false;
      const l = local.get(r.id);
      return !l || (r.updatedAt || r.createdAt || "") > (l.updatedAt || l.createdAt || "");
    });
    if (toWrite.length) await db.putMany(store, toWrite);
    count += toWrite.length;
  }
  return count;
}
