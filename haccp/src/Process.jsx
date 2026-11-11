import { useEffect, useMemo, useState } from "react";
import { Flame, Snowflake, RotateCcw, ThermometerSun, CheckCircle2, Trash2, Timer } from "lucide-react";
import { useData } from "./store.jsx";
import { isPrintAvailable, printLabelsSafe } from "./printer.js";
import { autoReplaceOn, olderLots, replaceOlderLots } from "./traceRules.js";
import { Sheet, Field, Chips, Badge, Empty, TempInput } from "./ui.jsx";
import { addDays, dayKey, daysUntil, fmtDate, fmtDateTime, fmtNum, fmtTime, parseNum, toLocalInput } from "./utils.js";

// Règles (arrêté du 21/12/2009 annexe IV, GBPH restauration) :
// - Refroidissement : passer de +63 °C à +10 °C à cœur en moins de 2 h, puis stocker à +3 °C max.
// - Remise en température : atteindre +63 °C à cœur en moins d'1 h.
// - Maintien au chaud : +63 °C minimum à cœur.
// - Cuisson : +63 °C minimum à cœur ; +70 °C conseillé pour volailles et viandes hachées.
export const PROCESS = {
  cooling: {
    label: "Refroidissement rapide",
    icon: Snowflake,
    twoStep: true,
    maxMinutes: 120,
    rule: "Passer de +63 °C à moins de +10 °C à cœur en moins de 2 h (cellule de refroidissement, ou petites quantités en bacs peu profonds), puis stocker à +3 °C maximum. À consommer sous 3 jours (J+3).",
    check: (r) => r.endTemp <= 10 && r.minutes <= 120,
    fail: ["Produit jeté", "Produit consommé immédiatement (servi chaud)"],
  },
  reheat: {
    label: "Remise en température",
    icon: RotateCcw,
    twoStep: true,
    maxMinutes: 60,
    rule: "Atteindre +63 °C à cœur en moins d'1 h. Ne réchauffer qu'une seule fois : ce qui a été réchauffé et pas servi est jeté (jamais remis au froid). Ne réchauffer que la quantité nécessaire au service.",
    check: (r) => r.endTemp >= 63 && r.minutes <= 60,
    fail: ["Réchauffage prolongé jusqu'à +63 °C", "Produit jeté"],
  },
  hot: {
    label: "Maintien au chaud",
    icon: ThermometerSun,
    rule: "+63 °C minimum à cœur jusqu'au service. En dessous : remonter à +63 °C en moins d'1 h, sinon jeter.",
    check: (r) => r.endTemp >= 63,
    fail: ["Remis à +63 °C en moins d'1 h", "Produit jeté"],
  },
  cook: {
    label: "Cuisson à cœur",
    icon: Flame,
    rule: "+63 °C minimum à cœur. Conseillé : +70 °C pour volailles, viandes hachées et tranches de kebab (trancher seulement la partie cuite de la broche).",
    check: (r) => r.endTemp >= (r.target || 63),
    fail: ["Cuisson prolongée jusqu'à la bonne température", "Produit jeté"],
  },
};

// Viandes cuites puis conservées au froid (circuit « préparé à l'avance ») — modifiable dans Réglages.
export const DEFAULT_COLD_MEATS = ["Poulet mariné", "Poulet curry", "Poulet paprika", "Nuggets", "Cordon bleu", "Tenders", "Égrené de bœuf"];
const OLD_DEFAULT = "Poulet mariné, Poulet curry, Poulet paprika, Égrené de bœuf";
export const KEBAB = "Kebab (broche)";
export const coldMeats = (settings) =>
  settings?.coldMeats && settings.coldMeats.trim() !== OLD_DEFAULT
    ? settings.coldMeats.split(",").map((x) => x.trim()).filter(Boolean)
    : DEFAULT_COLD_MEATS;
const isColdMeat = (settings, name) => coldMeats(settings).some((m) => m.toLowerCase() === (name || "").trim().toLowerCase());

export const minutesBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

export function runningProcesses(list) {
  return list.filter((r) => r.state === "running");
}

