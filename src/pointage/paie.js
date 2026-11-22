// Calculs « paie » : heures supplémentaires (convention HCR), repas, coût employeur estimé, alertes légales.
// ⚠️ Estimations pour piloter le restaurant : les montants exacts sont ceux calculés par le comptable.
import { dayMinutes, dayMinutesRaw, slotMinutes } from "./time.js";

export const DEFAULT_CFG = {
  tauxNetDefaut: 9.75, // taux horaire net du planning Excel (case G44)
  tauxSal: 22, // % de charges salariales (net -> brut : brut = net / (1 - 22 %))
  tauxPat: 15, // % de charges patronales APRÈS réduction générale (bas salaires) — à ajuster avec le comptable
  valeurRepas: 4.22, // avantage en nature repas HCR (valeur 2025, à mettre à jour chaque 1er janvier)
  smicBrut: 12.02, // SMIC horaire brut (à vérifier / mettre à jour)
};

export const cfgOf = (config) => ({ ...DEFAULT_CFG, ...(config?.paie || {}) });

/** Contrat en heures / semaine (35 h si non renseigné). */
export const contratOf = (e) => {
  const c = Number(String(e?.contrat || "").replace(",", "."));
  return c > 0 ? c : 35;
};

export const tauxNetOf = (e, cfg) => {
  const t = Number(String(e?.tauxNet || "").replace(",", "."));
  return t > 0 ? t : cfg.tauxNetDefaut;
};

/** Multiplicateur net -> coût employeur. */
export const coutFactor = (cfg) => (1 / (1 - cfg.tauxSal / 100)) * (1 + cfg.tauxPat / 100);
export const brutFactor = (cfg) => 1 / (1 - cfg.tauxSal / 100);
export const smicNet = (cfg) => Math.round(cfg.smicBrut * (1 - cfg.tauxSal / 100) * 100) / 100;

/**
 * Tranches de majoration selon le contrat (en minutes cumulées sur la semaine, lundi -> dimanche).
 * Temps plein (HCR) : 36e-39e h +10 %, 40e-43e h +20 %, 44e h et plus +50 %.
 * Temps partiel : heures complémentaires +10 % jusqu'à 1/10e du contrat, +25 % au-delà.
 */
function tranches(contrat) {
  const H = (h) => Math.round(h * 60);
  if (contrat >= 35) {
    return [
      { key: "normal", from: 0, to: H(35), maj: 0 },
      { key: "hs10", from: H(35), to: H(39), maj: 0.1 },
      { key: "hs20", from: H(39), to: H(43), maj: 0.2 },
      { key: "hs50", from: H(43), to: Infinity, maj: 0.5 },
    ];
  }
  return [
    { key: "normal", from: 0, to: H(contrat), maj: 0 },
    { key: "hc10", from: H(contrat), to: H(contrat * 1.1), maj: 0.1 },
    { key: "hc25", from: H(contrat * 1.1), to: H(35), maj: 0.25 },
    { key: "hs10", from: H(35), to: H(39), maj: 0.1 },
    { key: "hs20", from: H(39), to: H(43), maj: 0.2 },
    { key: "hs50", from: H(43), to: Infinity, maj: 0.5 },
  ];
}

export const TRANCHE_LABELS = {
  hc10: "H. complémentaires +10 %",
  hc25: "H. complémentaires +25 %",
  hs10: "H. sup +10 %",
  hs20: "H. sup +20 %",
  hs50: "H. sup +50 %",
};

const PAYES = ["CP", "FER"]; // absences payées (maintien de salaire) — non comptées comme travail effectif

/**
 * Analyse d'une semaine pour un salarié.
 * Retourne, jour par jour : minutes travaillées, répartition par tranche, minutes payées non travaillées,
 * repas, montants net / brut / coût employeur ; + totaux et alertes.
 */
export function analyseSemaine(days, employe, cfg) {
  const contrat = contratOf(employe);
  const taux = tauxNetOf(employe, cfg);
  const tr = tranches(contrat);
  const fCout = coutFactor(cfg);
  const fBrut = brutFactor(cfg);
  let cumul = 0;
  const jours = days.map((d) => {
    const min = dayMinutes(d);
    const parts = {};
    let reste = min;
    let net = 0;
    for (const t of tr) {
      if (reste <= 0) break;
      const dispo = Math.max(0, t.to - Math.max(cumul, t.from));
      if (cumul >= t.to) continue;
      const pris = Math.min(reste, dispo);
      if (pris > 0) {
        parts[t.key] = (parts[t.key] || 0) + pris;
        net += (pris / 60) * taux * (1 + t.maj);
        cumul += pris;
        reste -= pris;
      }
    }
    const payeNonTravaille = PAYES.includes(d.abs) ? dayMinutesRaw(d) : 0;
    net += (payeNonTravaille / 60) * taux;
    const repas = d.abs ? 0 : (slotMinutes(d.m) > 0 ? 1 : 0) + (slotMinutes(d.s) > 0 ? 1 : 0);
    const alertes = [];
    if (min > 11.5 * 60) alertes.push(`Journée de ${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")} (> 11h30 max HCR)`);
    return {
      min, parts, payeNonTravaille, repas,
      net: round2(net), brut: round2(net * fBrut), cout: round2(net * fCout),
      alertes,
    };
  });

  const tot = {
    min: sum(jours, "min"), repas: sum(jours, "repas"),
    net: round2(sum(jours, "net")), brut: round2(sum(jours, "brut")), cout: round2(sum(jours, "cout")),
    parts: {},
  };
  jours.forEach((j) => Object.entries(j.parts).forEach(([k, v]) => (tot.parts[k] = (tot.parts[k] || 0) + v)));

  const alertes = jours.flatMap((j) => j.alertes);
  if (tot.min > 48 * 60) alertes.unshift(`${Math.floor(tot.min / 60)}h${String(tot.min % 60).padStart(2, "0")} dans la semaine (> 48 h, maximum légal)`);
  // Repos : un jour sans service = 1, un jour avec un seul service (midi ou soir) = ½ journée
  const repos = days.reduce((t, d) => {
    if (d.abs) return t + 1;
    const n = (slotMinutes(d.m) > 0 ? 1 : 0) + (slotMinutes(d.s) > 0 ? 1 : 0);
    return t + (n === 0 ? 1 : n === 1 ? 0.5 : 0);
  }, 0);
  if (repos < 2 && tot.min > 0) alertes.push(`${String(repos).replace(".", ",")} jour(s) de repos (HCR : 2 jours par semaine en principe — à vérifier avec le comptable)`);
  if (taux < smicNet(cfg)) alertes.push(`Taux net ${taux} € < SMIC net estimé (${smicNet(cfg)} €)`);

  return { contrat, taux, jours, tot, alertes };
}

const sum = (arr, k) => arr.reduce((t, x) => t + (x[k] || 0), 0);
export const round2 = (n) => Math.round(n * 100) / 100;
export const euro = (n) => (n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
