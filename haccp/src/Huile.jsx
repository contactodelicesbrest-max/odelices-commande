import { useMemo, useState } from "react";
import { Droplets, RefreshCw, Gauge, Trash2, CheckCircle2, Filter } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips, Badge, Empty } from "./ui.jsx";
import { dayKey, daysSince, fmtDate, fmtDateTime, fmtDayLong, fmtTime, fmtNum, parseNum, toLocalInput, todayKey } from "./utils.js";

export const ASPECTS = [
  { value: "bon", label: "Bonne", tone: "ok" },
  { value: "moyen", label: "À surveiller", tone: "warn" },
  { value: "mauvais", label: "À changer", tone: "ko" },
];

// Règles : décret n° 2008-184 du 26/02/2008 (huile impropre au-delà de 25 % de composés polaires),
// règlement (UE) 2017/2158 acrylamide (friture à 175 °C maximum), GBPH (zone dégradée 20-25 %).
export const OIL_RULES = {
  tpmWarn: 20,
  maxFryTemp: 175,
  text: "Composés polaires : moins de 20 % = bonne ; 20 à 25 % = dégradée, changer bientôt ; 25 % ou plus = huile impropre, INTERDITE (décret 2008-184). Friture à 175 °C maximum (acrylamide, règlement UE 2017/2158). Filtrer/écumer régulièrement, ne pas rajouter d'huile neuve sur une huile usée.",
};
const KIND_LABEL = { change: "Changement d'huile", control: "Contrôle", filter: "Filtrage / écumage" };

export function fryerStatus(fryer, oil, settings) {
  const list = oil.filter((o) => o.fryerId === fryer.id).sort((a, b) => b.at.localeCompare(a.at));
  const lastChange = list.find((o) => o.kind === "change");
  const lastControl = list.find((o) => o.kind === "control");
  const maxDays = Number(fryer.maxDays || settings.oilMaxDays || 7);
  const tpmMax = Number(settings.oilTpmMax || 25);
  const days = lastChange ? daysSince(lastChange.at) : null;
  const controlledToday = lastControl && dayKey(lastControl.at) === todayKey();
  const ctrlAfterChange = lastControl && (!lastChange || lastControl.at >= lastChange.at) ? lastControl : null;
  const alerts = [];
  if (!lastChange) alerts.push({ tone: "warn", text: "Aucun changement enregistré" });
  else if (days >= maxDays) alerts.push({ tone: "ko", text: `Huile changée il y a ${days} j (max ${maxDays} j)` });
  const forbidden =
    !!ctrlAfterChange && ((Number.isFinite(ctrlAfterChange.tpm) && ctrlAfterChange.tpm >= tpmMax) || ctrlAfterChange.aspect === "mauvais");
  if (forbidden)
    alerts.push({
      tone: "ko",
      text: Number.isFinite(ctrlAfterChange.tpm) && ctrlAfterChange.tpm >= tpmMax
        ? `NE PAS UTILISER : ${fmtNum(ctrlAfterChange.tpm)} % de composés polaires (max ${tpmMax} %) — changer l'huile`
        : "NE PAS UTILISER : huile à changer",
    });
  else if (ctrlAfterChange && Number.isFinite(ctrlAfterChange.tpm) && ctrlAfterChange.tpm >= OIL_RULES.tpmWarn)
    alerts.push({ tone: "warn", text: `Huile dégradée (${fmtNum(ctrlAfterChange.tpm)} %) — prévoir le changement` });
  if (ctrlAfterChange && Number.isFinite(ctrlAfterChange.temp) && ctrlAfterChange.temp > OIL_RULES.maxFryTemp)
    alerts.push({ tone: "warn", text: `Température ${fmtNum(ctrlAfterChange.temp)} °C : baisser à 175 °C max` });
  if (!controlledToday) alerts.push({ tone: "warn", text: "Pas de contrôle aujourd'hui" });
  return { list, lastChange, lastControl, days, maxDays, controlledToday, alerts, forbidden };
}

