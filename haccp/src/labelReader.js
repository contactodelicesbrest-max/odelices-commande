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
// Mot « LOT » tolérant aux erreurs de lecture (L0T, 1OT, LO7…), « N° de lot », « Batch »…
const LOT_KW = /(?:n\s?[°oº"]?\s*(?:de\s*)?[l1I|][o0Q][t7T]\b|[l1I|][o0Q][t7T]\s*n\s?[°oº]|\b[l1I|][o0Q][t7T]s?\b|\bbatch\b|\blote\b|\bcharge\b)/i;
const LOT_VAL = /[A-Z0-9][A-Z0-9\-/.]{1,24}/gi;
// Premier « mot » qui ressemble à un numéro de lot parmi les 3 premiers
const firstLot = (txt) => (txt.match(LOT_VAL) || []).slice(0, 3).find((v) => okLot(v.replace(/[.\-/]+$/, "")));
const LOT_FALLBACK = [
  /(?:^|\s)L\s?[:.]\s?([A-Z0-9][A-Z0-9\-/.]{2,24})/,
  /(?:^|\s)(L\d[A-Z0-9\-]{3,24})\b/,
  /(?:^|\s)L\s(\d{4,}[A-Z0-9]*)\b/,
];
const BAD_LOT = /^(de|du|des|no|n|dlc|ddm|date|exp|best|before|a|à|le|la|batch|lot|number|nr)$/i;
const okLot = (v) => v && /\d/.test(v) && !BAD_LOT.test(v) && v.length >= 3;

function findLot(lines) {
  // 1) « LOT … » avec la valeur sur la même ligne
  for (const l of lines) {
    const m = l.text.match(LOT_KW);
    if (!m) continue;
    const after = l.text.slice(m.index + m[0].length).replace(/^[\s:.\-#n°º]*/i, "");
    const v = firstLot(after);
    if (v) return v.replace(/[.\-/]+$/, "");
    // 2) Valeur sur la ligne à côté (même hauteur, à droite) ou juste en dessous
    if (l.height) {
      const near = lines
        .filter((o) => o !== l)
        .map((o) => {
          const sameRow = Math.abs(o.top - l.top) < l.height * 0.8 && o.left > l.left;
          const below = o.top > l.top && o.top - l.top < l.height * 2.8 && Math.abs(o.left - l.left) < l.height * 8;
          return { o, score: sameRow ? o.left - l.left : below ? 10000 + (o.top - l.top) : Infinity };
        })
        .filter((x) => x.score < Infinity)
        .sort((a, b) => a.score - b.score);
      for (const { o } of near) {
        const v2 = firstLot(o.text);
        if (v2) return v2.replace(/[.\-/]+$/, "");
      }
    }
  }
  // 3) Formes courtes : « L: 2311A », « L23110 », « L 23110 »
  for (const l of lines)
    for (const re of LOT_FALLBACK) {
      const v = l.text.match(re)?.[1];
      if (okLot(v)) return v.replace(/[.\-/]+$/, "");
    }
  return "";
}

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
  const geo = lines.length ? lines.map((l) => ({ ...l, text: l.text.trim() })) : ls.map((t, i) => ({ text: t, top: i * 10, left: 0, height: 0 }));
  result.lot = findLot(geo);
  if (result.lot) result.found.push("lot");
  result.lines = ls;

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
