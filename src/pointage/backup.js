// Sauvegarde automatique sur la mémoire du téléphone (APK uniquement).
// Dossier : Documents/ODelices-Pointage/ (visible dans l'appli « Fichiers » du téléphone)
//  - sauvegarde-AAAA-MM-JJ.json : copie complète (salariés, plannings, pointages, signatures) — 60 dernières gardées
//  - derniere-sauvegarde.json   : toujours la plus récente
//  - Pointage_<Mois>_<Année>.xlsx : export comptable du mois en cours et du mois précédent, tenu à jour
import { Capacitor } from "@capacitor/core";
import { readAll, writeAll } from "./db.js";
import { iso, mondaysOfMonth } from "./time.js";
import { buildMonth, excelBlob, excelName, saveFile } from "./exports.js";

export const FOLDER = "ODelices-Pointage";
const KEEP = 60;
const LS_KEY = "pt_backup_status";

export const isNative = () => Capacitor.isNativePlatform();

export function getStatus() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
}
function setStatus(st) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch { /* stockage indisponible */ }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function snapshot(data) {
  return JSON.stringify({ app: "odelices-pointage", version: 1, date: new Date().toISOString(), data });
}

/**
 * Sauvegarde sur le téléphone. Sans `force`, ne refait pas de sauvegarde si la dernière a moins de 3 h.
 * Ne fait rien dans un navigateur (pas d'accès à la mémoire du téléphone).
 */
let running = null;
export function autoBackup({ force = false } = {}) {
  if (!isNative()) return Promise.resolve(null);
  const st = getStatus();
  if (!force && st?.ok && Date.now() - new Date(st.date).getTime() < 3 * 3600 * 1000) return Promise.resolve(st);
  if (running) return running;
  running = doBackup().finally(() => (running = null));
  return running;
}

async function doBackup() {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  try {
    try {
      const perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== "granted") await Filesystem.requestPermissions();
    } catch { /* Android récent : pas de permission nécessaire */ }

    const data = (await readAll()) || {};
    const json = snapshot(data);
    const today = iso(new Date());
    const opts = { directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true };
    await Filesystem.writeFile({ path: `${FOLDER}/sauvegarde-${today}.json`, data: json, ...opts });
    await Filesystem.writeFile({ path: `${FOLDER}/derniere-sauvegarde.json`, data: json, ...opts });

    // Excel du mois en cours + du mois précédent
    const now = new Date();
    for (const d of [new Date(now.getFullYear(), now.getMonth() - 1, 1), now]) {
      const year = d.getFullYear();
      const month = d.getMonth();
      const planning = {};
      const pointages = {};
      mondaysOfMonth(year, month).forEach((w) => {
        planning[w] = data.planning?.[w] || null;
        pointages[w] = data.pointages?.[w] || null;
      });
      const m = buildMonth({ year, month, employes: data.employes || {}, planning, pointages, signatures: data.signatures?.[`${year}-${String(month + 1).padStart(2, "0")}`], config: data.config });
      const b64 = await blobToBase64(excelBlob(m, { year, month }));
      await Filesystem.writeFile({ path: `${FOLDER}/${excelName({ year, month })}`, data: b64, directory: Directory.Documents, recursive: true });
    }

    // Ne garder que les KEEP sauvegardes journalières les plus récentes
    try {
      const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Documents });
      const olds = files.map((f) => f.name || f).filter((n) => /^sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse().slice(KEEP);
      for (const n of olds) await Filesystem.deleteFile({ path: `${FOLDER}/${n}`, directory: Directory.Documents });
    } catch { /* pas grave */ }

    const st = { ok: true, date: new Date().toISOString(), where: `Documents/${FOLDER}` };
    setStatus(st);
    return st;
  } catch (e) {
    const st = { ok: false, date: new Date().toISOString(), error: e?.message || String(e) };
    setStatus(st);
    return st;
  }
}

/** Sauvegarde manuelle : partage (téléphone) ou téléchargement (navigateur) du fichier complet. */
export async function downloadBackup() {
  const data = (await readAll()) || {};
  const blob = new Blob([snapshot(data)], { type: "application/json" });
  await saveFile(blob, `sauvegarde-pointage-${iso(new Date())}.json`);
}

/** Restaure un fichier de sauvegarde (remplace tout le contenu actuel). */
export async function restoreBackup(file) {
  const txt = await file.text();
  const obj = JSON.parse(txt);
  if (obj?.app !== "odelices-pointage" || !obj.data) throw new Error("Ce fichier n'est pas une sauvegarde de l'appli Pointage.");
  await writeAll(obj.data);
  return obj.date;
}
