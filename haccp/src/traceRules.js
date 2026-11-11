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

// ---------- Nouvelle cuisson / nouvelle fabrication d'un même produit ----------
// L'ancien lot « en cours » du même produit est clôturé (statut « Remplacé ») :
// il disparaît des listes et des alertes mais reste dans le registre (traçabilité).
const normName = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const autoReplaceOn = (settings) => settings?.autoReplaceLots !== false;

export function olderLots(trace, product, exceptId) {
  const n = normName(product);
  if (!n) return [];
  return trace.filter((t) => t.id !== exceptId && t.status === "open" && t.kind === "homemade" && normName(t.product) === n);
}

export async function replaceOlderLots(save, trace, newLot) {
  const old = olderLots(trace, newLot.product, newLot.id);
  const when = new Date(newLot.at).toLocaleDateString("fr-FR");
  for (const t of old)
    await save("trace", {
      ...t,
      status: "replaced",
      closedAt: new Date().toISOString(),
      replacedBy: newLot.id,
      comment: [t.comment, `Remplacé par le lot du ${when}`].filter(Boolean).join(" — "),
    });
  return old.length;
}
