// Outils de dates / heures pour le pointage.

export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const pad = (n) => String(n).padStart(2, "0");

export function iso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIso(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Lundi de la semaine contenant `date`. */
export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const wd = (d.getDay() + 6) % 7; // 0 = lundi
  return addDays(d, -wd);
}

/** Même formule que le fichier Excel : D2 = 7*Semaine + DATE(An;1;3) - JOURSEM(DATE(An;1;3)) - 5 */
export function mondayFromPlanning(annee, semaine) {
  const jan3 = new Date(annee, 0, 3);
  const weekday = jan3.getDay() + 1; // JOURSEM Excel : dimanche = 1
  return addDays(jan3, 7 * semaine - weekday - 5);
}

/** Numéro de semaine ISO (pour l'affichage). */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function fmtDate(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export function fmtDateLong(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function weekLabel(mondayIso) {
  const m = parseIso(mondayIso);
  return `Semaine ${isoWeek(m)} · du ${fmtDate(m)} au ${fmtDate(addDays(m, 6))}`;
}

function toMin(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Durée d'un créneau en minutes (gère le passage de minuit). */
export function slotMinutes(slot) {
  if (!slot) return 0;
  const a = toMin(slot.d);
  const b = toMin(slot.f);
  if (a === null || b === null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

// Types d'absence possibles sur une journée (le jour n'est alors pas compté comme travaillé).
export const ABSENCES = {
  CP: { label: "Congés payés", court: "CP", color: "#3d8a9c" },
  MAL: { label: "Maladie", court: "Maladie", color: "#b05cc4" },
  ABS: { label: "Absence", court: "Absent", color: "#e8452c" },
  FER: { label: "Férié", court: "Férié", color: "#7a8a3c" },
};

/** Heures des créneaux saisis, même si le jour est marqué absent (= heures d'absence pour la paie). */
export function dayMinutesRaw(day) {
  if (!day) return 0;
  return slotMinutes(day.m) + slotMinutes(day.s);
}

/** Heures travaillées : 0 si le jour est une absence / un congé. */
export function dayMinutes(day) {
  if (!day || day.abs) return 0;
  return dayMinutesRaw(day);
}

export function weekMinutes(days) {
  return (days || []).reduce((t, d) => t + dayMinutes(d), 0);
}

/** 450 -> "7h30" */
export function fmtH(min) {
  const sign = min < 0 ? "-" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${Math.floor(a / 60)}h${pad(a % 60)}`;
}

/** 450 -> 7.5 (heures décimales, pour la compta) */
export function toDecimal(min) {
  return Math.round((min / 60) * 100) / 100;
}

export function emptyDay() {
  return { m: { d: "", f: "" }, s: { d: "", f: "" }, abs: "" };
}

export function emptyWeek() {
  return Array.from({ length: 7 }, emptyDay);
}

/** Normalise une semaine venant de Firebase (qui supprime les tableaux/valeurs vides). */
export function normWeek(days) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = (days && days[i]) || {};
    return {
      m: { d: d.m?.d || "", f: d.m?.f || "" },
      s: { d: d.s?.d || "", f: d.s?.f || "" },
      abs: d.abs || "",
    };
  });
}

/** Lundis de toutes les semaines qui touchent un mois donné. */
export function mondaysOfMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const res = [];
  for (let m = mondayOf(first); m <= last; m = addDays(m, 7)) res.push(iso(m));
  return res;
}
