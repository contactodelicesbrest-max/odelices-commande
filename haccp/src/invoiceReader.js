// Lecture des factures fournisseurs (photo lue par ML Kit ou PDF lu par pdf.js).
// Principe : on regroupe le texte en lignes (même hauteur sur la page), puis on cherche
// dans chaque ligne les nombres qui vérifient  quantité × prix unitaire = montant
// (en HT ou en TTC). Ça marche quel que soit le fournisseur et l'ordre des colonnes.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const SUPPLIERS = [
  { name: "Metro", keys: ["metro"] },
  { name: "Carrefour", keys: ["carrefour"] },
  { name: "Leclerc", keys: ["leclerc", "e.leclerc", "kergaradec"] },
  { name: "Mirza Packs & Foods", keys: ["mirza"] },
  { name: "West Emballages", keys: ["west emballages", "westemballages"] },
  { name: "Euro Doner Bretagne", keys: ["euro doner", "eurodoner", "edbbegard"] },
  { name: "Kenfood Market", keys: ["ken food", "kenfood", "valiy-hir", "valiy hir"] },
  { name: "DPS Market", keys: ["dps market", "dpsmarket", "dps.brest"] },
  { name: "Promocash", keys: ["promocash"] },
  { name: "Transgourmet", keys: ["transgourmet"] },
];

// ---------- Nombres ----------
// « 15,93 € », « 637,20 », « 2.49 », « 40,00 », « 1 033,50 »
function toNumber(tok) {
  const t = tok.replace(/[€\s]/g, "").replace(/^\*+|\*+$/g, "");
  if (!/^-?\d{1,6}([.,]\d{1,3})?$/.test(t)) return null;
  return Number(t.replace(",", "."));
}

// Un « mot » qui est un code (EAN, référence article) et pas une quantité / un prix
const isCode = (tok) =>
  /^\d{7,}$/.test(tok) || // EAN, n° article long
  /^[A-Z]{1,5}[_-]?\d{3,}$/i.test(tok) || // ART3696, MAR_00009
  /^\(\d{8,}\)$/.test(tok);

// ---------- Regroupement en lignes ----------
// items : [{ text, top, left, height }] (coordonnées de la page)
export function groupRows(items) {
  const its = items
    .map((i) => ({ ...i, text: String(i.text || "").trim(), height: i.height || 10, cy: (i.top || 0) + (i.height || 10) / 2 }))
    .filter((i) => i.text);
  its.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const it of its) {
    const r = rows.find((row) => Math.abs(row.cy - it.cy) < Math.min(row.h, it.height) * 0.6);
    if (r) {
      r.items.push(it);
      r.cy = (r.cy * (r.items.length - 1) + it.cy) / r.items.length;
    } else rows.push({ cy: it.cy, h: it.height, items: [it] });
  }
  for (const r of rows) {
    r.items.sort((a, b) => (a.left || 0) - (b.left || 0));
    r.text = r.items
      .map((i) => i.text)
      .join("  ")
      .replace(/(\d{1,3})[\s\u202f](\d{3}[.,]\d{2})(?!\d)/g, "$1$2"); // « 1 033,50 » -> « 1033,50 »
  }
  return rows.sort((a, b) => a.cy - b.cy);
}

// ---------- Recherche quantité × prix = montant ----------
const TVA = [1, 1.055, 1.1, 1.2];
const close = (a, b) => Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.006);

