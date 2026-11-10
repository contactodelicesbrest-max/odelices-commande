import { useMemo, useState } from "react";
import { Thermometer, Plus, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, TempInput, Badge, Empty, Chips } from "./ui.jsx";
import { EQUIP_TYPES, correctiveActions, tempStatus } from "./db.js";
import Process from "./Process.jsx";
import { dayKey, todayKey, fmtTime, fmtDayLong, fmtDateTime, momentOfDay, parseNum, fmtNum } from "./utils.js";

export const isFreezer = (eq) => eq?.type === "congel";
export const statusOf = (t) => t.status || (t.ok ? "ok" : "ko");

// Équipements dont le dernier relevé est non conforme : un recontrôle est attendu.
export function pendingRechecks(equipments, temps) {
  const out = [];
  for (const eq of equipments) {
    const last = temps.filter((t) => t.equipmentId === eq.id).sort((a, b) => b.at.localeCompare(a.at))[0];
    if (last && statusOf(last) !== "ok") out.push({ eq, last, late: Date.now() - new Date(last.at) > 3600000 });
  }
  return out;
}

export default function Temperatures({ intent }) {
  const { data, remove } = useData();
  const [entry, setEntry] = useState(intent === "new");
  const [filter, setFilter] = useState(null);
  const [detail, setDetail] = useState(null);
  const equipments = [...data.equipments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const temps = useMemo(() => [...data.temps].sort((a, b) => b.at.localeCompare(a.at)), [data.temps]);
  const today = todayKey();
  const moment = momentOfDay();

  const byDay = useMemo(() => {
    const m = new Map();
    for (const t of temps) {
      if (filter && t.equipmentId !== filter) continue;
      const k = dayKey(t.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return [...m.entries()].slice(0, 30);
  }, [temps, filter]);

  const doneNow = equipments.length > 0 && equipments.every((eq) =>
    temps.some((t) => t.equipmentId === eq.id && dayKey(t.at) === today && t.moment === moment)
  );

  return (
    <div className="page">
      <div className={"hero " + (doneNow ? "hero-ok" : "hero-todo")}>
        <div>
          <div className="hero-title">Relevé du {moment.toLowerCase()}</div>
          <div className="hero-sub">{doneNow ? "Fait pour tous les équipements ✓" : "À faire"}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEntry(true)} disabled={!equipments.length}>
          <Thermometer size={20} /> Relever
        </button>
      </div>

      {pendingRechecks(equipments, temps).map(({ eq, last, late }) => (
        <div key={eq.id} className={"alert " + (late ? "ko" : "warn")}>
          ⟳ Recontrôler <strong>{eq.name}</strong> ({fmtNum(last.value)} °C à {fmtTime(last.at)}){late ? " — en retard" : " dans l'heure"}
        </div>
      ))}
      {!equipments.length && <Empty icon={Thermometer}>Ajoute tes frigos et congélateurs dans Réglages ⚙️.</Empty>}

      <div className="grid-cards">
        {equipments.map((eq) => {
          const list = temps.filter((t) => t.equipmentId === eq.id);
          const last = list[0];
          const todayList = list.filter((t) => dayKey(t.at) === today);
          return (
            <div key={eq.id} className="card eq-card" onClick={() => setFilter(filter === eq.id ? null : eq.id)}>
              <div className="eq-head">
                <div>
                  <div className="eq-name">{eq.name}</div>
                  <div className="muted small">
                    {EQUIP_TYPES[eq.type]?.label} · {fmtNum(eq.min)} à {fmtNum(eq.max)} °C
                  </div>
                </div>
                {last ? (
                  <div className={"eq-temp " + statusOf(last)}>{fmtNum(last.value)}°</div>
                ) : (
                  <div className="eq-temp none">—</div>
                )}
              </div>
              <div className="row gap-s wrap">
                {["Matin", "Soir"].map((m) => {
                  const r = todayList.find((t) => t.moment === m);
                  return (
                    <Badge key={m} tone={r ? statusOf(r) : "neutral"}>
                      {m} {r ? `${fmtNum(r.value)}°` : "—"}
                    </Badge>
                  );
                })}
              </div>
              {last && statusOf(last) !== "ok" && <Badge tone="ko">⟳ Recontrôle à faire</Badge>}
              <Spark list={list.slice(0, 20).reverse()} eq={eq} />
              <div className="muted small rule">ℹ️ {EQUIP_TYPES[eq.type]?.rule}</div>
            </div>
          );
        })}
      </div>

      <Process intent={intent === "new" ? null : intent} />

      <h3 className="section-title">Historique des relevés</h3>
      <Chips
        options={equipments.map((e) => ({ value: e.id, label: e.name }))}
        value={filter}
        onChange={setFilter}
      />
      {byDay.length === 0 && <Empty icon={Thermometer}>Aucun relevé pour l'instant.</Empty>}
      {byDay.map(([k, list]) => (
        <div key={k} className="day-group">
          <div className="day-title">{fmtDayLong(k)}</div>
          <div className="card list">
            {list.map((t) => (
              <button key={t.id} className="list-row" onClick={() => setDetail(t)}>
                <span className="list-main">
                  <strong>{t.equipmentName}</strong>
                  <span className="muted small">
                    {t.moment} · {fmtTime(t.at)} {t.by && `· ${t.by}`}
                  </span>
                  {statusOf(t) !== "ok" && t.action && <span className="small ko-text">↳ {t.action}</span>}
                </span>
                <span className={"temp-val " + statusOf(t)}>{fmtNum(t.value)} °C</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {entry && <TempEntry onClose={() => setEntry(false)} equipments={equipments} />}
      {detail && (
        <Sheet
          title={detail.equipmentName}
          onClose={() => setDetail(null)}
          footer={
            <button
              className="btn btn-ghost danger"
              onClick={async () => {
                if (confirm("Supprimer ce relevé ?")) {
                  await remove("temps", detail.id);
                  setDetail(null);
                }
              }}
            >
              <Trash2 size={18} /> Supprimer
            </button>
          }
        >
          <dl className="dl">
            <dt>Température</dt>
            <dd className={statusOf(detail) + "-text"}>
              {fmtNum(detail.value)} °C {{ ok: "(conforme)", warn: "(écart toléré)", ko: "(NON conforme)" }[statusOf(detail)]}
            </dd>
            <dt>Seuils</dt>
            <dd>{fmtNum(detail.min)} à {fmtNum(detail.max)} °C</dd>
            <dt>Date</dt>
            <dd>{fmtDateTime(detail.at)} ({detail.moment})</dd>
            <dt>Par</dt>
            <dd>{detail.by || "—"}</dd>
            {detail.action && (<><dt>Action corrective</dt><dd>{detail.action}</dd></>)}
            {detail.comment && (<><dt>Commentaire</dt><dd>{detail.comment}</dd></>)}
          </dl>
        </Sheet>
      )}
    </div>
  );
}

function Spark({ list, eq }) {
  if (list.length < 2) return null;
  const W = 260, H = 44, P = 4;
  const vals = list.map((t) => t.value);
  const lo = Math.min(eq.min, ...vals) - 1;
  const hi = Math.max(eq.max, ...vals) + 1;
  const y = (v) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const x = (i) => P + (i / (list.length - 1)) * (W - 2 * P);
  const pts = list.map((t, i) => `${x(i).toFixed(1)},${y(t.value).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <rect x="0" y={y(eq.max)} width={W} height={Math.max(0, y(eq.min) - y(eq.max))} className="spark-band" />
      <polyline points={pts} className="spark-line" />
      {list.map((t, i) => (
        <circle key={t.id} cx={x(i)} cy={y(t.value)} r="2.6" className={"spark-" + statusOf(t)} />
      ))}
    </svg>
  );
}

function TempEntry({ onClose, equipments }) {
  const { data, saveMany } = useData();
  const rechecks = pendingRechecks(equipments, data.temps);
  const [moment, setMoment] = useState(rechecks.length ? "Recontrôle" : momentOfDay());
  const [values, setValues] = useState({});
  const [actions, setActions] = useState({});
  const [comments, setComments] = useState({});
  const [by, setBy] = useState(data.settings.operator || "");
  const [saving, setSaving] = useState(false);

  const rows = equipments.map((eq) => {
    const v = parseNum(values[eq.id]);
    const filled = Number.isFinite(v);
    const status = filled ? tempStatus(eq, v) : null;
    return { eq, v, filled, status, ok: status === "ok" };
  });
  const filled = rows.filter((r) => r.filled);
  const missingAction = filled.some((r) => !r.ok && !actions[r.eq.id]);

  const submit = async () => {
    if (!filled.length) return alert("Saisis au moins une température.");
    if (missingAction) return alert("Indique une action corrective pour chaque température non conforme.");
    setSaving(true);
    const at = new Date().toISOString();
    await saveMany(
      "temps",
      filled.map((r) => ({
        equipmentId: r.eq.id,
        equipmentName: r.eq.name,
        value: r.v,
        min: r.eq.min,
        max: r.eq.max,
        ok: r.ok,
        status: r.status,
        moment,
        at,
        by: by.trim(),
        action: r.ok ? "" : actions[r.eq.id],
        comment: (comments[r.eq.id] || "").trim(),
      }))
    );
    onClose();
  };

  return (
    <Sheet
      title="Relevé de températures"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={submit} disabled={saving}>
          <CheckCircle2 size={20} /> Enregistrer {filled.length ? `(${filled.length})` : ""}
        </button>
      }
    >
      <div className="row gap">
        <Chips options={["Matin", "Soir", "Recontrôle"]} value={moment} onChange={(v) => v && setMoment(v)} />
        <input className="input initials" placeholder="Initiales" value={by} onChange={(e) => setBy(e.target.value)} maxLength={12} />
      </div>
      {rows.map(({ eq, filled, ok, status, v }) => (
        <div key={eq.id} className={"temp-row" + (filled ? " is-" + status : "")}>
          <div className="temp-row-head">
            <div>
              <strong>{eq.name}</strong>
              <div className="muted small">
                {fmtNum(eq.min)} à {fmtNum(eq.max)} °C
              </div>
            </div>
            <TempInput
              value={values[eq.id]}
              negativeDefault={isFreezer(eq)}
              autoFocus={false}
              onChange={(v) => setValues((s) => ({ ...s, [eq.id]: v }))}
            />
          </div>
          {filled && !ok && (
            <div className="corrective">
              <div className={(status === "warn" ? "warn-text" : "ko-text") + " small row gap-s"}>
                <AlertTriangle size={16} />
                {status === "warn" ? "Écart toléré (dégivrage/chargement) — à recontrôler" : "Hors limites — action corrective obligatoire"}
              </div>
              <select
                className="input"
                value={actions[eq.id] || ""}
                onChange={(e) => setActions((s) => ({ ...s, [eq.id]: e.target.value }))}
              >
                <option value="">Choisir une action…</option>
                {correctiveActions(eq, v).map((a) => (
                  <option key={a}>{a}</option>
                ))}
                <option>Autre (voir commentaire)</option>
              </select>
              <input
                className="input"
                placeholder="Commentaire (facultatif)"
                value={comments[eq.id] || ""}
                onChange={(e) => setComments((s) => ({ ...s, [eq.id]: e.target.value }))}
              />
              <div className="muted small">ℹ️ {EQUIP_TYPES[eq.type]?.rule} Refais un relevé (« Recontrôle ») dans l'heure.</div>
            </div>
          )}
        </div>
      ))}
      <p className="muted small">
        <Plus size={12} /> Ajouter / modifier un équipement : Réglages ⚙️
      </p>
    </Sheet>
  );
}
