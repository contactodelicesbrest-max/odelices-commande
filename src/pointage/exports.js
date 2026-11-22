import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import {
  JOURS, MOIS, addDays, parseIso, iso, fmtDateLong, isoWeek, normWeek,
  dayMinutes, dayMinutesRaw, weekMinutes, mergeWeek, toDecimal, ABSENCES, fmtH, mondayFromPlanning, mondaysOfMonth,
} from "./time.js";
import { analyseSemaine, cfgOf, contratOf, round2, TRANCHE_LABELS } from "./paie.js";

const nomComplet = (e) => `${(e.nom || "").toUpperCase()} ${e.prenom || ""}`.trim();

// ---------- Enregistrer / partager un fichier ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Sur le téléphone (APK) : ouvre le menu de partage (Gmail, WhatsApp, Drive…). Sur navigateur : téléchargement. */
export async function saveFile(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, url: res.uri, dialogTitle: "Envoyer l'export" });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- Construction des données du mois ----------

/**
 * Pour chaque salarié et chaque jour du mois : heures signées (pointage)
 * ou, à défaut, heures prévues au planning (marquées « non signé »).
 */
export function buildMonth({ year, month, employes, planning, pointages, signatures, config }) {
  const cfg = cfgOf(config);
  const mondays = mondaysOfMonth(year, month);
  const rows = []; // détail par jour
  const recap = [];
  const horsPaie = [];

  Object.entries(employes || {}).forEach(([id, e]) => {
    if (e.horsPaie) { horsPaie.push(e); return; }
    const paie = { net: 0, brut: 0, cout: 0, repas: 0, parts: {}, alertes: [] };
    const sg = signatures?.[id] || null;
    const signe = !!sg?.signature;
    let totalMois = 0;
    let totalPrevuMois = 0;
    const absJours = { CP: 0, MAL: 0, ABS: 0, FER: 0 };
    const absMinutes = { CP: 0, MAL: 0, ABS: 0, FER: 0 };
    const semaines = [];
    mondays.forEach((mon) => {
      const pt = pointages?.[mon]?.[id];
      const pl = normWeek(planning?.[mon]?.[id]?.days);
      const reel = pt?.days ? mergeWeek(pl, pt.days) : null;
      let minSemaineDansMois = 0;
      const monDate = parseIso(mon);
      const an = analyseSemaine(reel || pl, e, cfg);
      // Heures sup / complémentaires : semaine rattachée au mois où elle se termine (dimanche)
      const finDansMois = addDays(monDate, 6).getMonth() === month;
      if (finDansMois) {
        Object.entries(an.tot.parts).forEach(([k, v]) => (paie.parts[k] = (paie.parts[k] || 0) + v));
        an.alertes.forEach((a) => paie.alertes.push(`Sem. du ${fmtDateLong(monDate).slice(0, 5)} : ${a}`));
      }
      for (let i = 0; i < 7; i++) {
        const date = addDays(monDate, i);
        if (date.getMonth() !== month) continue;
        const day = reel ? reel[i] : pl[i];
        paie.net += an.jours[i].net;
        paie.brut += an.jours[i].brut;
        paie.cout += an.jours[i].cout;
        paie.repas += an.jours[i].repas;
        const min = dayMinutes(day);
        const prev = dayMinutes(pl[i]);
        minSemaineDansMois += min;
        totalPrevuMois += prev;
        if (day.abs) {
          absJours[day.abs] = (absJours[day.abs] || 0) + 1;
          absMinutes[day.abs] = (absMinutes[day.abs] || 0) + dayMinutesRaw(day);
        }
        if (min > 0 || prev > 0 || day.abs) {
          rows.push({
            Salarié: nomComplet(e),
            Date: fmtDateLong(date),
            Jour: JOURS[i],
            "Midi début": day.abs ? "" : day.m.d, "Midi fin": day.abs ? "" : day.m.f,
            "Soir début": day.abs ? "" : day.s.d, "Soir fin": day.abs ? "" : day.s.f,
            "Heures prévues": toDecimal(prev),
            "Heures réalisées": toDecimal(min),
            "Absence / congé": day.abs ? ABSENCES[day.abs]?.label || day.abs : "",
            "Heures non travaillées": day.abs ? toDecimal(dayMinutesRaw(day)) : "",
            Statut: signe ? "Signé" : "NON SIGNÉ",
          });
        }
      }
      totalMois += minSemaineDansMois;
      semaines.push({
        mon,
        minutesSemaine: reel ? weekMinutes(reel) : weekMinutes(pl),
        minutesDansMois: minSemaineDansMois,
        days: reel || pl,
        analyse: an,
        finDansMois,
      });
    });
    ["net", "brut", "cout"].forEach((k) => (paie[k] = round2(paie[k])));
    recap.push({ id, employe: e, signe, sg, semaines, totalMois, totalPrevuMois, absJours, absMinutes, paie, contrat: contratOf(e), taux: semaines[0]?.analyse.taux });
  });
  return { mondays, rows, recap, horsPaie, cfg };
}