export default function Process({ intent }) {
  const { data, remove } = useData();
  const [form, setForm] = useState(intent && PROCESS[intent] ? { kind: intent } : null);
  const [detail, setDetail] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const list = useMemo(() => [...data.process].sort((a, b) => (b.startAt || b.at).localeCompare(a.startAt || a.at)), [data.process]);
  const running = runningProcesses(list);
  const recent = list.filter((r) => r.state !== "running").slice(0, 15);

  return (
    <>
      <h3 className="section-title">Cuisson, refroidissement, maintien chaud</h3>
      <div className="process-btns">
        {Object.entries(PROCESS).map(([k, p]) => (
          <button key={k} className="btn btn-ghost" onClick={() => setForm({ kind: k })}>
            <p.icon size={18} /> {p.label}
          </button>
        ))}
      </div>
      {running.map((r) => {
        const p = PROCESS[r.kind];
        const elapsed = minutesBetween(r.startAt, new Date());
        const late = elapsed > p.maxMinutes;
        return (
          <div key={r.id} className={"card running " + (late ? "late" : "")}>
            <Timer size={22} />
            <div className="list-main">
              <strong>
                {p.label} — {r.product}
              </strong>
              <span className="small">
                Démarré à {fmtTime(r.startAt)} ({fmtNum(r.startTemp)} °C) · {elapsed} min / {p.maxMinutes} min max
              </span>
              {late && <span className="small ko-text">Temps dépassé !</span>}
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => setForm({ kind: r.kind, initial: r })}>
              Terminer
            </button>
          </div>
        );
      })}
      {recent.length > 0 && (
        <div className="card list">
          {recent.map((r) => {
            const p = PROCESS[r.kind];
            return (
              <button key={r.id} className="list-row" onClick={() => setDetail(r)}>
                <p.icon size={20} className="muted" />
                <span className="list-main">
                  <strong>{r.product}</strong>
                  <span className="muted small">
                    {p.label} · {fmtDateTime(r.at)}
                    {Number.isFinite(r.minutes) && ` · ${r.minutes} min`}
                    {r.by && ` · ${r.by}`}
                  </span>
                  {!r.ok && r.action && <span className="small ko-text">↳ {r.action}</span>}
                </span>
                <span className={"temp-val " + (r.ok ? "ok" : "ko")}>{fmtNum(r.endTemp)} °C</span>
              </button>
            );
          })}
        </div>
      )}
      {!recent.length && !running.length && <p className="muted small">Aucun contrôle de cuisson ou de refroidissement pour l'instant.</p>}

      {form && <ProcessForm {...form} onClose={() => setForm(null)} />}
      {detail && (
        <Sheet
          title={`${PROCESS[detail.kind].label} — ${detail.product}`}
          onClose={() => setDetail(null)}
          footer={
            <button
              className="btn btn-ghost danger"
              onClick={async () => {
                if (confirm("Supprimer ce contrôle ?")) {
                  await remove("process", detail.id);
                  setDetail(null);
                }
              }}
            >
              <Trash2 size={18} /> Supprimer
            </button>
          }
        >
          <dl className="dl">
            {detail.startAt && (<><dt>Début</dt><dd>{fmtDateTime(detail.startAt)} — {fmtNum(detail.startTemp)} °C</dd></>)}
            <dt>{detail.startAt ? "Fin" : "Mesure"}</dt>
            <dd>{fmtDateTime(detail.at)} — {fmtNum(detail.endTemp)} °C</dd>
            {Number.isFinite(detail.minutes) && (<><dt>Durée</dt><dd>{detail.minutes} min</dd></>)}
            <dt>Résultat</dt>
            <dd className={detail.ok ? "ok-text" : "ko-text"}>{detail.ok ? "Conforme" : "NON conforme"}</dd>
            {detail.action && (<><dt>Action corrective</dt><dd>{detail.action}</dd></>)}
            {detail.comment && (<><dt>Commentaire</dt><dd>{detail.comment}</dd></>)}
            <dt>Par</dt><dd>{detail.by || "—"}</dd>
          </dl>
          <p className="muted small">ℹ️ {PROCESS[detail.kind].rule}</p>
        </Sheet>
      )}
    </>
  );
}

