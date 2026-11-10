import { useMemo, useState } from "react";
import { Sparkles, Check, Plus, Trash2, History } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips, Badge, Empty } from "./ui.jsx";
import { CLEAN_FREQ } from "./db.js";
import { dayKey, daysSince, fmtDateTime, fmtDayLong, fmtTime, momentOfDay, todayKey } from "./utils.js";

// Une tâche est "à faire" si elle n'a pas été faite dans sa période :
// après chaque service = ce service (matin / soir), jour = aujourd'hui, semaine = 7 j, mois = 30 j.
export function taskState(task, logs) {
  const mine = logs.filter((l) => l.taskId === task.id).sort((a, b) => b.at.localeCompare(a.at));
  const last = mine[0];
  let done;
  if (!last) done = false;
  else if (task.freq === "service") done = dayKey(last.at) === todayKey() && momentOfDay(last.at) === momentOfDay();
  else if (task.freq === "daily") done = dayKey(last.at) === todayKey();
  else done = daysSince(last.at) < (CLEAN_FREQ[task.freq]?.days || 1);
  const late =
    !done &&
    (!last ||
      (task.freq === "weekly" && daysSince(last.at) >= 9) ||
      (task.freq === "monthly" && daysSince(last.at) >= 35) ||
      ((task.freq === "daily" || task.freq === "service") && daysSince(last.at) >= 2));
  return { last, done, late };
}

export default function Nettoyage() {
  const { data, save } = useData();
  const [edit, setEdit] = useState(null);
  const [showHist, setShowHist] = useState(false);
  const tasks = [...data.cleanTasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const states = tasks.map((t) => ({ t, ...taskState(t, data.cleanLogs) }));
  const todo = states.filter((s) => !s.done);
  const done = states.filter((s) => s.done);

  const markDone = (t) =>
    save("cleanLogs", { taskId: t.id, name: t.name, product: t.product || "", at: new Date().toISOString(), by: data.settings.operator || "" });

  const Row = ({ t, last, done: isDone, late }) => (
    <div className="list-row">
      <span className="list-main" onClick={() => setEdit(t)}>
        <strong>{t.name}</strong>
        <span className="muted small">
          {CLEAN_FREQ[t.freq]?.label}
          {t.product && ` · ${t.product}`}
        </span>
        <span className="small muted">{last ? `Fait le ${fmtDateTime(last.at)}${last.by ? ` par ${last.by}` : ""}` : "Jamais fait"}</span>
      </span>
      {isDone ? (
        <Badge tone="ok">✓ Fait</Badge>
      ) : (
        <button className={"btn btn-sm " + (late ? "btn-ko" : "btn-primary")} onClick={() => markDone(t)}>
          <Check size={16} /> Fait
        </button>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className={"hero " + (todo.length ? "hero-todo" : "hero-ok")}>
        <div>
          <div className="hero-title">Plan de nettoyage</div>
          <div className="hero-sub">{todo.length ? `${todo.length} tâche(s) à faire` : "Tout est fait ✓"}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => setShowHist(true)}>
          <History size={18} />
        </button>
      </div>
      {!tasks.length && <Empty icon={Sparkles}>Aucune tâche de nettoyage.</Empty>}
      {todo.length > 0 && (
        <>
          <h3 className="section-title">À faire</h3>
          <div className="card list">{todo.map((s) => <Row key={s.t.id} {...s} />)}</div>
        </>
      )}
      {done.length > 0 && (
        <>
          <h3 className="section-title">Fait</h3>
          <div className="card list">{done.map((s) => <Row key={s.t.id} {...s} />)}</div>
        </>
      )}
      <button className="btn btn-ghost" onClick={() => setEdit({ freq: "daily", order: tasks.length })}>
        <Plus size={18} /> Ajouter une tâche
      </button>
      <p className="muted small rule">
        ℹ️ Le plan de nettoyage et de désinfection fait partie du Plan de Maîtrise Sanitaire (règlement CE 852/2004). Méthode : enlever les déchets, nettoyer (détergent), rincer, désinfecter (produit apte au contact alimentaire, respecter le temps d'action), rincer si indiqué, laisser sécher.
      </p>

      {edit && <TaskForm initial={edit} onClose={() => setEdit(null)} />}
      {showHist && <HistorySheet onClose={() => setShowHist(false)} />}
    </div>
  );
}

function TaskForm({ initial, onClose }) {
  const { save, remove } = useData();
  const [f, setF] = useState({ name: "", product: "", freq: "daily", ...initial });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const submit = async () => {
    if (!f.name.trim()) return alert("Indique ce qu'il faut nettoyer.");
    await save("cleanTasks", { ...f, name: f.name.trim(), product: f.product.trim() });
    onClose();
  };
  return (
    <Sheet
      title={initial.id ? "Modifier la tâche" : "Nouvelle tâche"}
      onClose={onClose}
      footer={
        <div className="row gap">
          {initial.id && (
            <button className="btn btn-ghost danger" onClick={async () => {
              if (confirm(`Supprimer « ${initial.name} » du plan de nettoyage ?`)) { await remove("cleanTasks", initial.id); onClose(); }
            }}><Trash2 size={18} /></button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>Enregistrer</button>
        </div>
      }
    >
      <Field label="À nettoyer">
        <input className="input" value={f.name} onChange={set("name")} placeholder="ex : Hachoir, Bac à sauces…" />
      </Field>
      <Field label="Fréquence">
        <Chips options={Object.entries(CLEAN_FREQ).map(([value, x]) => ({ value, label: x.label }))} value={f.freq} onChange={(v) => v && set("freq")(v)} />
      </Field>
      <Field label="Produit utilisé">
        <input className="input" value={f.product} onChange={set("product")} />
      </Field>
    </Sheet>
  );
}

function HistorySheet({ onClose }) {
  const { data, remove } = useData();
  const byDay = useMemo(() => {
    const m = new Map();
    for (const l of [...data.cleanLogs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300)) {
      const k = dayKey(l.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(l);
    }
    return [...m.entries()];
  }, [data.cleanLogs]);
  return (
    <Sheet title="Historique du nettoyage" onClose={onClose}>
      {!byDay.length && <Empty icon={History}>Rien pour l'instant.</Empty>}
      {byDay.map(([k, list]) => (
        <div key={k} className="day-group">
          <div className="day-title">{fmtDayLong(k)}</div>
          <div className="card list">
            {list.map((l) => (
              <div key={l.id} className="list-row">
                <span className="list-main">
                  <strong>{l.name}</strong>
                  <span className="muted small">{fmtTime(l.at)} {l.by && `· ${l.by}`}</span>
                </span>
                <button className="icon-btn" aria-label="Annuler" onClick={() => confirm("Annuler cet enregistrement ?") && remove("cleanLogs", l.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