function findQtyPrice(nums) {
  // nums : [{ v, i }] dans l'ordre de la ligne
  let best = null;
  const n = nums.length;
  for (let k = n - 1; k >= 2 - 1; k--) {
    const total = nums[k].v;
    if (total <= 0) continue;
    for (let a = 0; a < k; a++)
      for (let b = 0; b < k; b++) {
        if (a === b) continue;
        const q = nums[a].v, pu = nums[b].v;
        if (q <= 0 || pu <= 0 || q > 9999) continue;
        // quantité simple, ou colisage × nombre de colis (Metro : « 24 2 »)
        const qtyOptions = [{ q, pack: null, idx: [a] }];
        for (let c = 0; c < k; c++)
          if (c !== a && c !== b && Number.isInteger(nums[c].v) && Number.isInteger(q) && nums[c].v > 0)
            qtyOptions.push({ q: q * nums[c].v, pack: c < a ? nums[c].v : q, packs: c < a ? q : nums[c].v, idx: [a, c] });
        for (const opt of qtyOptions)
          for (const t of TVA) {
            if (!close(opt.q * pu * t, total)) continue;
            const score =
              (Number.isInteger(opt.q) ? 4 : Number.isInteger(Math.round(opt.q * 100) / 100) ? 1 : 0) +
              (t === 1 ? 2 : 0) +
              (opt.idx.length === 1 ? 1 : 0) +
              (pu !== total || opt.q === 1 ? 1 : 0) +
              (a < b ? 0.5 : 0) +
              (nums[a].int ? 1 : 0) -
              k * 0.01;
            if (!best || score > best.score)
              best = { score, qty: opt.packs ?? opt.q, pack: opt.pack, unitPrice: pu, total, ttc: t !== 1, used: new Set([...opt.idx, b, k].map((x) => nums[x].i)) };
          }
      }
  }
  return best;
}