// ---------- Export Excel pour le comptable ----------

export function excelBlob(data, { year, month }) {
  const { rows, recap, cfg } = data;
  const wb = XLSX.utils.book_new();

  // 1) Variables de paie : ce que le comptable saisit directement
  const vars = recap.map((r) => {
    const o = {
      Salarié: nomComplet(r.employe),
      "Contrat (h/sem)": r.contrat,
      "Base mensualisée (h)": round2((r.contrat * 52) / 12),
      [`Heures travaillées ${MOIS[month]}`]: toDecimal(r.totalMois),
    };
    Object.entries(TRANCHE_LABELS).forEach(([k, l]) => {
      if (k.startsWith("hc") && r.contrat >= 35) return;
      o[l] = toDecimal(r.paie.parts[k] || 0);
    });
    o["Jours CP"] = r.absJours.CP || 0;
    o["Jours maladie"] = r.absJours.MAL || 0;
    o["Heures maladie"] = toDecimal(r.absMinutes.MAL || 0);
    o["Jours absence"] = r.absJours.ABS || 0;
    o["Heures absence"] = toDecimal(r.absMinutes.ABS || 0);
    o["Jours fériés chômés"] = r.absJours.FER || 0;
    o["Nb repas (avantage nature)"] = r.paie.repas;
    o["Valeur repas (€)"] = round2(r.paie.repas * cfg.valeurRepas);
    o["Taux horaire net (€)"] = r.taux;
    o["Net estimé (€)"] = r.paie.net;
    o["Brut estimé (€)"] = r.paie.brut;
    o["Coût employeur estimé (€)"] = r.paie.cout;
    o["Mois signé"] = r.signe ? `Oui (${new Date(r.sg.signeLe).toLocaleDateString("fr-FR")})` : "NON";
    o["Alertes"] = r.paie.alertes.join(" | ");
    return o;
  });
  const ws0 = XLSX.utils.json_to_sheet(vars);
  ws0["!cols"] = Object.keys(vars[0] || {}).map((k, i) => ({ wch: i === 0 ? 22 : k === "Alertes" ? 60 : 15 }));
  XLSX.utils.book_append_sheet(wb, ws0, "Variables de paie");

  // 2) Détail par semaine (heures sup)
  const sem = [];
  recap.forEach((r) =>
    r.semaines.forEach((s) => {
      const m = parseIso(s.mon);
      const o = {
        Salarié: nomComplet(r.employe),
        Semaine: `S${isoWeek(m)} du ${fmtDateLong(m)} au ${fmtDateLong(addDays(m, 6))}`,
        "Rattachée à": s.finDansMois ? MOIS[month] : "mois précédent",
        "Heures travaillées": toDecimal(s.analyse.tot.min),
        "Heures normales": toDecimal(s.analyse.tot.parts.normal || 0),
      };
      Object.entries(TRANCHE_LABELS).forEach(([k, l]) => (o[l] = toDecimal(s.analyse.tot.parts[k] || 0)));
      o["Repas"] = s.analyse.tot.repas;
      o["Coût employeur (€)"] = s.analyse.tot.cout;
      o["Alertes"] = s.analyse.alertes.join(" | ");
      sem.push(o);
    })
  );
  const wsS = XLSX.utils.json_to_sheet(sem);
  wsS["!cols"] = Object.keys(sem[0] || {}).map((k, i) => ({ wch: i === 0 ? 22 : i === 1 ? 32 : k === "Alertes" ? 60 : 14 }));
  XLSX.utils.book_append_sheet(wb, wsS, "Semaines");

  // 3) Paramètres utilisés
  const wsP = XLSX.utils.aoa_to_sheet([
    ["Paramètres de calcul (estimations — le comptable fait foi)"],
    ["Taux horaire net par défaut (€)", cfg.tauxNetDefaut],
    ["Charges salariales (%)", cfg.tauxSal],
    ["Charges patronales après réductions (%)", cfg.tauxPat],
    ["Valeur d'un repas (€)", cfg.valeurRepas],
    ["SMIC horaire brut (€)", cfg.smicBrut],
    ["Heures sup temps plein (HCR)", "36e-39e h +10 %, 40e-43e h +20 %, 44e h et + +50 %"],
    ["Heures complémentaires temps partiel", "+10 % jusqu'à 1/10e du contrat, +25 % au-delà"],
    ["Rattachement des heures sup", "semaine rattachée au mois de son dimanche"],
    ["Repas", "1 repas par service (midi / soir) travaillé"],
    ...(data.horsPaie?.length ? [["Exclus (hors paie)", data.horsPaie.map(nomComplet).join(", ")]] : []),
  ]);
  wsP["!cols"] = [{ wch: 42 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsP, "Paramètres");

  const recapRows = recap.map((r) => {
    const o = { Salarié: nomComplet(r.employe) };
    if (r.employe.contrat) o["Contrat (h/sem)"] = Number(r.employe.contrat);
    r.semaines.forEach((s) => {
      const m = parseIso(s.mon);
      o[`S${isoWeek(m)} (${fmtDateLong(m).slice(0, 5)})`] = toDecimal(s.minutesSemaine);
    });
    o[`Total ${MOIS[month]} (h)`] = toDecimal(r.totalMois);
    o["Total prévu (h)"] = toDecimal(r.totalPrevuMois);
    Object.entries(ABSENCES).forEach(([k, a]) => {
      o[`Jours ${a.label}`] = r.absJours[k] || 0;
      o[`Heures ${a.label}`] = toDecimal(r.absMinutes[k] || 0);
    });
    o["Mois signé"] = r.signe ? "Oui" : "NON";
    return o;
  });
  const ws1 = XLSX.utils.json_to_sheet(recapRows);
  ws1["!cols"] = [{ wch: 22 }, ...Object.keys(recapRows[0] || {}).slice(1).map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, ws1, "Récap mois");

  const ws2 = XLSX.utils.json_to_sheet(rows);
  ws2["!cols"] = [{ wch: 22 }, { wch: 11 }, { wch: 10 }, ...Array(4).fill({ wch: 10 }), { wch: 14 }, { wch: 15 }, { wch: 16 }, { wch: 20 }, { wch: 11 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Détail jours");

  const sig = recap.map((r) => ({
    Salarié: nomComplet(r.employe),
    Mois: `${MOIS[month]} ${year}`,
    "Heures du mois": toDecimal(r.totalMois),
    Signé: r.signe ? "Oui" : "NON",
    "Signé le": r.signe ? new Date(r.sg.signeLe).toLocaleString("fr-FR") : "",
    Commentaire: r.sg?.commentaire || "",
  }));
  const ws3 = XLSX.utils.json_to_sheet(sig);
  ws3["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 7 }, { wch: 20 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Signatures");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export const excelName = ({ year, month }) => `Pointage_${MOIS[month]}_${year}.xlsx`;

export function exportExcel(data, opts) {
  return saveFile(excelBlob(data, opts), excelName(opts));
}

// ---------- Export PDF (feuilles d'heures signées) ----------

export function exportPdf(data, { year, month }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let first = true;
  data.recap.forEach((r) => {
    if (!first) doc.addPage();
    first = false;
    let y = 16;
    doc.setFont("helvetica", "bold").setFontSize(15);
    doc.text(`Feuille d'heures — ${MOIS[month]} ${year}`, 14, y);
    y += 7;
    doc.setFontSize(12).text(nomComplet(r.employe), 14, y);
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(`Total du mois : ${fmtH(r.totalMois)} (${toDecimal(r.totalMois).toString().replace(".", ",")} h)`, 196, y, { align: "right" });
    const abs = Object.entries(ABSENCES).filter(([k]) => r.absJours[k]).map(([k, a]) => `${a.label} : ${r.absJours[k]} j`);
    if (abs.length) { y += 5; doc.text(abs.join("   ·   "), 196, y, { align: "right" }); }
    y += 6;

    r.semaines.forEach((s) => {
      if (y > 235) {
        doc.addPage();
        doc.setFont("helvetica", "bold").setFontSize(11).text(`${nomComplet(r.employe)} — ${MOIS[month]} ${year} (suite)`, 14, 14);
        doc.setFont("helvetica", "normal").setFontSize(10);
        y = 22;
      }
      const m = parseIso(s.mon);
      doc.setDrawColor(180).line(14, y, 196, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(`Semaine ${isoWeek(m)} — du ${fmtDateLong(m)} au ${fmtDateLong(addDays(m, 6))}`, 14, y);
      doc.text(`${fmtH(s.minutesDansMois)}`, 196, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5;
      s.days.forEach((d, i) => {
        const min = dayMinutes(d);
        const date = addDays(m, i);
        if (date.getMonth() !== month) return;
        if (d.abs) {
          doc.text(`${JOURS[i]} ${fmtDateLong(date).slice(0, 5)}`, 18, y);
          doc.setFont("helvetica", "bold").text(ABSENCES[d.abs]?.label || d.abs, 60, y);
          doc.setFont("helvetica", "normal");
          y += 4.6;
          return;
        }
        if (!min) return;
        const parts = [];
        if (d.m.d && d.m.f) parts.push(`${d.m.d}-${d.m.f}`);
        if (d.s.d && d.s.f) parts.push(`${d.s.d}-${d.s.f}`);
        doc.text(`${JOURS[i]} ${fmtDateLong(date).slice(0, 5)}`, 18, y);
        doc.text(parts.join("  /  "), 60, y);
        doc.text(fmtH(min), 120, y);
        y += 4.6;
      });
      y += 2;
    });

    // Signature du mois
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setDrawColor(180).line(14, y, 196, y);
    y += 6;
    doc.setFontSize(9).text(`Je certifie que ces heures (${fmtH(r.totalMois)}) correspondent au travail effectué en ${MOIS[month].toLowerCase()} ${year}.`, 14, y);
    y += 5;
    if (r.sg?.commentaire) { doc.text(`Commentaire : ${r.sg.commentaire}`.slice(0, 120), 14, y); y += 5; }
    doc.setFontSize(10);
    if (r.signe) {
      try { doc.addImage(r.sg.signature, "PNG", 14, y, 60, 20); } catch { /* image invalide */ }
      doc.setFontSize(8).text(`Signé le ${new Date(r.sg.signeLe).toLocaleString("fr-FR")}`, 14, y + 24);
      doc.setFontSize(10);
    } else {
      doc.setTextColor(200, 40, 40).setFont("helvetica", "bold").text("MOIS NON SIGNÉ", 14, y + 6);
      doc.setTextColor(0).setFont("helvetica", "normal");
    }
  });
  return saveFile(doc.output("blob"), `Feuilles_heures_${MOIS[month]}_${year}.pdf`);
}

// ---------- Import du planning Excel (même modèle que le fichier actuel) ----------

function cellTime(v) {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") {
    const min = Math.round((v % 1) * 1440);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }
  const m = String(v).match(/(\d{1,2})[:hH](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Lit chaque onglet : A1 = année, B2 = n° de semaine, lignes 10 à 39 (2 lignes par salarié : midi / soir). */
export async function parsePlanningFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const weeks = {}; // lundi -> [{nom, prenom, days}]
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const v = (addr) => ws[addr]?.v;
    const annee = Number(v("A1"));
    const sem = Number(v("B2"));
    if (!annee || !sem) return;
    const mon = iso(mondayFromPlanning(annee, sem));
    const list = [];
    for (let r = 10; r <= 39; r += 2) {
      const nom = v(`A${r}`);
      if (!nom) continue;
      const prenom = v(`B${r}`) || "";
      const days = [];
      for (let i = 0; i < 7; i++) {
        const c1 = XLSX.utils.encode_col(3 + 2 * i);
        const c2 = XLSX.utils.encode_col(4 + 2 * i);
        days.push({
          m: { d: cellTime(v(`${c1}${r}`)), f: cellTime(v(`${c2}${r}`)) },
          s: { d: cellTime(v(`${c1}${r + 1}`)), f: cellTime(v(`${c2}${r + 1}`)) },
        });
      }
      list.push({ nom: String(nom).trim(), prenom: String(prenom).trim(), days });
    }
    if (list.length) weeks[mon] = list;
  });
  return weeks;
}
