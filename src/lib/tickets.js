// Construction des tickets (cuisine / client / rapport) au format ESC/POS
// compatible avec la quasi-totalité des imprimantes thermiques 58 mm et 80 mm.
import { money, vatBreakdown } from "./pricing.js";

// ---------- Mise en page (segments) ----------
// seg = { text, bold, size: 1|2 (double largeur+hauteur)|"tall" (double hauteur), align: "left"|"center"|"right" }

function wrap(text, cols) {
  const out = [];
  for (const raw of String(text).split("\n")) {
    let line = raw;
    const indent = (line.match(/^\s*/) || [""])[0];
    while (line.length > cols) {
      let cut = line.lastIndexOf(" ", cols);
      if (cut <= indent.length) cut = cols;
      out.push(line.slice(0, cut));
      line = indent + line.slice(cut).trimStart();
    }
    out.push(line);
  }
  return out;
}

const cols = (seg, width) => (seg.size === 2 ? Math.floor(width / 2) : width);
const sep = (c = "-") => ({ text: c.repeat(64), rule: true });
const pair = (left, right, opts = {}) => ({ left, right, ...opts });

function lineTitle(it) {
  return `${it.qty} x ${it.name}${it.sizeLabel ? ` (${it.sizeLabel})` : ""}`;
}

function choiceText(c) {
  return c.items.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ");
}

export function kitchenTicket(order, s) {
  const segs = [];
  segs.push({ text: "CUISINE", align: "center", bold: true });
  segs.push({ text: `N° ${order.number}`, align: "center", bold: true, size: 2 });
  segs.push({ text: order.orderType.toUpperCase(), align: "center", bold: true, size: 2 });
  if (order.clientName) segs.push({ text: order.clientName, align: "center", bold: true, size: "tall" });
  segs.push({ text: new Date(order.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }), align: "center" });
  segs.push(sep("="));
  for (const it of order.items) {
    segs.push({ text: lineTitle(it), bold: true, size: "tall" });
    if (it.removed?.length) segs.push({ text: `  SANS : ${it.removed.join(", ")}`, bold: true, size: "tall" });
    for (const c of it.choices || []) segs.push({ text: `  ${c.label.replace(/\s*\([^)]*€\)/g, "")} : ${choiceText(c)}`, size: "tall" });
    if (it.note) segs.push({ text: `  NOTE : ${it.note}`, bold: true });
    segs.push(sep());
  }
  const count = order.items.reduce((a, b) => a + b.qty, 0);
  segs.push({ text: `${count} article${count > 1 ? "s" : ""}`, align: "right" });
  return segs;
}

export function clientTicket(order, s, withVat = true) {
  const segs = [];
  segs.push({ text: s.restaurantName, align: "center", bold: true, size: 2 });
  if (s.address) segs.push({ text: s.address, align: "center" });
  if (s.phone) segs.push({ text: `Tél. ${s.phone}`, align: "center" });
  if (s.siret) segs.push({ text: `SIRET ${s.siret}`, align: "center" });
  segs.push(sep());
  segs.push({ text: `Commande N° ${order.number}`, align: "center", bold: true, size: 2 });
  segs.push({ text: `${order.orderType}${order.clientName ? " · " + order.clientName : ""}`, align: "center", bold: true });
  segs.push({ text: new Date(order.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }), align: "center" });
  segs.push(sep());
  for (const it of order.items) {
    segs.push(pair(lineTitle(it), money(it.totalPrice)));
    if (it.removed?.length) segs.push({ text: `  Sans ${it.removed.join(", ")}` });
    for (const c of it.choices || []) segs.push({ text: `  ${choiceText(c)}` });
  }
  segs.push(sep());
  segs.push(pair("TOTAL TTC", money(order.total), { bold: true, size: "tall" }));
  if (withVat) {
    for (const v of vatBreakdown(order.items)) segs.push(pair(`TVA ${String(v.rate).replace(".", ",")}% sur ${money(v.ht)} HT`, money(v.tva)));
  }
  segs.push(sep());
  segs.push({ text: order.paid ? `Réglé (${order.paymentMethod || "comptoir"})` : "À RÉGLER AU COMPTOIR", align: "center", bold: true });
  if (s.ticketFooter) segs.push({ text: s.ticketFooter, align: "center" });
  return segs;
}

export function reportTicket(day, orders, s) {
  const valid = orders.filter((o) => !o.cancelled);
  const total = valid.reduce((a, o) => a + o.total, 0);
  const segs = [];
  segs.push({ text: s.restaurantName, align: "center", bold: true, size: 2 });
  segs.push({ text: "RAPPORT DU JOUR", align: "center", bold: true });
  segs.push({ text: new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { dateStyle: "full" }), align: "center" });
  segs.push(sep());
  segs.push(pair("Commandes", String(valid.length)));
  segs.push(pair("Annulées", String(orders.length - valid.length)));
  segs.push(pair("Panier moyen", money(valid.length ? total / valid.length : 0)));
  for (const t of ["Sur place", "À emporter"]) {
    const l = valid.filter((o) => o.orderType === t);
    if (l.length) segs.push(pair(`${t} (${l.length})`, money(l.reduce((a, o) => a + o.total, 0))));
  }
  segs.push(sep());
  for (const v of vatBreakdown(valid.flatMap((o) => o.items))) {
    segs.push(pair(`TVA ${v.rate}% · HT ${money(v.ht)}`, money(v.tva)));
  }
  segs.push(pair("TOTAL TTC", money(total), { bold: true, size: "tall" }));
  segs.push(sep());
  segs.push({ text: "Produits vendus", bold: true });
  const prods = {};
  for (const o of valid) for (const it of o.items) prods[it.name] = (prods[it.name] || 0) + it.qty;
  Object.entries(prods)
    .sort((a, b) => b[1] - a[1])
    .forEach(([n, q]) => segs.push(pair(n, String(q))));
  return segs;
}

