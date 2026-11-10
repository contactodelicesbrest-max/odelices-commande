// Lecture automatique des étiquettes : le texte est reconnu sur le téléphone (ML Kit),
// puis on y cherche le nom du produit, le numéro de lot, la DLC/DDM et l'estampille sanitaire.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { detectType, openingAdvice, quantityFromLabel } from "./products.js";

const TextReader = registerPlugin("TextReader");
export const isOcrAvailable = () => Capacitor.isNativePlatform();

export async function readLabel(dataUrl) {
  const res = await TextReader.recognize({ data: dataUrl });
  return { ...parseLabel(res.text || "", res.lines || []), raw: res.text || "" };
}

const pad = (n) => String(n).padStart(2, "0");
const MONTHS = { jan: 1, janv: 1, fev: 2, fév: 2, feb: 2, mar: 3, mars: 3, avr: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6, juil: 7, jul: 7, aou: 8, aoû: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12, déc: 12 };

function toIso(d, m, y) {
  d = Number(d); m = Number(m); y = Number(y);
  if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2040)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}
const lastDayOfMonth = (m, y) => {
  y = Number(y) < 100 ? Number(y) + 2000 : Number(y);
  return toIso(new Date(y, Number(m), 0).getDate(), m, y);
};

// Toutes les dates trouvées dans une ligne : 12/11/26, 12.11.2026, 12-11-26, 12 11 26, 12 NOV 2026, 03/2027
function datesIn(line) {
  const out = [];
  const s = line.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, "0"); // O lu à la place de 0
  let m;
  const full = /(?<!\d)(\d{1,2})\s?[/.\-\s]\s?(\d{1,2})\s?[/.\-\s]\s?(\d{4}|\d{2})(?!\d)/g;
  while ((m = full.exec(s))) {
    const iso = toIso(m[1], m[2], m[3]);
    if (iso) out.push({ iso, index: m.index, partial: false });
  }
  const named = /(?<!\d)(\d{1,2})\s?([A-Za-zéû]{3,5})\.?\s?(\d{4}|\d{2})(?!\d)/g;
  while ((m = named.exec(s))) {
    const mo = MONTHS[m[2].toLowerCase()];
    const iso = mo && toIso(m[1], mo, m[3]);
    if (iso) out.push({ iso, index: m.index, partial: false });
  }
  if (!out.length) {
    const monthYear = /(?<![\d/.])(\d{1,2})\s?[/.\-]\s?(20\d{2})(?!\d)/g; // DDM « fin 03/2027 »
    while ((m = monthYear.exec(s))) {
      if (Number(m[1]) >= 1 && Number(m[1]) <= 12) out.push({ iso: lastDayOfMonth(m[1], m[2]), index: m.index, partial: true });
    }
  }
  return out;
}

const DLC_KEYS = /(a|à)\s*consommer\s*jusqu|\bdlc\b|use\s*by|verbrauchen\s*bis|consumir\s*hasta|da\s*consumarsi\s*entro|\bexp\b|\bexpiry\b/i;
const DDM_KEYS = /(a|à)\s*consommer\s*de\s*pr[ée]f[ée]rence|\bddm\b|\bdluo\b|best\s*before|\bbbe?\b|mindestens\s*haltbar|preferentemente/i;
const LOT_RE = [
  /(?:n[°o]\s*(?:de\s*)?lot|lot\s*n[°o]?|\blot\b|\bbatch\b|\blote\b|\bcharge\b)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9\-/.]{1,20})/i,
  /(?:^|\s)L\s?[:.]\s?([A-Z0-9][A-Z0-9\-/.]{2,20})/,
  /(?:^|\s)(L\d[A-Z0-9\-]{3,20})\b/,
];
const STAMP_RE = /\b(FR|ES|DE|IT|BE|NL|PL|PT|IE|DK|AT)\s?[-.]?\s?(\d{2,3}[.\s]?\d{3}[.\s]?\d{3})\s?[-.]?\s?(CE|EC|EG|EU)\b/i;
const NOISE = /ingr[ée]dient|poids|net|kcal|kj|valeur|nutrition|conserver|temp[ée]rature|fabriqu|emball|www\.|http|tel|t[ée]l[ée]phone|adresse|lot|dlc|ddm|consommer|pr[ée]f[ée]rence|code|ean|prix|€|\d{4,}|^[\d\s.,:/\-%]+$|^e?\s?\d+\s?(g|kg|ml|l|cl)$/i;

