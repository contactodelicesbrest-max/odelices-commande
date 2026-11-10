import { jsPDF } from "jspdf";
import { loadPhoto } from "./store.jsx";
import { fmtDate, fmtTime, fmtNum, dayKey } from "./utils.js";
import { EQUIP_TYPES } from "./db.js";

const M = 12; // marge (mm)

function makeDoc(title, subtitle, shopName) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${shopName} - ${title}`, M, M + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(subtitle, M, M + 7);
    doc.setTextColor(0);
  };
  header();
  return { doc, W, H: doc.internal.pageSize.getHeight(), header };
}

function finish(doc, shopName) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    doc.text(`${shopName} - édité le ${fmtDate(new Date())} à ${fmtTime(new Date())}`, M, H - 6);
    doc.text(`Page ${i}/${n}`, W - M, H - 6, { align: "right" });
    doc.setTextColor(0);
  }
  return doc.output("blob");
}

// cols : [{ title, w, get(row) -> string, img?(row) -> dataUrl|null, color?(row) -> [r,g,b] }]
async function table(ctx, cols, rows, startY) {
  const { doc, W, H, header } = ctx;
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = (W - 2 * M) / totalW;
  const ws = cols.map((c) => c.w * scale);
  let y = startY;
  const drawHead = () => {
    doc.setFillColor(28, 25, 23);
    doc.rect(M, y, W - 2 * M, 7, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    let x = M;
    cols.forEach((c, i) => {
      doc.text(c.title, x + 1.5, y + 4.8);
      x += ws[i];
    });
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    y += 7;
  };
  drawHead();
  doc.setFontSize(8.5);
  let zebra = false;
  for (const r of rows) {
    const cells = cols.map((c, i) => (c.img ? null : doc.splitTextToSize(String(c.get(r) ?? ""), ws[i] - 3)));
    const imgs = await Promise.all(cols.map((c) => (c.img ? c.img(r) : null)));
    const hasImg = imgs.some(Boolean);
    const rowH = Math.max(6, ...cells.map((l) => (l ? l.length * 3.8 + 2.4 : 0)), hasImg ? 24 : 0);
    if (y + rowH > H - 12) {
      doc.addPage();
      header();
      y = M + 12;
      drawHead();
      doc.setFontSize(8.5);
    }
    if (zebra) {
      doc.setFillColor(245, 245, 244);
      doc.rect(M, y, W - 2 * M, rowH, "F");
    }
    zebra = !zebra;
    let x = M;
    cols.forEach((c, i) => {
      if (c.img) {
        const im = imgs[i];
        if (im) {
          try {
            const p = doc.getImageProperties(im);
            const ratio = p.width / p.height;
            let ih = rowH - 2;
            let iw = ih * ratio;
            if (iw > ws[i] - 2) {
              iw = ws[i] - 2;
              ih = iw / ratio;
            }
            doc.addImage(im, "JPEG", x + 1, y + 1, iw, ih);
          } catch {
            /* image illisible */
          }
        }
      } else {
        const col = c.color?.(r);
        if (col) doc.setTextColor(...col);
        doc.text(cells[i], x + 1.5, y + 4.2);
        doc.setTextColor(0);
      }
      x += ws[i];
    });
    doc.setDrawColor(220);
    doc.line(M, y + rowH, W - M, y + rowH);
    y += rowH;
  }
  if (!rows.length) {
    doc.setTextColor(120);
    doc.text("Aucun enregistrement sur la période.", M + 1.5, y + 5);
    doc.setTextColor(0);
    y += 8;
  }
  return y;
}

const RED = [185, 28, 28];
const inPeriod = (iso, from, to) => {
  const k = dayKey(iso);
  return k >= from && k <= to;
};
const sortAt = (a, b) => a.at.localeCompare(b.at);
const period = (from, to) => `Période du ${fmtDate(from + "T12:00")} au ${fmtDate(to + "T12:00")}`;

export async function pdfTemperatures(data, from, to) {
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("Relevés de températures", period(from, to), shop);
  const eqs = [...data.equipments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  ctx.doc.setFontSize(8.5);
  ctx.doc.text(
    "Équipements : " + eqs.map((e) => `${e.name} (${EQUIP_TYPES[e.type]?.label || e.type}, ${fmtNum(e.min)} à ${fmtNum(e.max)} °C)`).join(" ; "),
    M,
    M + 12,
    { maxWidth: ctx.W - 2 * M }
  );
  const rows = data.temps.filter((t) => inPeriod(t.at, from, to)).sort(sortAt);
  await table(
    ctx,
    [
      { title: "Date", w: 20, get: (t) => fmtDate(t.at) },
      { title: "Moment", w: 15, get: (t) => t.moment },
      { title: "Heure", w: 12, get: (t) => fmtTime(t.at) },
      { title: "Équipement", w: 35, get: (t) => t.equipmentName },
      { title: "T° relevée", w: 18, get: (t) => `${fmtNum(t.value)} °C`, color: (t) => (t.ok ? null : RED) },
      { title: "Seuils", w: 20, get: (t) => `${fmtNum(t.min)} / ${fmtNum(t.max)} °C` },
      { title: "Conforme", w: 15, get: (t) => ({ ok: "Oui", warn: "Toléré", ko: "NON" }[t.status || (t.ok ? "ok" : "ko")]), color: (t) => (t.ok ? null : RED) },
      { title: "Action corrective / commentaire", w: 70, get: (t) => [t.action, t.comment].filter(Boolean).join(" - ") },
      { title: "Par", w: 15, get: (t) => t.by },
    ],
    rows,
    M + 20
  );
  return finish(ctx.doc, shop);
}

export async function pdfTrace(data, from, to, withPhotos = true) {
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("Traçabilité des produits", period(from, to), shop);
  const rows = data.trace.filter((t) => inPeriod(t.at, from, to)).sort(sortAt);
  const status = { open: "En cours", used: "Consommé", thrown: "Jeté" };
  const cols = [
    { title: "Date / heure", w: 22, get: (t) => `${fmtDate(t.at)} ${fmtTime(t.at)}` },
    { title: "Produit", w: 40, get: (t) => t.product + (t.qty ? ` (${t.qty})` : "") },
    { title: "Lot", w: 22, get: (t) => t.lot },
    { title: "Fournisseur", w: 25, get: (t) => t.supplier },
    { title: "DLC fab.", w: 18, get: (t) => (t.dlc ? fmtDate(t.dlc) : "") },
    { title: "DLC ouvert", w: 18, get: (t) => (t.dlcAfter ? fmtDate(t.dlcAfter) : "") },
    { title: "Statut", w: 17, get: (t) => status[t.status] || "" },
    { title: "Commentaire", w: 35, get: (t) => t.comment },
    { title: "Par", w: 12, get: (t) => t.by },
  ];
  if (withPhotos) cols.unshift({ title: "Étiquette", w: 26, img: (t) => loadPhoto(t.photoId) });
  await table(ctx, cols, rows, M + 12);
  return finish(ctx.doc, shop);
}

export async function pdfOil(data, from, to) {
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("Huile de friture - contrôles et changements", period(from, to), shop);
  const rows = data.oil.filter((t) => inPeriod(t.at, from, to)).sort(sortAt);
  const aspect = { bon: "Bonne", moyen: "À surveiller", mauvais: "À changer" };
  const lim = Number(data.settings.oilTpmMax || 25);
  await table(
    ctx,
    [
      { title: "Date", w: 20, get: (t) => fmtDate(t.at) },
      { title: "Heure", w: 12, get: (t) => fmtTime(t.at) },
      { title: "Friteuse", w: 30, get: (t) => t.fryerName },
      { title: "Opération", w: 25, get: (t) => ({ change: "CHANGEMENT", control: "Contrôle", filter: "Filtrage" }[t.kind] || t.kind) },
      { title: "Comp. polaires", w: 20, get: (t) => (Number.isFinite(t.tpm) ? `${fmtNum(t.tpm)} %` : ""), color: (t) => (t.tpm >= lim ? RED : null) },
      { title: "T° huile", w: 15, get: (t) => (Number.isFinite(t.temp) ? `${fmtNum(t.temp)} °C` : "") },
      { title: "Aspect", w: 20, get: (t) => aspect[t.aspect] || "" },
      { title: "Huile / quantité", w: 30, get: (t) => [t.oilType, Number.isFinite(t.liters) ? `${fmtNum(t.liters)} L` : ""].filter(Boolean).join(" - ") },
      { title: "Commentaire", w: 45, get: (t) => t.comment },
      { title: "Par", w: 12, get: (t) => t.by },
    ],
    rows,
    M + 12
  );
  return finish(ctx.doc, shop);
}

export async function pdfStock(data, from, to) {
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("État du stock", `Au ${fmtDate(new Date())} - mouvements : ${period(from, to).toLowerCase()}`, shop);
  const items = [...data.stock].sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name));
  await table(
    ctx,
    [
      { title: "Catégorie", w: 30, get: (s) => s.category },
      { title: "Produit", w: 50, get: (s) => s.name },
      { title: "Quantité", w: 22, get: (s) => `${fmtNum(s.qty || 0, 2)} ${s.unit}`, color: (s) => (s.min && s.qty <= s.min ? RED : null) },
      { title: "Mini", w: 18, get: (s) => (s.min ? `${fmtNum(s.min, 2)} ${s.unit}` : "") },
      { title: "Emplacement", w: 30, get: (s) => s.location },
      { title: "Fournisseur", w: 30, get: (s) => s.supplier },
      { title: "DLC", w: 18, get: (s) => (s.dlc ? fmtDate(s.dlc) : "") },
    ],
    items,
    M + 12
  );
  const moves = data.moves.filter((t) => inPeriod(t.at, from, to)).sort(sortAt);
  ctx.doc.addPage();
  ctx.header();
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(11);
  ctx.doc.text("Mouvements de stock", M, M + 14);
  ctx.doc.setFont("helvetica", "normal");
  await table(
    ctx,
    [
      { title: "Date", w: 25, get: (m) => `${fmtDate(m.at)} ${fmtTime(m.at)}` },
      { title: "Produit", w: 50, get: (m) => m.name },
      { title: "Mouvement", w: 25, get: (m) => `${m.qty > 0 ? "+" : ""}${fmtNum(m.qty, 2)} ${m.unit}`, color: (m) => (m.qty < 0 ? RED : null) },
      { title: "Motif", w: 60, get: (m) => m.reason },
      { title: "Par", w: 15, get: (m) => m.by },
    ],
    moves,
    M + 18
  );
  return finish(ctx.doc, shop);
}

export async function pdfProcess(data, from, to) {
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("Cuisson, refroidissement, remise en température, maintien chaud", period(from, to), shop);
  const labels = { cooling: "Refroidissement", reheat: "Remise en T°", hot: "Maintien chaud", cook: "Cuisson à coeur" };
  const rows = data.process.filter((t) => t.state === "done" && inPeriod(t.at, from, to)).sort(sortAt);
  ctx.doc.setFontSize(8.5);
  ctx.doc.text("Règles : refroidissement de +63 °C à +10 °C en moins de 2 h ; remise en température à +63 °C en moins d'1 h ; maintien au chaud et cuisson : +63 °C minimum à coeur.", M, M + 12);
  await table(
    ctx,
    [
      { title: "Date", w: 20, get: (t) => fmtDate(t.at) },
      { title: "Opération", w: 25, get: (t) => labels[t.kind] },
      { title: "Produit", w: 40, get: (t) => t.product },
      { title: "Début", w: 25, get: (t) => (t.startAt ? `${fmtTime(t.startAt)} - ${fmtNum(t.startTemp)} °C` : "") },
      { title: "Fin / mesure", w: 25, get: (t) => `${fmtTime(t.at)} - ${fmtNum(t.endTemp)} °C` },
      { title: "Durée", w: 13, get: (t) => (Number.isFinite(t.minutes) ? `${t.minutes} min` : "") },
      { title: "Conforme", w: 15, get: (t) => (t.ok ? "Oui" : "NON"), color: (t) => (t.ok ? null : RED) },
      { title: "Action corrective / commentaire", w: 55, get: (t) => [t.action, t.comment].filter(Boolean).join(" - ") },
      { title: "Par", w: 12, get: (t) => t.by },
    ],
    rows,
    M + 16
  );
  return finish(ctx.doc, shop);
}

export async function pdfCleaning(data, from, to) {
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("Plan de nettoyage et de désinfection", period(from, to), shop);
  const freq = { service: "Après chaque service", daily: "Tous les jours", weekly: "Toutes les semaines", monthly: "Tous les mois" };
  await table(
    ctx,
    [
      { title: "À nettoyer", w: 60, get: (t) => t.name },
      { title: "Fréquence", w: 35, get: (t) => freq[t.freq] },
      { title: "Produit", w: 60, get: (t) => t.product },
    ],
    [...data.cleanTasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    M + 12
  );
  ctx.doc.addPage();
  ctx.header();
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(11);
  ctx.doc.text("Enregistrements", M, M + 14);
  ctx.doc.setFont("helvetica", "normal");
  await table(
    ctx,
    [
      { title: "Date", w: 22, get: (l) => fmtDate(l.at) },
      { title: "Heure", w: 14, get: (l) => fmtTime(l.at) },
      { title: "Tâche", w: 70, get: (l) => l.name },
      { title: "Produit", w: 50, get: (l) => l.product },
      { title: "Par", w: 15, get: (l) => l.by },
    ],
    data.cleanLogs.filter((t) => inPeriod(t.at, from, to)).sort(sortAt),
    M + 18
  );
  return finish(ctx.doc, shop);
}
