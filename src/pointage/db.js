import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, get, set, update, remove, onValue } from "firebase/database";
import { firebaseConfig } from "../firebaseConfig.js";
import { SEED_EMPLOYES, SEED_PLANNING } from "./seed.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const ROOT = "pointage";

// Structure dans Firebase :
// pointage/config            { pinGerant }
// pointage/employes/{id}     { nom, prenom, pin, contrat }
// pointage/planning/{lundi}/{id}   { days: [7 jours {m:{d,f}, s:{d,f}}] }
// pointage/pointages/{lundi}/{id}  { days, minutes, commentaire, signature (PNG), signeLe }

const p = (...parts) => [ROOT, ...parts].join("/");

export function listen(path, cb) {
  return onValue(ref(db, p(path)), (snap) => cb(snap.exists() ? snap.val() : null));
}

export async function read(path) {
  const snap = await get(ref(db, p(path)));
  return snap.exists() ? snap.val() : null;
}

export const write = (path, value) => set(ref(db, p(path)), value);
export const patch = (path, value) => update(ref(db, p(path)), value);
export const del = (path) => remove(ref(db, p(path)));

/** Remplit la base avec le planning Excel de novembre si elle est vide. */
export async function seedIfEmpty() {
  const existing = await read("employes");
  if (existing) return;
  const employes = {};
  SEED_EMPLOYES.forEach(({ id, ...e }) => (employes[id] = e));
  await write("employes", employes);
  await write("planning", SEED_PLANNING);
  const cfg = await read("config");
  if (!cfg) await write("config", { pinGerant: "1234" });
}
