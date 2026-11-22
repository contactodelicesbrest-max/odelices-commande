import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import {
  JOURS, MOIS, addDays, parseIso, iso, fmtDateLong, isoWeek, normWeek,
  dayMinutes, dayMinutesRaw, weekMinutes, toDecimal, ABSENCES, fmtH, mondayFromPlanning, mondaysOfMonth,
} from "./time.js";

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
export function buildMonth({ year, month, employes, planning, pointages }) {
  const mondays = mondaysOfMonth(year, month);
  const rows = []; // détail par jour
  const recap = [];

  Object.entries(employes).forEach(([id, e]) => {
    let totalMois = 0;
    let totalPrevuMois = 0;
    const absJours = { CP: 0, MAL: 0, ABS: 0, FER: 0 };
    const absMinutes = { CP: 0, MAL: 0, ABS: 0, FER: 0 };
    const semaines = [];
    mondays.forEach((mon) => {
      const pt = pointages?.[mon]?.[id];
      const pl = normWeek(planning?.[mon]?.[id]?.days);
      const reel = pt ? normWeek(pt.days) : null;
      const signe = !!pt?.signature;
      let minSemaineDansMois = 0;
      const monDate = parseIso(mon);
      for (let i = 0; i < 7; i++) {
        const date = addDays(monDate, i);
        if (date.getMonth() !== month) continue;
        const day = reel ? reel[i] : pl[i];
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
        signe,
        signeLe: pt?.signeLe || null,
        commentaire: pt?.commentaire || "",
        signature: pt?.signature || null,
        days: reel || pl,
      });
    });
    recap.push({ id, employe: e, semaines, totalMois, totalPrevuMois, absJours, absMinutes });
  });
  return { mondays, rows, recap };
}

// ---------- Export Excel pour le comptable ----------

export function excelBlob(data, { year, month }) {
  const { mondays, rows, recap } = data;
  const wb = XLSX.utils.book_new();

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
    o["Semaines signées"] = `${r.semaines.filter((s) => s.signe).length}/${r.semaines.length}`;
    return o;
  });
  const ws1 = XLSX.utils.json_to_sheet(recapRows);
  ws1["!cols"] = [{ wch: 22 }, ...Object.keys(recapRows[0] || {}).slice(1).map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, ws1, "Récap mois");

  const ws2 = XLSX.utils.json_to_sheet(rows);
  ws2["!cols"] = [{ wch: 22 }, { wch: 11 }, { wch: 10 }, ...Array(4).fill({ wch: 10 }), { wch: 14 }, { wch: 15 }, { wch: 16 }, { wch: 20 }, { wch: 11 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Détail jours");

  const sig = [];
  recap.forEach((r) =>
    r.semaines.forEach((s) =>
      sig.push({
        Salarié: nomComplet(r.employe),
        Semaine: `du ${fmtDateLong(parseIso(s.mon))} au ${fmtDateLong(addDays(parseIso(s.mon), 6))}`,
        "Heures semaine": toDecimal(s.minutesSemaine),
        Signé: s.signe ? "Oui" : "Non",
        "Signé le": s.signeLe ? new Date(s.signeLe).toLocaleString("fr-FR") : "",
        Commentaire: s.commentaire,
      })
    )
  );
  const ws3 = XLSX.utils.json_to_sheet(sig);
  ws3["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 7 }, { wch: 20 }, { wch: 40 }];
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
      doc.text(`${fmtH(s.minutesSemaine)}`, 196, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 5;
      s.days.forEach((d, i) => {
        const min = dayMinutes(d);
        const date = addDays(m, i);
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
      if (s.commentaire) {
        doc.setFontSize(9).text(`Commentaire : ${s.commentaire}`.slice(0, 110), 18, y);
        doc.setFontSize(10);
        y += 4.6;
      }
      if (s.signature) {
        try { doc.addImage(s.signature, "PNG", 140, y - 4, 45, 15); } catch { /* image invalide */ }
        doc.setFontSize(8).text(`Signé le ${new Date(s.signeLe).toLocaleString("fr-FR")}`, 140, y + 13);
        doc.setFontSize(10);
        y += 17;
      } else {
        doc.setTextColor(200, 40, 40).text("NON SIGNÉ", 140, y);
        doc.setTextColor(0);
        y += 6;
      }
    });
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