export function testTicket(s, label) {
  return [
    { text: "TEST D'IMPRESSION", align: "center", bold: true, size: 2 },
    { text: s.restaurantName, align: "center" },
    { text: label, align: "center" },
    sep(),
    { text: "Accents : é è à ç ô ù €" },
    { text: "Texte normal" },
    { text: "Texte gras", bold: true },
    { text: "Double hauteur", size: "tall" },
    { text: "GRAND", size: 2 },
    sep(),
    { text: "L'imprimante fonctionne !", align: "center", bold: true },
  ];
}

// ---------- Rendu texte (aperçu à l'écran) ----------
function layout(segs, width) {
  const lines = [];
  for (const seg of segs) {
    if (seg.rule) {
      lines.push({ ...seg, text: seg.text.slice(0, width) });
      continue;
    }
    const c = cols(seg, width);
    if (seg.left !== undefined) {
      const right = seg.right;
      const leftLines = wrap(seg.left, c - right.length - 1);
      leftLines.forEach((l, i) => {
        if (i === leftLines.length - 1) lines.push({ ...seg, text: l + " ".repeat(Math.max(1, c - l.length - right.length)) + right });
        else lines.push({ ...seg, text: l });
      });
      continue;
    }
    for (const l of wrap(seg.text, c)) lines.push({ ...seg, text: l });
  }
  return lines;
}

export function previewLines(segs, width = 32) {
  return layout(segs, width).map((l) => {
    const c = cols(l, width);
    let t = l.text;
    if (l.align === "center") t = " ".repeat(Math.max(0, Math.floor((c - t.length) / 2))) + t;
    if (l.align === "right") t = " ".repeat(Math.max(0, c - t.length)) + t;
    return { text: t, bold: !!l.bold, size: l.size || 1 };
  });
}

// ---------- Encodage ESC/POS ----------
const CP858 = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "å": 0x86, "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a,
  "ï": 0x8b, "î": 0x8c, "ì": 0x8d, "Ä": 0x8e, "Å": 0x8f, "É": 0x90, "æ": 0x91, "Æ": 0x92, "ô": 0x93, "ö": 0x94, "ò": 0x95,
  "û": 0x96, "ù": 0x97, "ÿ": 0x98, "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b, "£": 0x9c, "Ø": 0x9d, "á": 0xa0, "í": 0xa1, "ó": 0xa2,
  "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "°": 0xf8, "€": 0xd5, "È": 0xd4, "Ê": 0xd2, "Ë": 0xd3, "À": 0xb7, "Â": 0xb6, "Î": 0xd7,
  "Ô": 0xe2, "Û": 0xea, "Ù": 0xeb, "«": 0xae, "»": 0xaf,
};

function plain(t) {
  return t
    .replace(/€/g, "EUR")
    .replace(/[Œœ]/g, (m) => (m === "Œ" ? "OE" : "oe"))
    .replace(/[’‘]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/[·•]/g, "-")
    .replace(/°/g, "o")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "?");
}

function encodeText(t, accents) {
  const out = [];
  if (!accents) {
    for (const ch of plain(t)) out.push(ch.charCodeAt(0));
    return out;
  }
  for (const ch of t.replace(/[Œœ]/g, (m) => (m === "Œ" ? "OE" : "oe")).replace(/[’‘]/g, "'").replace(/[·•]/g, "-")) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code < 0x7f) out.push(code);
    else if (CP858[ch]) out.push(CP858[ch]);
    else out.push(...plain(ch).split("").map((c) => c.charCodeAt(0)));
  }
  return out;
}

export function encodeEscPos(segs, cfg) {
  const width = Number(cfg.width) || 32;
  const accents = !!cfg.accents;
  const b = [];
  const ESC = 0x1b, GS = 0x1d;
  b.push(ESC, 0x40); // init
  if (accents) b.push(ESC, 0x74, 19); // page de code CP858
  for (const l of layout(segs, width)) {
    b.push(ESC, 0x61, l.align === "center" ? 1 : l.align === "right" ? 2 : 0);
    b.push(ESC, 0x45, l.bold ? 1 : 0);
    b.push(GS, 0x21, l.size === 2 ? 0x11 : l.size === "tall" ? 0x01 : 0x00);
    b.push(...encodeText(l.text, accents), 0x0a);
  }
  b.push(GS, 0x21, 0, ESC, 0x45, 0, ESC, 0x61, 0);
  b.push(ESC, 0x64, 4); // avance papier
  if (cfg.cut) b.push(GS, 0x56, 66, 0); // coupe partielle (ignorée si pas de massicot)
  return new Uint8Array(b);
}

export function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
