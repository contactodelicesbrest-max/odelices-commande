// Impression des étiquettes DLC sur l'imprimante Bluetooth du restaurant
// (imprimante ticket thermique 58/80 mm, langage ESC/POS — ex. imprimante Uber Eats).
import { Capacitor, registerPlugin } from "@capacitor/core";
import { dayKey, daysUntil, fmtDate, fmtNum, fmtTime, momentOfDay, todayKey } from "./utils.js";

const BtPrinter = registerPlugin("BtPrinter");

export const isPrintAvailable = () => Capacitor.isNativePlatform();

export async function listPrinters() {
  if (!isPrintAvailable()) throw new Error("L'impression Bluetooth fonctionne seulement dans l'appli Android (APK).");
  const { devices } = await BtPrinter.listPaired();
  return devices || [];
}

// ---------- Encodage du texte ----------
// Les imprimantes ticket n'ont pas toutes la même table de caractères : on propose
// plusieurs réglages, et l'impression « Test des accents » permet de choisir le bon.
const CP850 = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "ç": 0x87, "ê": 0x88, "ë": 0x89,
  "è": 0x8a, "ï": 0x8b, "î": 0x8c, "Ä": 0x8e, "É": 0x90, "ô": 0x93, "ö": 0x94, "û": 0x96, "ù": 0x97,
  "Ö": 0x99, "Ü": 0x9c, "À": 0xb7, "Â": 0xb6, "Ê": 0xd2, "Ë": 0xd3, "È": 0xd4, "Î": 0xd7, "Ï": 0xd8,
  "Ô": 0xe2, "Ù": 0xeb, "Û": 0xea, "°": 0xf8,
};
const CP437 = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "ç": 0x87, "ê": 0x88, "ë": 0x89,
  "è": 0x8a, "ï": 0x8b, "î": 0x8c, "Ä": 0x8e, "É": 0x90, "ô": 0x93, "ö": 0x94, "û": 0x96, "ù": 0x97,
  "Ö": 0x99, "Ü": 0x9a, "°": 0xf8,
};
const LATIN1 = "latin1"; // Windows-1252 / ISO-8859 : le code du caractère = l'octet

export const CHARSETS = {
  pc850: { label: "1", name: "PC850", cmd: 2, map: CP850 },
  pc437: { label: "2", name: "PC437", cmd: 0, map: CP437 },
  wpc1252: { label: "3", name: "Windows 1252", cmd: 16, map: LATIN1 },
  pc858: { label: "4", name: "PC858", cmd: 19, map: CP850 },
  iso88591: { label: "5", name: "ISO 8859-1", cmd: 23, map: LATIN1 },
  ascii: { label: "Sans accents", name: "Sans accents", cmd: null, map: null },
};
export const charsetOf = (settings) =>
  settings.printerCharset && CHARSETS[settings.printerCharset]
    ? settings.printerCharset
    : settings.printerAccents === false
    ? "ascii"
    : "pc850";

const SUBST = { "œ": "oe", "Œ": "OE", "’": "'", "«": '"', "»": '"', "—": "-", "–": "-", "…": "...", "€": "EUR", "→": "->" };

function encode(text, charset) {
  const map = CHARSETS[charset]?.map;
  const out = [];
  for (const ch0 of String(text)) {
    const ch = SUBST[ch0] ?? ch0;
    for (const c of ch) {
      const code = c.charCodeAt(0);
      if (code < 0x80) out.push(code);
      else if (map === LATIN1 && code >= 0xa0 && code <= 0xff) out.push(code);
      else if (map && map !== LATIN1 && map[c] !== undefined) out.push(map[c]);
      else if (c === "°") out.push(0x2a); // "*" à défaut de signe degré
      else {
        const plain = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const p of plain) out.push(p.charCodeAt(0) < 0x80 ? p.charCodeAt(0) : 0x3f);
      }
    }
  }
  return out;
}

