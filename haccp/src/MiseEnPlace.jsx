import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Chips, Badge } from "./ui.jsx";
import { dayKey, daysUntil, fmtDate, momentOfDay, todayKey } from "./utils.js";
import { effectiveDlc, dlcLabel, dlcTone } from "./Tracabilite.jsx";

export const SALADETTE_RULE =
  "Saladette à +4 °C maximum pendant le service (relève sa température). À la commande : réchauffer à la plancha jusqu'à +63 °C à cœur. En fin de service : remettre aussitôt au frigo ce qui reste si la saladette est restée à +4 °C, sinon jeter. Ne jamais dépasser la date limite du lot ; ce qui a été réchauffé et non servi est jeté.";

// Lots sortis en saladette pour un service donné (aujourd'hui)
// Heure de fin de service (réglable dans Réglages, 22 h par défaut)
export const endOfServiceHour = (settings) => {
  const [h, m] = String(settings?.serviceEnd || "22:00").split(":").map(Number);
  return { h: Number.isFinite(h) ? h : 22, m: Number.isFinite(m) ? m : 0 };
};
export const isAfterServiceEnd = (settings, d = new Date()) => {
  const { h, m } = endOfServiceHour(settings);
  return d.getHours() * 60 + d.getMinutes() >= h * 60 + m;
};

export const inSaladette = (t, moment = momentOfDay()) =>
  (t.saladette || []).some((e) => dayKey(e.at) === todayKey() && e.moment === moment && !e.backAt);
// Encore en saladette maintenant (sorti aujourd'hui, pas encore remis au frigo)
export const inSaladetteNow = (t) => t.status === "open" && (t.saladette || []).some((e) => dayKey(e.at) === todayKey() && !e.backAt);

export default function MiseEnPlace({ onClose }) {
  const { data, saveMany, save } = useData();
  const nowIn = data.trace.filter(inSaladetteNow);
  const [mode, setMode] = useState(nowIn.length && isAfterServiceEnd(data.settings) ? "end" : "start");
  const [keep, setKeep] = useState(() => new Set(nowIn.map((t) => t.id)));
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

  const backToFridge = async () => {
    const at = new Date().toISOString();
    const by = data.settings.operator || "";
    const close = (t) => ({ ...t, saladette: (t.saladette || []).map((e) => (dayKey(e.at) === todayKey() && !e.backAt ? { ...e, backAt: at, backBy: by } : e)) });
    const back = nowIn.filter((t) => keep.has(t.id)).map(close);
    const thrown = nowIn
      .filter((t) => !keep.has(t.id))
      .map((t) => ({ ...close(t), status: "thrown", closedAt: at, comment: [t.comment, "Jeté en fin de service (saladette)"].filter(Boolean).join(" — ") }));
    if (back.length || thrown.length) await saveMany("trace", [...back, ...thrown]);
    onClose();
  };

  if (mode === "end")
    return (
      <Sheet
        title="Fin de service — saladette"
        onClose={onClose}
        footer={
          <button className="btn btn-primary btn-block" onClick={backToFridge} disabled={!nowIn.length}>
            <CheckCircle2 size={20} /> Remettre au frigo ({keep.size}){nowIn.length - keep.size > 0 ? ` · jeter ${nowIn.length - keep.size}` : ""}
          </button>
        }
      >
        <Chips options={[{ value: "start", label: "Mise en place" }, { value: "end", label: "Fin de service" }]} value={mode} onChange={(v) => v && setMode(v)} />
        <div className="alert info">ℹ️ Remets aussitôt au frigo ce qui reste, si la saladette est restée à +4 °C maximum. Sinon, ou si le produit a traîné hors du froid, jette-le.</div>
        {!nowIn.length && <p className="muted">Rien en saladette pour le moment.</p>}
        <div className="checks">
          {nowIn.map((t) => {
            const d = effectiveDlc(t);
            const ok = keep.has(t.id);
            return (
              <div key={t.id} className={"check" + (ok ? "" : " bad")}>
                <span className="list-main">
                  <strong>{t.product}</strong>
                  {d && <span className="muted small">{dlcLabel(d)}</span>}
                </span>
                <div className="row gap-s">
                  <button className={"btn btn-sm " + (ok ? "btn-ok" : "btn-ghost")} onClick={() => setKeep((s) => new Set([...s, t.id]))}>
                    ❄️ Frigo
                  </button>
                  <button
                    className={"btn btn-sm " + (!ok ? "btn-ko" : "btn-ghost")}
                    onClick={() =>
                      setKeep((s) => {
                        const n = new Set(s);
                        n.delete(t.id);
                        return n;
                      })
                    }
                  >
                    🗑️ Jeté
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Sheet>
    );

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
      <Chips options={[{ value: "start", label: "Mise en place" }, { value: "end", label: `Fin de service${nowIn.length ? ` (${nowIn.length})` : ""}` }]} value={mode} onChange={(v) => v && setMode(v)} />
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