const SKIP_ROW = /total|t\.?v\.?a|net\s*(a|à)\s*payer|montant\s*(ht|ttc|tva)|sous[-\s]?total|remise|escompte|acompte|reste\s*(a|à)|r[eè]glement|carte\s*bancaire|prix\s*au\s*kg|nombre\s*(de|d')|colis\s*:|poids\s*total|consigne/i;

function cleanName(tokens0) {
  const tokens = tokens0.length > 2 && /^[A-Z]{1,2}$/.test(tokens0[0]) ? tokens0.slice(1) : tokens0;
  return tokens
    .filter((t) => !isCode(t) && !/^(uni|u|pcs?|€|eur|x|b|d|p|c\d|\d+%.*|%)$/i.test(t) && toNumber(t) === null)
    .join(" ")
    .replace(/\(\s*\d{6,}\s*\)/g, "")
    .replace(/^[\s*•\-–]+|[\s*•\-–]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
// Libellé d'une ligne de texte seule : on enlève les codes mais on garde « 25 kilos », « 80 gr »
const cleanLabel = (text) =>
  text
    .split(/\s+/)
    .filter((t) => t && !isCode(t))
    .join(" ")
    .replace(/\(\s*\d{6,}\s*\)/g, "")
    .trim();
function isItemRow(r) {
  const nums = r.text.split(/\s+/).filter((t) => !isCode(t) && !/%/.test(t)).map(toNumber).filter((v) => v !== null);
  return nums.length >= 3;
}
const hasWords = (s) => (s.match(/[A-Za-zÀ-ÿ]{2,}/g) || []).join("").length >= 3;

// ---------- Analyse complète ----------
export function parseInvoice(items) {
  const rows = groupRows(items);
  const fullText = rows.map((r) => r.text).join("\n");
  const ntext = norm(fullText);
  const out = { supplier: "", number: "", date: "", totalTTC: null, lines: [], text: fullText };

  out.supplier = SUPPLIERS.find((s) => s.keys.some((k) => ntext.includes(norm(k))))?.name || "";
  const num =
    fullText.match(/factur[ea]\s*n\s*[°o]\s*:?\s*([A-Z]{0,4}\d[\w\-/]{2,})/i) ||
    fullText.match(/factur[ea]\s+([A-Z]{2,4}\d{3,}[\w\-/]*)/i) ||
    fullText.match(/n\s*[°o]\s*factur[ea]\s*:?\s*([\w\-/()]{4,})/i);
  const looksLikeDate = (v) => {
    const m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if (!m) return false;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return +m[2] <= 12 && y >= 2020 && y <= 2040;
  };
  if (num && !looksLikeDate(num[1])) out.number = num[1];
  out.date = findDate(fullText);
  const rowMax = (r) => {
    const vals = r.text.replace(/\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}/g, " ").split(/\s+/).map(toNumber).filter((v) => v !== null);
    return vals.length ? Math.max(...vals) : null;
  };
  for (const r of rows) {
    if (/total\s*ttc|(a|à)\s*payer|net\s*(a|à)\s*payer|montant\s*ttc/i.test(norm(r.text))) {
      const v = rowMax(r);
      if (v !== null) out.totalTTC = Math.max(out.totalTTC || 0, v);
    }
  }
  if (out.totalTTC === null)
    for (const r of rows) if (/^\s*total\b/i.test(r.text) && rowMax(r) !== null) out.totalTTC = Math.max(out.totalTTC || 0, rowMax(r));

  rows.forEach((r, ri) => {
    if (SKIP_ROW.test(norm(r.text))) return;
    const tokens = r.text.split(/\s+/).filter(Boolean);
    const nums = [];
    tokens.forEach((t, i) => {
      if (isCode(t) || /%/.test(t)) return;
      const v = toNumber(t);
      if (v !== null) nums.push({ v, i, int: /^\d+([.,]0{1,2})?$/.test(t) });
    });
    if (nums.length < 3) return;
    const m = findQtyPrice(nums);
    if (!m) return;
    let name = cleanName(tokens.filter((_, i) => !m.used.has(i)).filter((t) => !nums.some((n) => tokens[n.i] === t && toNumber(t) !== null)));
    // Désignation écrite sur les lignes d'en dessous (ex : Euro Doner : code puis libellé)
    if (!hasWords(name)) {
      const parts = [];
      for (let j = ri + 1; j < rows.length && j <= ri + 4; j++) {
        const o = rows[j];
        if (o.cy - r.cy > r.h * 4.5 || isItemRow(o) || SKIP_ROW.test(norm(o.text))) break;
        const t = cleanLabel(o.text);
        if (hasWords(t)) parts.push(t);
      }
      if (!parts.length && ri > 0 && !isItemRow(rows[ri - 1])) {
        const t = cleanLabel(rows[ri - 1].text);
        if (hasWords(t)) parts.push(t);
      }
      name = parts.slice(0, 2).join(" — ");
    }
    if (!hasWords(name)) return;
    out.lines.push({
      name,
      qty: m.qty,
      pack: m.pack || null,
      unitPrice: m.ttc ? null : m.unitPrice,
      unitPriceTTC: m.ttc ? m.unitPrice : null,
      total: m.total,
    });
  });
  return out;
}

// ---------- Unité proposée pour le stock ----------
export function guessUnit(name, pack) {
  const s = norm(name);
  if (/carton|colis|ctn/.test(s)) return "carton";
  if (pack || /\d+\s*[x*]\s*\d+|pack|\bx\d+|\*\d+/.test(s)) return "pack";
  if (/seau/.test(s)) return "seau";
  if (/sachet|sac\b/.test(s)) return "sachet";
  if (/bidon|\d+\s*l\b/.test(s)) return "bouteille";
  return "pièce";
}

// ---------- Lecture d'une photo ou d'un PDF ----------
import { registerPlugin } from "@capacitor/core";
const TextReader = registerPlugin("TextReader");

export async function readInvoicePhoto(dataUrl) {
  const res = await TextReader.recognize({ data: dataUrl });
  return (res.lines || []).map((l) => ({ text: l.text, top: l.top, left: l.left, height: l.height }));
}

// PDF : on lit directement le texte et sa position (aucune erreur de lecture)
export async function readInvoicePdf(file) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const items = [];
  let offset = 0;
  const images = [];
  for (let p = 1; p <= Math.min(doc.numPages, 5); p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const h = Math.abs(it.transform[3]) || it.height || 10;
      items.push({ text: it.str, left: it.transform[4], top: offset + vp.height - it.transform[5] - h, height: h });
    }
    // Image de la page (gardée comme justificatif)
    const view = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = view.width;
    canvas.height = view.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: view }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.7));
    offset += vp.height + 50;
  }
  return { items, images };
}

// Date de la facture : d'abord près de « date / du / le », sinon la première date valide
const MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
function findDate(text) {
  const ok = (d, m, y) => {
    y = String(y).length === 2 ? 2000 + Number(y) : Number(y);
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2040)) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  const t = norm(text);
  let m = t.match(/(?:date(?:\s*de)?\s*facture|date|du|le)\s*:?\s*(?:[a-z]+\s+)?(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?!\d)/);
  if (m && ok(+m[1], +m[2], m[3])) return ok(+m[1], +m[2], m[3]);
  m = t.match(/(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/);
  if (m) return ok(+m[1], MOIS[m[2]], m[3]);
  const re = /(?<![\d\-/.])(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?![\d\-/])/g;
  while ((m = re.exec(t))) if (ok(+m[1], +m[2], m[3])) return ok(+m[1], +m[2], m[3]);
  return "";
}