// ---------- Construction ESC/POS ----------
const ESC = 0x1b, GS = 0x1d, FS = 0x1c;
class Escpos {
  constructor({ charset = "pc850" } = {}) {
    this.b = [ESC, 0x40]; // initialisation
    this.preview = [""]; // aperçu texte (affiché à l'écran)
    this.setCharset(charset);
  }
  setCharset(charset) {
    this.charset = charset;
    // Désactive le mode caractères chinois (sinon les accents sont « mangés »)
    this.b.push(FS, 0x2e);
    const cmd = CHARSETS[charset]?.cmd;
    if (cmd !== null && cmd !== undefined) this.b.push(ESC, 0x74, cmd);
    return this;
  }
  align(a) { this.b.push(ESC, 0x61, { left: 0, center: 1, right: 2 }[a]); return this; }
  bold(on) { this.b.push(ESC, 0x45, on ? 1 : 0); return this; }
  size(w, h) { this.b.push(GS, 0x21, ((w - 1) << 4) | (h - 1)); return this; }
  text(t) {
    this.b.push(...encode(t, this.charset));
    this.preview[this.preview.length - 1] += t;
    return this;
  }
  line(t = "") { return this.text(t).nl(); }
  nl(n = 1) {
    for (let i = 0; i < n; i++) {
      this.b.push(0x0a);
      this.preview.push("");
    }
    return this;
  }
  rule(width) { return this.line("-".repeat(width)); }
  cut() {
    this.b.push(GS, 0x56, 66, 0);
    this.preview.push("✂ - - - - - - - - - - - - -", "");
    return this;
  } // coupe partielle (ignoré sans massicot)
  bytes() { return new Uint8Array(this.b); }
}

const KIND_TITLE = { open: "OUVERT LE", homemade: "FABRIQUE LE", thawed: "DECONGELE LE" };