export default function Huile() {
  const { data, remove } = useData();
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const fryers = [...data.fryers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const history = useMemo(() => [...data.oil].sort((a, b) => b.at.localeCompare(a.at)), [data.oil]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const o of history) {
      const k = dayKey(o.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(o);
    }
    return [...m.entries()].slice(0, 45);
  }, [history]);

  return (
    <div className="page">
      {!fryers.length && <Empty icon={Droplets}>Ajoute tes friteuses dans Réglages ⚙️.</Empty>}
      {fryers.map((fr) => {
        const st = fryerStatus(fr, data.oil, data.settings);
        return (
          <div key={fr.id} className={"card fryer" + (st.forbidden ? " forbidden" : "")}>
            <div className="eq-head">
              <div>
                <div className="eq-name">{fr.name}</div>
                <div className="muted small">
                  {fr.capacity ? `${fmtNum(fr.capacity)} L · ` : ""}changement max tous les {st.maxDays} j
                </div>
              </div>
              <div className={"days-badge " + (st.days === null ? "none" : st.days >= st.maxDays ? "ko" : st.days >= st.maxDays - 1 ? "warn" : "ok")}>
                <span>{st.days === null ? "—" : st.days}</span>
                <small>jour(s)</small>
              </div>
            </div>
            <div className="kv">
              <span>Dernier changement</span>
              <strong>{st.lastChange ? fmtDateTime(st.lastChange.at) : "—"}</strong>
              <span>Dernier contrôle</span>
              <strong>
                {st.lastControl
                  ? `${fmtDateTime(st.lastControl.at)}${Number.isFinite(st.lastControl.tpm) ? ` · ${fmtNum(st.lastControl.tpm)} %` : ""}`
                  : "—"}
              </strong>
            </div>
            {st.alerts.length > 0 && (
              <div className="row gap-s wrap">
                {st.alerts.map((a) => (
                  <Badge key={a.text} tone={a.tone}>{a.text}</Badge>
                ))}
              </div>
            )}
            <div className="row gap">
              <button className="btn btn-ghost" onClick={() => setForm({ fryer: fr, kind: "filter" })} aria-label="Filtrage">
                <Filter size={20} />
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => setForm({ fryer: fr, kind: "control" })}>
                <Gauge size={20} /> Contrôle
              </button>
              <button className="btn btn-primary btn-block" onClick={() => setForm({ fryer: fr, kind: "change" })}>
                <RefreshCw size={20} /> Changement
              </button>
            </div>
          </div>
        );
      })}

      <div className="muted small rule">ℹ️ {OIL_RULES.text}</div>
      <h3 className="section-title">Historique</h3>
      {byDay.length === 0 && <Empty icon={Droplets}>Aucun enregistrement.</Empty>}
      {byDay.map(([k, items]) => (
        <div key={k} className="day-group">
          <div className="day-title">{fmtDayLong(k)}</div>
          <div className="card list">
            {items.map((o) => (
              <button key={o.id} className="list-row" onClick={() => setDetail(o)}>
                <span className={"oil-ico " + o.kind}>{o.kind === "change" ? <RefreshCw size={18} /> : o.kind === "filter" ? <Filter size={18} /> : <Gauge size={18} />}</span>
                <span className="list-main">
                  <strong>
                    {KIND_LABEL[o.kind]} — {o.fryerName}
                  </strong>
                  <span className="muted small">
                    {fmtTime(o.at)}
                    {o.by && ` · ${o.by}`}
                    {Number.isFinite(o.tpm) && ` · ${fmtNum(o.tpm)} % CP`}
                    {Number.isFinite(o.temp) && ` · ${fmtNum(o.temp)} °C`}
                    {Number.isFinite(o.liters) && ` · ${fmtNum(o.liters)} L`}
                  </span>
                </span>
                {o.aspect && <Badge tone={ASPECTS.find((a) => a.value === o.aspect)?.tone}>{ASPECTS.find((a) => a.value === o.aspect)?.label}</Badge>}
              </button>
            ))}
          </div>
        </div>
      ))}

      {form && <OilForm {...form} onClose={() => setForm(null)} />}
      {detail && (
        <Sheet
          title={KIND_LABEL[detail.kind]}
          onClose={() => setDetail(null)}
          footer={
            <button
              className="btn btn-ghost danger"
              onClick={async () => {
                if (confirm("Supprimer cet enregistrement ?")) {
                  await remove("oil", detail.id);
                  setDetail(null);
                }
              }}
            >
              <Trash2 size={18} /> Supprimer
            </button>
          }
        >
          <dl className="dl">
            <dt>Friteuse</dt><dd>{detail.fryerName}</dd>
            <dt>Date</dt><dd>{fmtDateTime(detail.at)}</dd>
            <dt>Par</dt><dd>{detail.by || "—"}</dd>
            {Number.isFinite(detail.tpm) && (<><dt>Composés polaires</dt><dd>{fmtNum(detail.tpm)} %</dd></>)}
            {Number.isFinite(detail.temp) && (<><dt>Température huile</dt><dd>{fmtNum(detail.temp)} °C</dd></>)}
            {detail.aspect && (<><dt>Aspect</dt><dd>{ASPECTS.find((a) => a.value === detail.aspect)?.label}</dd></>)}
            {Number.isFinite(detail.liters) && (<><dt>Quantité</dt><dd>{fmtNum(detail.liters)} L</dd></>)}
            {detail.oilType && (<><dt>Huile</dt><dd>{detail.oilType}</dd></>)}
            {detail.comment && (<><dt>Commentaire</dt><dd>{detail.comment}</dd></>)}
          </dl>
        </Sheet>
      )}
    </div>
  );
}

