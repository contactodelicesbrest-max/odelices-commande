import { useState } from "react";
import { Plus, Trash2, CheckCircle2, FileDown } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips, Badge, PhotoInput, PhotoThumb, TempInput } from "./ui.jsx";
import { addDays, dayKey, daysSince, daysUntil, fmtDate, fmtNum, parseNum, saveFile, todayKey } from "./utils.js";
import { pdfDossier } from "./pdf.js";

export const REG_TYPES = {
  thermo: {
    title: "🌡️ Vérification des thermomètres",
    rule: "Une fois par mois : plonger la sonde dans un verre rempli de glace pilée + un peu d'eau (2 min). Elle doit afficher 0 °C (±1 °C). Sinon : étalonner ou remplacer le thermomètre.",
    every: 30,
  },
  pests: {
    title: "🐀 Lutte contre les nuisibles",
    rule: "Contrat avec une société (passages réguliers, souvent tous les 3 mois) + garder les rapports. Noter aussi toute trace observée (crottes, insectes, emballages rongés) et l'action menée.",
    every: 91,
  },
  training: {
    title: "🎓 Formation du personnel",
    rule: "Au moins une personne formée à l'hygiène alimentaire (formation 14 h, décret 2011-731) en restauration commerciale. Tout le personnel doit être formé aux bonnes pratiques. Garder les attestations.",
  },
  incident: {
    title: "📣 Réclamations et incidents",
    rule: "Noter toute réclamation client (intoxication, corps étranger…), produit non conforme d'un fournisseur ou panne d'équipement, avec la suite donnée. En cas de suspicion d'intoxication : garder les restes et prévenir la DDPP.",
  },
};
const INCIDENT_CAT = { client: "Réclamation client", fournisseur: "Fournisseur / produit", equipement: "Panne d'équipement", autre: "Autre" };