function ProcessForm({ kind, initial, onClose }) {
  const { data, save } = useData();
  const p = PROCESS[kind];
  const finishing = !!initial;
  const [f, setF] = useState(() => ({
    product: initial?.product || "",
    startLocal: toLocalInput(initial?.startAt || new Date()),
    startTemp: initial ? String(initial.startTemp) : "",
    endLocal: toLocalInput(new Date()),
    endTemp: "",
    target: initial?.target || 63,
    action: "",
    comment: initial?.comment || "",
    by: initial?.by || data.settings.operator || "",
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const endTemp = parseNum(f.endTemp);
  const startTemp = parseNum(f.startTemp);
  const minutes = p.twoStep ? minutesBetween(new Date(f.startLocal), new Date(f.endLocal)) : null;
  const rec = { endTemp, minutes, target: Number(f.target) };
  const ok = Number.isFinite(endTemp) ? p.check(rec) : null;
  const meats = coldMeats(data.settings);
  const presets = kind === "cook" || kind === "hot" ? [...meats, KEBAB] : meats;
  const names = [...new Set([...presets, ...data.process.map((r) => r.product)])].sort();
  const cold = isColdMeat(data.settings, f.product);
  const [thenCool, setThenCool] = useState(true);
  const [makeLabel, setMakeLabel] = useState(true);
  // Lots de viande cuite au froid (traçabilité « préparation maison » en cours)
  const lots = data.trace
    .filter((t) => t.kind === "homemade" && t.status === "open")
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const [lotId, setLotId] = useState(initial?.traceId || "");
  const lot = lots.find((t) => t.id === lotId) || data.trace.find((t) => t.id === lotId);
  const lotExpired = lot && lot.dlcAfter && daysUntil(lot.dlcAfter) < 0;
  const [usedAll, setUsedAll] = useState(true);

  const base = () => ({
    ...(initial || {}),
    kind,
    product: f.product.trim(),
    by: f.by.trim(),
    comment: f.comment.trim(),
  });

  const start = async () => {
    if (!f.product.trim()) return alert("Indique le produit.");
    if (!Number.isFinite(startTemp)) return alert("Indique la température de départ.");
    await save("process", { ...base(), traceId: kind === "reheat" ? lotId || undefined : undefined, state: "running", startAt: new Date(f.startLocal).toISOString(), startTemp, at: new Date(f.startLocal).toISOString() });
    onClose();
  };
  const finish = async () => {
    if (!f.product.trim()) return alert("Indique le produit.");
    if (kind === "reheat" && lotExpired) return alert("Ce lot a dépassé sa date limite (J+3) : il doit être jeté, pas réchauffé.");
    if (!Number.isFinite(endTemp)) return alert("Indique la température mesurée.");
    if (p.twoStep && !Number.isFinite(startTemp)) return alert("Indique la température de départ.");
    if (!ok && !f.action) return alert("Produit non conforme : choisis une action corrective.");
    const rec = {
      ...base(),
      state: "done",
      startAt: p.twoStep ? new Date(f.startLocal).toISOString() : undefined,
      startTemp: p.twoStep ? startTemp : undefined,
      at: new Date(f.endLocal).toISOString(),
      endTemp,
      minutes,
      target: kind === "cook" ? Number(f.target) : undefined,
      ok,
      action: ok ? "" : f.action,
      traceId: kind === "reheat" ? lotId || undefined : initial?.traceId,
    };
    const at = rec.at;
    // Refroidissement conforme -> étiquette de traçabilité J+3 (préparation maison)
    if (kind === "cooling" && ok && makeLabel && !initial?.traceId) {
      const t = await save("trace", {
        kind: "homemade",
        product: rec.product,
        at,
        keepDays: 3,
        dlcAfter: dayKey(addDays(new Date(at), 3)),
        dlcType: "DLC",
        status: "open",
        by: rec.by,
        comment: `Cuit puis refroidi (${fmtNum(rec.startTemp)} → ${fmtNum(endTemp)} °C en ${minutes} min)`,
      });
      rec.traceId = t.id;
      if (autoReplaceOn(data.settings)) await replaceOlderLots(save, data.trace, t);
      if (isPrintAvailable() && data.settings.printerAddress && data.settings.printerAuto) printLabelsSafe([t], data.settings);
    }
    const saved = await save("process", rec);
    // Cuisson d'une viande conservée au froid -> démarre le refroidissement
    if (kind === "cook" && ok && cold && thenCool) {
      await save("process", { kind: "cooling", product: rec.product, by: rec.by, state: "running", startAt: at, startTemp: endTemp, at, cookId: saved.id });
    }
    // Réchauffage de tout le lot -> lot clôturé dans la traçabilité
    if (kind === "reheat" && lot && usedAll) {
      await save("trace", { ...lot, status: "used", closedAt: at, comment: [lot.comment, "Réchauffé pour le service"].filter(Boolean).join(" — ") });
    }
    onClose();
  };

  return (
    <Sheet
      title={p.label}
      onClose={onClose}
      footer={
        <div className="row gap">
          {p.twoStep && !finishing && (
            <button className="btn btn-ghost btn-block" onClick={start}>
              <Timer size={18} /> Démarrer (finir plus tard)
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={finish}>
            <CheckCircle2 size={18} /> {p.twoStep ? "Terminer" : "Enregistrer"}
          </button>
        </div>
      }
    >
      <div className="alert info">ℹ️ {p.rule}</div>
      {kind === "reheat" && !finishing && (
        <Field label="Lot de viande à réchauffer (frigo)">
          <select
            className="input"
            value={lotId}
            onChange={(e) => {
              setLotId(e.target.value);
              const l = lots.find((t) => t.id === e.target.value);
              if (l) set("product")(l.product);
            }}
          >
            <option value="">— Choisir un lot —</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.product} — cuit le {fmtDate(l.at)}{l.dlcAfter ? `, limite ${fmtDate(l.dlcAfter)}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      {lotExpired && <div className="alert ko">Lot périmé (limite {fmtDate(lot.dlcAfter)}) : à jeter, ne pas réchauffer.</div>}
      <Field label="Produit *">
        <Chips options={presets} value={f.product} onChange={(v) => set("product")(v || "")} />
        <input className="input" list="process-names" value={f.product} onChange={set("product")} placeholder="ou tape un autre produit" />
        <datalist id="process-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      {kind === "cook" && f.product === KEBAB && (
        <div className="alert info">Kebab : mesurer la température à cœur des tranches coupées (+70 °C conseillé). Ne trancher que la partie bien cuite ; éviter de remettre au froid une broche entamée (sinon : refroidissement rapide en moins de 2 h).</div>
      )}
      {kind === "cook" && (
        <Field label="Température à cœur visée">
          <Chips options={[{ value: 63, label: "+63 °C (minimum)" }, { value: 70, label: "+70 °C (volaille, haché)" }]} value={Number(f.target)} onChange={(v) => v && set("target")(v)} />
        </Field>
      )}
      {p.twoStep && (
        <div className="grid2">
          <Field label="Début">
            <input className="input" type="datetime-local" value={f.startLocal} onChange={set("startLocal")} disabled={finishing} />
          </Field>
          <Field label="T° au début">
            <TempInput value={f.startTemp} onChange={set("startTemp")} />
          </Field>
        </div>
      )}
      <div className="grid2">
        <Field label={p.twoStep ? "Fin" : "Heure de la mesure"}>
          <input className="input" type="datetime-local" value={f.endLocal} onChange={set("endLocal")} />
        </Field>
        <Field label={p.twoStep ? "T° à cœur à la fin" : "T° à cœur"}>
          <TempInput value={f.endTemp} onChange={set("endTemp")} />
        </Field>
      </div>
      {ok !== null && (
        <div className={"alert " + (ok ? "ok" : "ko")}>
          {ok ? "✓ Conforme" : "✗ NON conforme"}
          {p.twoStep && Number.isFinite(minutes) && ` — ${minutes} min (max ${p.maxMinutes} min)`}
        </div>
      )}
      {kind === "cook" && cold && (
        <label className="check">
          <input type="checkbox" checked={thenCool} onChange={(e) => setThenCool(e.target.checked)} />
          Mettre au froid ensuite : démarrer le refroidissement rapide (+10 °C en moins de 2 h)
        </label>
      )}
      {kind === "cooling" && !initial?.traceId && makeLabel && autoReplaceOn(data.settings) && olderLots(data.trace, f.product).length > 0 && (
        <div className="alert info">♻️ L'ancien lot de « {f.product} » (du {olderLots(data.trace, f.product).map((t) => fmtDate(t.at)).join(", ")}) sera clôturé automatiquement.</div>
      )}
      {kind === "cooling" && !initial?.traceId && (
        <label className="check">
          <input type="checkbox" checked={makeLabel} onChange={(e) => setMakeLabel(e.target.checked)} />
          Créer le lot dans la traçabilité (à consommer avant J+3)
        </label>
      )}
      {kind === "reheat" && lot && (
        <label className="check">
          <input type="checkbox" checked={usedAll} onChange={(e) => setUsedAll(e.target.checked)} />
          Tout le lot a été réchauffé (le lot sera clôturé)
        </label>
      )}
      {ok === false && (
        <Field label="Action corrective *">
          <select className="input" value={f.action} onChange={set("action")}>
            <option value="">Choisir…</option>
            {p.fail.map((a) => <option key={a}>{a}</option>)}
            <option>Autre (voir commentaire)</option>
          </select>
        </Field>
      )}
      <div className="grid2">
        <Field label="Initiales">
          <input className="input" value={f.by} onChange={set("by")} maxLength={12} />
        </Field>
        <Field label="Commentaire">
          <input className="input" value={f.comment} onChange={set("comment")} />
        </Field>
      </div>
      {!finishing && p.twoStep && <p className="muted small">Astuce : appuie sur « Démarrer » quand tu commences ; l'appli te rappelle de terminer le contrôle.</p>}
    </Sheet>
  );
}