function OilForm({ fryer, kind, onClose }) {
  const { data, save } = useData();
  const lastType = [...data.oil].filter((o) => o.oilType).sort((a, b) => b.at.localeCompare(a.at))[0]?.oilType || "";
  const [f, setF] = useState({
    atLocal: toLocalInput(new Date()),
    by: data.settings.operator || "",
    tpm: "",
    temp: "",
    aspect: kind === "control" ? "bon" : null,
    liters: fryer.capacity ? String(fryer.capacity) : "",
    oilType: lastType,
    comment: "",
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const tpm = parseNum(f.tpm);
  const tpmMax = Number(data.settings.oilTpmMax || 25);

  const submit = async () => {
    const at = new Date(f.atLocal).toISOString();
    const bad = kind === "control" && ((Number.isFinite(tpm) && tpm >= tpmMax) || f.aspect === "mauvais");
    await save("oil", {
      fryerId: fryer.id,
      fryerName: fryer.name,
      kind,
      at,
      by: f.by.trim(),
      tpm: Number.isFinite(tpm) ? tpm : null,
      temp: Number.isFinite(parseNum(f.temp)) ? parseNum(f.temp) : null,
      aspect: kind === "control" && Number.isFinite(tpm) && tpm >= tpmMax ? "mauvais" : f.aspect || null,
      liters: Number.isFinite(parseNum(f.liters)) ? parseNum(f.liters) : null,
      oilType: f.oilType.trim(),
      comment: f.comment.trim(),
    });
    if (bad && confirm("Huile impropre : elle ne doit plus être utilisée.\n\nAs-tu changé l'huile maintenant ? (OK = enregistrer le changement)")) {
      await save("oil", {
        fryerId: fryer.id,
        fryerName: fryer.name,
        kind: "change",
        at: new Date(new Date(at).getTime() + 60000).toISOString(),
        by: f.by.trim(),
        liters: fryer.capacity || null,
        oilType: lastType,
        comment: "Changement suite au contrôle",
      });
    }
    onClose();
  };

  return (
    <Sheet
      title={`${KIND_LABEL[kind]} — ${fryer.name}`}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={submit}>
          <CheckCircle2 size={20} /> Enregistrer
        </button>
      }
    >
      <div className="grid2">
        <Field label="Date et heure">
          <input className="input" type="datetime-local" value={f.atLocal} onChange={set("atLocal")} />
        </Field>
        <Field label="Initiales">
          <input className="input" value={f.by} onChange={set("by")} maxLength={12} />
        </Field>
      </div>
      {kind === "control" ? (
        <>
          <div className="grid2">
            <Field label="Composés polaires (%)" hint={`Limite légale : ${tpmMax} %`}>
              <input className="input" inputMode="decimal" value={f.tpm} onChange={set("tpm")} placeholder="ex : 14" />
            </Field>
            <Field label="Température huile (°C)">
              <input className="input" inputMode="decimal" value={f.temp} onChange={set("temp")} placeholder="ex : 175" />
            </Field>
          </div>
          {Number.isFinite(tpm) && tpm >= tpmMax && <div className="alert ko">{tpmMax} % ou plus : huile impropre à la consommation, à changer immédiatement.</div>}
          {Number.isFinite(tpm) && tpm >= OIL_RULES.tpmWarn && tpm < tpmMax && <div className="alert warn">Entre 20 et {tpmMax} % : huile dégradée, prévoir le changement.</div>}
          {Number.isFinite(parseNum(f.temp)) && parseNum(f.temp) > OIL_RULES.maxFryTemp && <div className="alert warn">Au-dessus de 175 °C : baisser le thermostat (acrylamide).</div>}
          <Field label="Aspect / odeur / couleur">
            <Chips options={ASPECTS} value={f.aspect} onChange={set("aspect")} />
          </Field>
        </>
      ) : kind === "filter" ? (
        <p className="muted small">Filtrage de l'huile et retrait des résidus (écumage) : prolonge la durée de vie de l'huile.</p>
      ) : (
        <div className="grid2">
          <Field label="Quantité (L)">
            <input className="input" inputMode="decimal" value={f.liters} onChange={set("liters")} />
          </Field>
          <Field label="Type d'huile">
            <input className="input" value={f.oilType} onChange={set("oilType")} placeholder="ex : Tournesol" />
          </Field>
        </div>
      )}
      <Field label="Commentaire">
        <input className="input" value={f.comment} onChange={set("comment")} />
      </Field>
      {kind === "change" && <p className="muted small">Vider entièrement la cuve, la nettoyer, puis remplir d'huile neuve (ne pas mélanger avec l'ancienne).</p>}
    </Sheet>
  );
}