// Une étiquette DLC (produit de la traçabilité)
export function buildLabel(t, settings, escpos) {
  const width = Number(settings.printerWidth) === 80 ? 48 : 32;
  const p = escpos;
  const dlc = [t.dlcType === "DDM" ? null : t.dlc, t.dlcAfter].filter(Boolean).sort()[0];
  p.align("center").bold(true).line((settings.shopName || "O'Délices").toUpperCase()).bold(false);
  p.rule(width);
  // Nom du produit en grand (2x), coupé proprement si trop long
  p.size(2, 2).bold(true);
  const maxBig = Math.floor(width / 2);
  for (const part of wrap(t.product || "", maxBig)) p.line(part);
  p.size(1, 1).bold(false);
  p.rule(width).align("left");
  p.line(`${(KIND_TITLE[t.kind || "open"] || "LE").padEnd(13)}: ${fmtDate(t.at)} ${fmtTime(t.at)}`);
  if (t.dlc) p.line(`${(t.dlcType === "DDM" ? "DDM origine" : "DLC origine").padEnd(13)}: ${fmtDate(t.dlc)}`);
  if (t.lot) p.line(`${"Lot".padEnd(13)}: ${t.lot}`);
  if (t.supplier) p.line(`${"Fournisseur".padEnd(13)}: ${t.supplier}`);
  if (t.by) p.line(`${"Par".padEnd(13)}: ${t.by}`);
  p.rule(width).align("center");
  if (dlc) {
    p.line("A CONSOMMER AVANT LE");
    p.size(2, 2).bold(true).line(fmtDate(dlc)).size(1, 1).bold(false);
  } else {
    p.line("Pas de date limite calculée");
  }
  if (t.kind === "thawed") p.line("NE PAS RECONGELER");
  p.nl(3).cut();
  return p;
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w.length > max ? w.slice(0, max) : w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function send(settings, bytes) {
  if (!isPrintAvailable()) throw new Error("L'impression Bluetooth fonctionne seulement dans l'appli Android (APK).");
  if (!settings.printerAddress) throw new Error("Aucune imprimante choisie : va dans Réglages → Imprimante d'étiquettes.");
  await BtPrinter.print({ address: settings.printerAddress, data: toBase64(bytes) });
}

export async function printLabels(traces, settings, copies) {
  const n = Math.max(1, Number(copies ?? settings.printerCopies ?? 1));
  const p = new Escpos({ charset: charsetOf(settings) });
  for (const t of traces) for (let i = 0; i < n; i++) buildLabel(t, settings, p);
  await send(settings, p.bytes());
}

export async function printTest(settings) {
  const width = Number(settings.printerWidth) === 80 ? 48 : 32;
  const p = new Escpos({ charset: charsetOf(settings) });
  p.align("center").bold(true).line("TEST IMPRESSION").bold(false).rule(width);
  p.line("Accents : é è à ç ù ô 4°C");
  p.rule(width).line("1234567890".repeat(5).slice(0, width)).nl(3).cut();
  await send(settings, p.bytes());
}

// Imprime la même ligne avec chaque réglage : choisir le numéro où tout est correct.
export async function printCharsetTest(settings) {
  const width = Number(settings.printerWidth) === 80 ? 48 : 32;
  const p = new Escpos({ charset: "ascii" });
  p.align("center").bold(true).line("TEST DES ACCENTS").bold(false).rule(width).align("left");
  for (const [key, c] of Object.entries(CHARSETS)) {
    if (key === "ascii") continue;
    p.setCharset(key).line(`${c.label}) é è à ç ù ô 4°C`);
  }
  p.setCharset("ascii").rule(width);
  p.line("Choisis dans Reglages le numero");
  p.line("ou tout est correct.");
  p.nl(3).cut();
  await send(settings, p.bytes());
}

// Imprime avec message d'erreur clair (utilisé par les écrans)
export async function printLabelsSafe(traces, settings, copies) {
  try {
    await printLabels(traces, settings, copies);
    return true;
  } catch (e) {
    alert(e?.message || String(e));
    return false;
  }
}

// ---------- Récap du service (matin / soir) ----------
const effDlc = (t) => [t.dlcType === "DDM" ? null : t.dlc, t.dlcAfter].filter(Boolean).sort()[0] || null;

// Produits de la traçabilité enregistrés pendant ce service (aujourd'hui, même moment).
export function serviceTraces(trace, moment = momentOfDay()) {
  return trace.filter((t) => dayKey(t.at) === todayKey() && momentOfDay(t.at) === moment && t.status !== "thrown");
}

export function buildRecap(data, moment, extra = {}) {
  const s = data.settings;
  const width = Number(s.printerWidth) === 80 ? 48 : 32;
  const p = new Escpos({ charset: charsetOf(s) });
  const row = (a, b) => {
    const left = String(a);
    const right = String(b);
    const space = Math.max(1, width - left.length - right.length);
    return left.length + right.length + 1 > width ? `${left.slice(0, width - right.length - 2)}~ ${right}` : left + " ".repeat(space) + right;
  };
  const today = todayKey();
  p.align("center").bold(true).line((s.shopName || "O'Délices").toUpperCase());
  p.size(2, 1).line(`RECAP ${moment.toUpperCase()}`).size(1, 1).bold(false);
  p.line(`${fmtDate(new Date())} ${fmtTime(new Date())}${s.operator ? " - " + s.operator : ""}`);
  p.rule(width).align("left");

  // Températures
  p.bold(true).line("TEMPERATURES").bold(false);
  const eqs = [...data.equipments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const eq of eqs) {
    const r = data.temps
      .filter((t) => t.equipmentId === eq.id && dayKey(t.at) === today)
      .sort((a, b) => b.at.localeCompare(a.at))
      .find((t) => t.moment === moment || t.moment === "Recontrôle");
    const st = r ? r.status || (r.ok ? "ok" : "ko") : null;
    p.line(row(eq.name, r ? `${fmtNum(r.value)}°C ${st === "ok" ? "OK" : st === "warn" ? "TOLERE" : "NON CONF."}` : "A RELEVER"));
  }

  // Huile
  if (extra.fryers?.length) {
    p.rule(width).bold(true).line("HUILE").bold(false);
    for (const f of extra.fryers) p.line(row(f.name, f.text));
  }

  // Produits en cours (frigo) triés par date limite
  const open = data.trace
    .filter((t) => t.status === "open")
    .map((t) => ({ t, d: effDlc(t) }))
    .sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999"));
  const toThrow = open.filter((x) => x.d && daysUntil(x.d) < 0);
  const ok = open.filter((x) => !x.d || daysUntil(x.d) >= 0);
  p.rule(width);
  if (toThrow.length) {
    p.bold(true).line("!! A JETER (DATE DEPASSEE) !!").bold(false);
    for (const { t, d } of toThrow) p.line(row(t.product, fmtDate(d).slice(0, 5)));
    p.rule(width);
  }
  p.bold(true).line("EN COURS - A CONSOMMER AVANT").bold(false);
  if (!ok.length) p.line("(aucun)");
  for (const { t, d } of ok) {
    const n = d ? daysUntil(d) : null;
    p.line(row(t.product, d ? `${fmtDate(d).slice(0, 5)}${n === 0 ? " AUJ." : n === 1 ? " DEMAIN" : ""}` : "-"));
  }

  // Refroidissements en cours
  const running = data.process.filter((r) => r.state === "running");
  if (running.length) {
    p.rule(width).bold(true).line("EN COURS (A TERMINER)").bold(false);
    for (const r of running) p.line(row(r.product, `depuis ${fmtTime(r.startAt)}`));
  }

  // Nettoyage restant
  if (extra.cleanTodo?.length) {
    p.rule(width).bold(true).line("NETTOYAGE A FAIRE").bold(false);
    for (const n of extra.cleanTodo) p.line(`[ ] ${n}`);
  }
  p.rule(width).nl(3).cut();
  return p;
}

export async function printRecap(data, moment, extra) {
  await send(data.settings, buildRecap(data, moment, extra).bytes());
}