export function parseLabel(text, lines = []) {
  const ls = (lines.length ? lines.map((l) => l.text) : text.split(/\n/)).map((l) => l.trim()).filter(Boolean);
  const result = { product: "", lot: "", dlc: "", dlcType: "", stamp: "", found: [] };

  // --- Date limite : d'abord près d'un mot-clé (même ligne ou ligne suivante)
  let best = null;
  ls.forEach((l, i) => {
    const isDlc = DLC_KEYS.test(l);
    const isDdm = DDM_KEYS.test(l);
    if (!isDlc && !isDdm) return;
    const ds = [...datesIn(l), ...(ls[i + 1] ? datesIn(ls[i + 1]) : [])];
    if (ds.length && !best) best = { iso: ds[0].iso, type: isDdm && !isDlc ? "DDM" : ds[0].partial ? "DDM" : "DLC" };
  });
  if (!best) {
    // Sinon : la date la plus lointaine trouvée (la date de fabrication est plus ancienne)
    const all = ls.flatMap((l) => datesIn(l)).sort((a, b) => b.iso.localeCompare(a.iso));
    if (all.length) best = { iso: all[0].iso, type: all[0].partial ? "DDM" : "DLC", guessed: true };
  }
  if (best) {
    result.dlc = best.iso;
    result.dlcType = best.type;
    result.found.push(best.guessed ? "date (à vérifier)" : best.type);
  }

  // --- Numéro de lot
  for (const l of ls) {
    for (const re of LOT_RE) {
      const m = l.match(re);
      if (m && m[1] && !/^(de|du|n°|no)$/i.test(m[1])) {
        result.lot = m[1].replace(/[.\-/]+$/, "");
        break;
      }
    }
    if (result.lot) break;
  }
  if (result.lot) result.found.push("lot");

  // --- Estampille sanitaire (ex : FR 29.019.001 CE)
  const st = text.replace(/\n/g, " ").match(STAMP_RE);
  if (st) {
    result.stamp = `${st[1].toUpperCase()} ${st[2].replace(/\s/g, ".")} ${st[3].toUpperCase()}`;
    result.found.push("estampille");
  }

  // --- Nom du produit : la ligne de texte la plus grande qui ressemble à un nom
  const candidates = (lines.length ? lines : ls.map((t, i) => ({ text: t, height: 0, top: i })))
    .map((l) => ({ ...l, text: l.text.trim() }))
    .filter((l) => (l.text.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 4 && !NOISE.test(l.text) && !datesIn(l.text).length);
  if (candidates.length) {
    const top = [...candidates].sort((a, b) => (b.height || 0) - (a.height || 0) || (a.top || 0) - (b.top || 0))[0];
    // Ajoute la ligne juste en dessous si elle est de même taille (nom sur 2 lignes)
    const next = candidates.find(
      (l) => l !== top && top.height && Math.abs((l.height || 0) - top.height) <= top.height * 0.2 && l.top > top.top && l.top - top.top < top.height * 2.2
    );
    result.product = cleanName(next ? `${top.text} ${next.text}` : top.text);
    result.found.push("nom");
  }
  // --- Type de produit, quantité, conseil après ouverture
  const advice = openingAdvice(result.product, text);
  result.type = advice.type || detectType(text);
  result.advice = advice;
  if (result.type) result.found.push(`type : ${result.type.label}`);
  const q = quantityFromLabel(text);
  if (q) {
    result.quantity = q;
    result.found.push("quantité");
  }
  return result;
}

function cleanName(s) {
  const t = s.replace(/\s+/g, " ").replace(/[|*•]+/g, "").trim();
  // MAJUSCULES -> Première lettre en majuscule
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}