export default function Registres() {
  const { data } = useData();
  const [form, setForm] = useState(null);
  const [from, setFrom] = useState(dayKey(addDays(new Date(), -90)));
  const [to, setTo] = useState(todayKey());
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState(true);
  const regs = [...data.registers].sort((a, b) => b.at.localeCompare(a.at));

  const dossier = async () => {
    setBusy(true);
    try {
      const blob = await pdfDossier(data, from, to, { photos });
      await saveFile(blob, `dossier-controle-${from}_${to}.pdf`);
    } catch (e) {
      alert("Erreur PDF : " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="card pad dossier">
        <strong>📁 Dossier pour un contrôle sanitaire</strong>
        <span className="muted small">Un seul PDF avec tous les registres : températures, cuisson/refroidissement, traçabilité, huile, nettoyage et hotte, thermomètres, nuisibles, formation, réclamations et tableau des allergènes.</span>
        <div className="grid2">
          <Field label="Du">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Au">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Chips
          options={[{ value: 30, label: "1 mois" }, { value: 90, label: "3 mois" }, { value: 180, label: "6 mois" }, { value: 365, label: "1 an" }]}
          value={null}
          onChange={(n) => n && (setFrom(dayKey(addDays(new Date(), -n))), setTo(todayKey()))}
        />
        <label className="check">
          <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} />
          Inclure les photos des étiquettes (PDF plus lourd)
        </label>
        <button className="btn btn-primary" disabled={busy} onClick={dossier}>
          <FileDown size={18} /> {busy ? "Création du dossier…" : "Créer le dossier PDF"}
        </button>
      </div>

      {Object.entries(REG_TYPES).map(([type, def]) => {
        const list = regs.filter((r) => r.type === type);
        const last = list[0];
        const due = def.every && (!last || daysSince(last.at) >= def.every);
        return (
          <div key={type} className="day-group">
            <div className="row between">
              <h3 className="section-title">{def.title}</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setForm({ type })}>
                <Plus size={16} /> Ajouter
              </button>
            </div>
            <p className="muted small rule">ℹ️ {def.rule}</p>
            {def.every && (
              <div className={"alert " + (due ? "warn" : "ok")}>
                {last ? `Dernier : ${fmtDate(last.at)}` : "Jamais enregistré"}
                {last && ` · prochain conseillé : ${fmtDate(dayKey(addDays(new Date(last.at), def.every)))}`}
                {due && " — à faire"}
              </div>
            )}
            {list.length > 0 && (
              <div className="card list">
                {list.slice(0, 8).map((r) => (
                  <div key={r.id} className="list-row" role="button" onClick={() => setForm(r)}>
                    {r.photoId && <PhotoThumb id={r.photoId} />}
                    <span className="list-main">
                      <strong>{summary(r)}</strong>
                      <span className="muted small">
                        {fmtDate(r.at)}
                        {r.by ? ` · ${r.by}` : ""}
                      </span>
                    </span>
                    {r.type === "thermo" && <Badge tone={r.ok ? "ok" : "ko"}>{r.ok ? "OK" : "Écart"}</Badge>}
                    {r.type === "incident" && <Badge tone={r.closed ? "ok" : "warn"}>{r.closed ? "Clos" : "En cours"}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {form && <RegForm initial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function summary(r) {
  if (r.type === "thermo") return `${r.thermometer || "Thermomètre"} : ${fmtNum(r.reading)} °C (écart ${fmtNum(r.gap)} °C)`;
  if (r.type === "pests") return r.kind === "visit" ? `Passage ${r.company || "société"}${r.observation ? " — " + r.observation : ""}` : `Observation : ${r.observation || ""}`;
  if (r.type === "training") return `${r.person}${r.course ? " — " + r.course : ""}`;
  return `${INCIDENT_CAT[r.category] || "Incident"} : ${r.description || ""}`;
}

function RegForm({ initial, onClose }) {
  const { data, save, remove } = useData();
  const isNew = !initial.id;
  const type = initial.type;
  const def = REG_TYPES[type];
  const lastThermo = data.registers.filter((r) => r.type === "thermo").sort((a, b) => b.at.localeCompare(a.at))[0];
  const [f, setF] = useState(() => ({
    date: initial.at ? dayKey(initial.at) : todayKey(),
    by: data.settings.operator || "",
    thermometer: lastThermo?.thermometer || "Thermomètre sonde",
    method: "ice",
    reading: "",
    action: "",
    kind: "visit",
    company: data.registers.filter((r) => r.type === "pests" && r.company).sort((a, b) => b.at.localeCompare(a.at))[0]?.company || "",
    observation: "",
    person: "",
    role: "",
    course: "Formation hygiène alimentaire (14 h)",
    org: "",
    category: "client",
    description: "",
    closed: false,
    photoId: null,
    ...initial,
    reading: initial.reading != null ? String(initial.reading).replace(".", ",") : "",
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));
  const expected = f.method === "boil" ? 100 : 0;
  const reading = parseNum(f.reading);
  const gap = Number.isFinite(reading) ? +(reading - expected).toFixed(1) : null;
  const ok = gap !== null && Math.abs(gap) <= 1;

  const submit = async () => {
    const rec = { ...f, type, at: new Date(f.date + "T12:00:00").toISOString(), by: (f.by || "").trim() };
    delete rec.date;
    if (type === "thermo") {
      if (!Number.isFinite(reading)) return alert("Indique la température lue.");
      if (!ok && !f.action.trim()) return alert("Écart de plus de 1 °C : indique l'action (étalonnage, remplacement…).");
      Object.assign(rec, { reading, expected, gap, ok });
    }
    if (type === "training" && !f.person.trim()) return alert("Indique le nom de la personne.");
    if (type === "incident" && !f.description.trim()) return alert("Décris l'incident.");
    await save("registers", rec);
    onClose();
  };

  return (
    <Sheet
      title={def.title.replace(/^\S+\s/, "")}
      onClose={onClose}
      footer={
        <div className="row gap">
          {!isNew && (
            <button className="btn btn-ghost danger" onClick={async () => confirm("Supprimer cet enregistrement ?") && (await remove("registers", initial.id), onClose())}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>
            <CheckCircle2 size={20} /> Enregistrer
          </button>
        </div>
      }
    >
      <div className="alert info">ℹ️ {def.rule}</div>
      <div className="grid2">
        <Field label={type === "training" ? "Date de la formation" : "Date"}>
          <input className="input" type="date" value={f.date} max={todayKey()} onChange={set("date")} />
        </Field>
        {type !== "training" && (
          <Field label="Par">
            <input className="input" value={f.by} onChange={set("by")} maxLength={20} />
          </Field>
        )}
      </div>

      {type === "thermo" && (
        <>
          <Field label="Thermomètre">
            <input className="input" value={f.thermometer} onChange={set("thermometer")} />
          </Field>
          <Chips options={[{ value: "ice", label: "Glace fondante (0 °C)" }, { value: "boil", label: "Eau bouillante (100 °C)" }]} value={f.method} onChange={(v) => v && set("method")(v)} />
          <Field label="Température affichée">
            <TempInput value={f.reading} onChange={set("reading")} />
          </Field>
          {gap !== null && <div className={"alert " + (ok ? "ok" : "ko")}>Écart : {fmtNum(gap)} °C — {ok ? "conforme (±1 °C)" : "NON conforme"}</div>}
          {gap !== null && !ok && (
            <Field label="Action *">
              <input className="input" list="thermo-actions" value={f.action} onChange={set("action")} />
              <datalist id="thermo-actions">
                <option value="Thermomètre étalonné (recalibré)" />
                <option value="Thermomètre remplacé" />
                <option value="Pile changée, nouvelle vérification OK" />
              </datalist>
            </Field>
          )}
        </>
      )}

      {type === "pests" && (
        <>
          <Chips options={[{ value: "visit", label: "Passage de la société" }, { value: "observation", label: "Observation interne" }]} value={f.kind} onChange={(v) => v && set("kind")(v)} />
          {f.kind === "visit" && (
            <Field label="Société">
              <input className="input" value={f.company} onChange={set("company")} />
            </Field>
          )}
          <Field label={f.kind === "visit" ? "Observations du technicien" : "Qu'as-tu observé ? (où, quoi)"}>
            <input className="input" value={f.observation} onChange={set("observation")} placeholder={f.kind === "visit" ? "ex : RAS, appâts remplacés" : "ex : crottes de souris réserve"} />
          </Field>
          <Field label="Action menée">
            <input className="input" value={f.action} onChange={set("action")} placeholder="ex : nettoyage, produits jetés, société appelée" />
          </Field>
          <PhotoInput photoId={f.photoId} onChange={set("photoId")} label="Photo du rapport / de l'observation" />
        </>
      )}

      {type === "training" && (
        <>
          <div className="grid2">
            <Field label="Nom">
              <input className="input" value={f.person} onChange={set("person")} />
            </Field>
            <Field label="Poste">
              <input className="input" value={f.role} onChange={set("role")} placeholder="ex : gérant, cuisinier" />
            </Field>
          </div>
          <Field label="Formation">
            <input className="input" value={f.course} onChange={set("course")} />
          </Field>
          <Field label="Organisme">
            <input className="input" value={f.org} onChange={set("org")} />
          </Field>
          <PhotoInput photoId={f.photoId} onChange={set("photoId")} label="Photo de l'attestation" />
        </>
      )}

      {type === "incident" && (
        <>
          <Chips options={Object.entries(INCIDENT_CAT).map(([value, label]) => ({ value, label }))} value={f.category} onChange={(v) => v && set("category")(v)} />
          <Field label="Description">
            <input className="input" value={f.description} onChange={set("description")} placeholder="ex : client malade après un tacos du 10/11" />
          </Field>
          <Field label="Action / suite donnée">
            <input className="input" value={f.action} onChange={set("action")} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={!!f.closed} onChange={set("closed")} />
            Incident clos (traité)
          </label>
          <PhotoInput photoId={f.photoId} onChange={set("photoId")} label="Photo (facultatif)" />
        </>
      )}
      {!isNew && type === "pests" && f.kind === "visit" && (
        <p className="muted small">Prochain passage conseillé : {fmtDate(dayKey(addDays(new Date(initial.at), 91)))} ({daysUntil(dayKey(addDays(new Date(initial.at), 91)))} j)</p>
      )}
    </Sheet>
  );
}
