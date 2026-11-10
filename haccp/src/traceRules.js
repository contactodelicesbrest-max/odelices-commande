// Règles de date limite d'un enregistrement de traçabilité (utilisées partout :
// écrans, alertes, étiquettes imprimées, récap du service).
import { dayKey } from "./utils.js";

// Produit congelé par le restaurant AVANT sa DLC : la DLC d'origine ne s'applique plus
// (ni pendant la congélation, ni après la décongélation où l'on applique J+3).
export const frozenInTime = (t) => {
  if (t.kind === "frozen") return !t.dlc || t.dlcType === "DDM" || dayKey(t.at) <= t.dlc;
  if (t.kind === "thawed" && t.frozenAt) return !t.dlc || t.dlcType === "DDM" || dayKey(t.frozenAt) <= t.dlc;
  return false;
};

// Date limite effective : la plus proche entre la DLC d'origine et la durée après
// ouverture/fabrication/décongélation (la DLC d'origine est ignorée si congelé à temps).
export const effectiveDlc = (t) => {
  if (frozenInTime(t)) return t.dlcAfter || null;
  const ds = [t.dlcType === "DDM" ? null : t.dlc, t.dlcAfter].filter(Boolean).sort();
  return ds[0] || null;
};
