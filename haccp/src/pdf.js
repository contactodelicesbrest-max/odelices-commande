import { jsPDF } from "jspdf";
import { loadPhoto } from "./store.jsx";
import { fmtDate, fmtTime, fmtNum, dayKey } from "./utils.js";
import { EQUIP_TYPES } from "./db.js";

const M = 12; // marge (mm)

// Dossier complet : quand « shared » est défini, chaque rapport s'ajoute au même PDF.
let shared = null;

function makeDoc(title, subtitle, shopName) {
  if (shared) {
    shared.doc.addPage();
    shared.title = title;
    shared.subtitle = subtitle;
    shared.header();
    shared.sections.push({ title, page: shared.doc.getNumberOfPages() });
    return shared;
  }
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const ctx = { doc, W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight(), title, subtitle, sections: [] };
  ctx.header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${shopName} - ${ctx.title}`, M, M + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(ctx.subtitle, M, M + 7);
    doc.setTextColor(0);
  };
  ctx.header();
  return ctx;
}

function finish(doc, shopName) {
  if (shared) return null;
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
      { title: "Fin / mesure", w: 25, get: (t) => `${fmtTime(t.at)} - ${Number.isFinite(t.endTemp) ? fmtNum(t.endTemp) + " °C" : "auto (non mesuré)"}` },
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

// ---------- Registres : thermomètres, nuisibles, formation, réclamations ----------
const REG_INCIDENT = { client: "Réclamation client", fournisseur: "Problème fournisseur / produit", equipement: "Panne d'équipement", autre: "Autre" };

export async function pdfRegisters(data, from, to) {
  const shop = data.settings.shopName || "O'Délices";
  const regs = data.registers || [];
  const next = (title, sub) => {
    if (shared) return makeDoc(title, sub, shop);
    ctx.doc.addPage();
    ctx.title = title;
    ctx.subtitle = sub;
    ctx.header();
    return ctx;
  };
  const ctx = makeDoc("Vérification des thermomètres", period(from, to) + " - test mensuel dans la glace fondante (0 °C), écart toléré ±1 °C", shop);
  await table(
    ctx,
    [
      { title: "Date", w: 22, get: (r) => fmtDate(r.at) },
      { title: "Thermomètre", w: 45, get: (r) => r.thermometer },
      { title: "Méthode", w: 40, get: (r) => (r.method === "boil" ? "Eau bouillante (100 °C)" : "Glace fondante (0 °C)") },
      { title: "Lu", w: 18, get: (r) => `${fmtNum(r.reading)} °C` },
      { title: "Écart", w: 18, get: (r) => `${fmtNum(r.gap)} °C`, color: (r) => (r.ok ? null : RED) },
      { title: "Conforme", w: 18, get: (r) => (r.ok ? "Oui" : "NON"), color: (r) => (r.ok ? null : RED) },
      { title: "Action", w: 60, get: (r) => r.action },
      { title: "Par", w: 15, get: (r) => r.by },
    ],
    regs.filter((r) => r.type === "thermo" && inPeriod(r.at, from, to)).sort(sortAt),
    M + 12
  );

  const pc = data.settings.pestContract;
  next("Lutte contre les nuisibles", pc?.company ? `Contrat avec ${pc.company}${pc.freq ? ` (${pc.freq})` : ""}${pc.ref ? ` - n° ${pc.ref}` : ""} - passages et rapports dans le registre de sécurité` : period(from, to));
  await table(
    ctx,
    [
      { title: "Rapport", w: 22, img: (r) => loadPhoto(r.photoId) },
      { title: "Date", w: 22, get: (r) => fmtDate(r.at) },
      { title: "Type", w: 35, get: (r) => (r.kind === "visit" ? "Passage société" : "Observation interne") },
      { title: "Société", w: 40, get: (r) => r.company },
      { title: "Observations", w: 75, get: (r) => r.observation },
      { title: "Action", w: 55, get: (r) => r.action },
      { title: "Par", w: 15, get: (r) => r.by },
    ],
    regs.filter((r) => r.type === "pests" && inPeriod(r.at, from, to)).sort(sortAt),
    M + 12
  );

  next("Formation du personnel à l'hygiène", "Liste à jour (toutes dates)");
  await table(
    ctx,
    [
      { title: "Attestation", w: 22, img: (r) => loadPhoto(r.photoId) },
      { title: "Nom", w: 45, get: (r) => r.person },
      { title: "Poste", w: 35, get: (r) => r.role },
      { title: "Formation", w: 60, get: (r) => r.course },
      { title: "Organisme", w: 50, get: (r) => r.org },
      { title: "Date", w: 25, get: (r) => fmtDate(r.at) },
    ],
    regs.filter((r) => r.type === "training").sort(sortAt),
    M + 12
  );

  next("Réclamations, incidents et non-conformités", period(from, to));
  await table(
    ctx,
    [
      { title: "Photo", w: 22, img: (r) => loadPhoto(r.photoId) },
      { title: "Date", w: 22, get: (r) => fmtDate(r.at) },
      { title: "Type", w: 40, get: (r) => REG_INCIDENT[r.category] || r.category },
      { title: "Description", w: 80, get: (r) => r.description },
      { title: "Action / suite donnée", w: 70, get: (r) => r.action },
      { title: "Clos", w: 14, get: (r) => (r.closed ? "Oui" : "Non"), color: (r) => (r.closed ? null : RED) },
      { title: "Par", w: 15, get: (r) => r.by },
    ],
    regs.filter((r) => r.type === "incident" && inPeriod(r.at, from, to)).sort(sortAt),
    M + 12
  );
  return finish(ctx.doc, shop);
}

// ---------- Tableau des allergènes (affichage / remise au client) ----------
export async function pdfAllergens(data) {
  const { ALLERGENS, DISH_GROUPS } = await import("./allergens.js");
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("Allergènes présents dans nos plats", `Mis à jour le ${fmtDate(new Date())} - règlement (UE) 1169/2011 - X = contient, (x) = peut contenir (traces)`, shop);
  const doc = ctx.doc;
  const dishes = [...data.dishes].sort((a, b) => DISH_GROUPS.indexOf(a.group) - DISH_GROUPS.indexOf(b.group) || (a.order ?? 0) - (b.order ?? 0));
  const nameW = 70;
  const colW = (ctx.W - 2 * M - nameW) / ALLERGENS.length;
  let y = M + 14;
  const head = () => {
    doc.setFillColor(28, 25, 23);
    doc.rect(M, y, ctx.W - 2 * M, 26, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    ALLERGENS.forEach((a, i) => doc.text(a.label, M + nameW + i * colW + colW / 2 + 1.3, y + 24.5, { angle: 90 }));
    doc.setDrawColor(90);
    ALLERGENS.forEach((a, i) => doc.line(M + nameW + i * colW, y + 2, M + nameW + i * colW, y + 26));
    doc.setTextColor(0);
    y += 26;
  };
  head();
  let zebra = false;
  let lastGroup = "";
  for (const d of dishes) {
    if (y > ctx.H - 16) {
      doc.addPage();
      ctx.header();
      y = M + 14;
      head();
    }
    if (d.group !== lastGroup) {
      lastGroup = d.group;
      doc.setFillColor(231, 229, 228);
      doc.rect(M, y, ctx.W - 2 * M, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(d.group.toUpperCase(), M + 1.5, y + 4.3);
      y += 6;
    }
    if (zebra) {
      doc.setFillColor(250, 250, 249);
      doc.rect(M, y, ctx.W - 2 * M, 6.5, "F");
    }
    zebra = !zebra;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(d.name + (d.verified ? "" : " *"), M + 1.5, y + 4.6);
    ALLERGENS.forEach((a, i) => {
      const cx = M + nameW + i * colW + colW / 2;
      if (d.allergens?.includes(a.id)) {
        doc.setFillColor(253, 230, 138);
        doc.rect(cx - colW / 2 + 0.3, y + 0.3, colW - 0.6, 5.9, "F");
        doc.setFont("helvetica", "bold");
        doc.text("X", cx, y + 4.6, { align: "center" });
        doc.setFont("helvetica", "normal");
      } else if (d.traces?.includes(a.id)) doc.text("(x)", cx, y + 4.6, { align: "center" });
    });
    doc.setDrawColor(225);
    doc.line(M, y + 6.5, ctx.W - M, y + 6.5);
    y += 6.5;
  }
  doc.setFontSize(8);
  doc.setTextColor(90);
  if (dishes.some((d) => !d.verified)) doc.text("* à vérifier avec l'étiquette du produit", M, Math.min(y + 6, ctx.H - 10));
  doc.text("Pour toute question sur les allergènes, adressez-vous au personnel.", M, Math.min(y + 11, ctx.H - 10));
  doc.setTextColor(0);
  return finish(doc, shop);
}

// ---------- Dossier complet pour un contrôle sanitaire ----------
export async function pdfDossier(data, from, to, { photos = true } = {}) {
  const shop = data.settings.shopName || "O'Délices";
  const ctx = makeDoc("Dossier Plan de Maîtrise Sanitaire", period(from, to), shop);
  const doc = ctx.doc;
  shared = ctx;
  try {
    await pdfTemperatures(data, from, to);
    await pdfProcess(data, from, to);
    await pdfTrace(data, from, to, photos);
    await pdfOil(data, from, to);
    await pdfCleaning(data, from, to);
    await pdfRegisters(data, from, to);
    await pdfAllergens(data);
  } finally {
    shared = null;
  }
  // Page de garde + sommaire (page 1)
  doc.setPage(1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(shop, M, 45);
  doc.setFontSize(14);
  doc.text("Registres d'hygiène (HACCP) - dossier pour contrôle sanitaire", M, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(period(from, to), M, 64);
  doc.text(`Édité le ${fmtDate(new Date())} à ${fmtTime(new Date())}${data.settings.operator ? ` par ${data.settings.operator}` : ""}`, M, 71);
  doc.setFont("helvetica", "bold");
  doc.text("Sommaire", M, 88);
  doc.setFont("helvetica", "normal");
  let y = 96;
  const seen = new Set();
  for (const s of ctx.sections) {
    if (seen.has(s.title)) continue;
    seen.add(s.title);
    doc.text(s.title, M + 4, y);
    doc.text(`page ${s.page}`, ctx.W - M - 30, y);
    y += 7;
  }
  const counts = [
    ["Relevés de températures", data.temps.filter((t) => inPeriod(t.at, from, to)).length],
    ["Produits tracés", data.trace.filter((t) => inPeriod(t.at, from, to)).length],
    ["Contrôles cuisson / refroidissement", data.process.filter((t) => t.state === "done" && inPeriod(t.at, from, to)).length],
    ["Contrôles / changements d'huile", data.oil.filter((t) => inPeriod(t.at, from, to)).length],
    ["Nettoyages enregistrés", data.cleanLogs.filter((t) => inPeriod(t.at, from, to)).length],
  ];
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(counts.map(([l, n]) => `${l} : ${n}`).join("   -   "), M, y);
  doc.setTextColor(0);
  return finish(doc, shop);
}
