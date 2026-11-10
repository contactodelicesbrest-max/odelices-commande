import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Chips, Badge } from "./ui.jsx";
import { dayKey, daysUntil, fmtDate, momentOfDay, todayKey } from "./utils.js";
import { effectiveDlc, dlcLabel, dlcTone } from "./Tracabilite.jsx";

export const SALADETTE_RULE =
  "Saladette à +4 °C maximum pendant le service (relève sa température). À la commande : réchauffer à la plancha jusqu'à +63 °C à cœur. En fin de service : remettre aussitôt au frigo ce qui reste si la saladette est restée à +4 °C, sinon jeter. Ne jamais dépasser la date limite du lot ; ce qui a été réchauffé et non servi est jeté.";

// Lots sortis en saladette pour un service donné (aujourd'hui)
export const inSaladette = (t, moment = momentOfDay()) =>
  (t.saladette || []).some((e) => dayKey(e.at) === todayKey() && e.moment === moment);

export default function MiseEnPlace({ onClose }) {
  const { data, saveMany } = useData();
  const [moment, setMoment] = useState(momentOfDay());
  const lots = useMemo(
    () =>
      data.trace
        .filter((t) => t.status === "open" && (t.kind === "homemade" || t.kind === "thawed"))
        .map((t) => ({ t, d: effectiveDlc(t) }))
        .sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999")),
    [data.trace]
  );
  const [sel, setSel] = useState(() => new Set(lots.filter(({ t, d }) => inSaladette(t, momentOfDay()) && !(d && daysUntil(d) < 0)).map(({ t }) => t.id)));
  const hasSaladette = data.equipments.some((e) => e.type === "saladette" || e.type === "vitrine");

  const submit = async () => {
    const at = new Date().toISOString();
    const by = data.settings.operator || "";
    const changed = lots
      .filter(({ t }) => sel.has(t.id) && !inSaladette(t, moment))
      .map(({ t }) => ({ ...t, saladette: [...(t.saladette || []), { at, moment, by }] }));
    if (changed.length) await saveMany("trace", changed);
    onClose();
  };

  return (
    <Sheet
      title="Mise en place saladette"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={submit}>
          <CheckCircle2 size={20} /> Valider ({sel.size} lot(s) en saladette)
        </button>
      }
    >
      <Chips options={["Matin", "Soir"]} value={moment} onChange={(v) => v && setMoment(v)} />
      <div className="alert info">ℹ️ {SALADETTE_RULE}</div>
      {!hasSaladette && (
        <div className="alert warn">Ajoute ta saladette dans Réglages → Frigos (type « Saladette / tour réfrigéré ») pour relever sa température matin et soir.</div>
      )}
      {!lots.length && <p className="muted">Aucun lot de viande cuite ou de sauce maison en cours. Enregistre d'abord une cuisson (Accueil → Cuisson viande) ou une sauce.</p>}
      <div className="checks">
        {lots.map(({ t, d }) => {
          const expired = d && daysUntil(d) < 0;
          return (
            <label key={t.id} className={"check" + (expired ? " bad" : "")}>
              <input
                type="checkbox"
                disabled={expired}
                checked={sel.has(t.id)}
                onChange={(e) =>
                  setSel((s) => {
                    const n = new Set(s);
                    e.target.checked ? n.add(t.id) : n.delete(t.id);
                    return n;
                  })
                }
              />
              <span className="list-main">
                <strong>{t.product}</strong>
                <span className="muted small">
                  {t.kind === "thawed" ? "Décongelé" : "Préparé"} le {fmtDate(t.at)}
                  {inSaladette(t, moment) ? " · déjà en saladette" : ""}
                </span>
                {d && <Badge tone={dlcTone(d)}>{expired ? "PÉRIMÉ — à jeter" : dlcLabel(d)}</Badge>}
              </span>
            </label>
          );
        })}
      </div>
    </Sheet>
  );
}
