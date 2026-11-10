import { useRef, useState } from "react";
import { Plus, Trash2, FileDown, Upload, Download, Thermometer, Droplets, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips } from "./ui.jsx";
import { EQUIP_TYPES, exportAll, importAll } from "./db.js";
import { addDays, dayKey, fmtNum, parseNum, saveFile, todayKey } from "./utils.js";
import { pdfOil, pdfStock, pdfTemperatures, pdfTrace } from "./pdf.js";

export default function Reglages() {
  const { data, save, remove, updateSettings, reload } = useData();
  const s = data.settings;
  const [eqEdit, setEqEdit] = useState(null);
  const [frEdit, setFrEdit] = useState(null);
  const [from, setFrom] = useState(dayKey(addDays(new Date(), -30)));
  const [to, setTo] = useState(todayKey());
  const [busy, setBusy] = useState("");
  const fileRef = useRef();

  const equipments = [...data.equipments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const fryers = [...data.fryers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const move = async (store, list, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    await save(store, { ...a, order: j });
    await save(store, { ...b, order: i });
  };

  const report = async (kind) => {
    setBusy(kind);
    try {
      const fn = { temps: pdfTemperatures, trace: pdfTrace, oil: pdfOil, stock: pdfStock }[kind];
      const name = { temps: "temperatures", trace: "tracabilite", oil: "huile", stock: "stock" }[kind];
      const blob = await fn(data, from, to);
      await saveFile(blob, `haccp-${name}-${from}_${to}.pdf`);
    } catch (e) {
      alert("Erreur lors de la création du PDF : " + e.message);
    } finally {
      setBusy("");
    }
  };

  const backup = async () => {
    setBusy("backup");
    try {
      const json = await exportAll();
      const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
      await saveFile(blob, `sauvegarde-haccp-${todayKey()}.json`);
      await updateSettings({ lastBackup: new Date().toISOString() });
    } catch (e) {
      alert("Erreur de sauvegarde : " + e.message);
    } finally {
      setBusy("");
    }
  };

  const restore = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!confirm("Restaurer cette sauvegarde ? Les données actuelles de l'appli seront REMPLACÉES.")) return;
    try {
      const json = JSON.parse(await f.text());
      await importAll(json);
      await reload();
      alert("Sauvegarde restaurée ✓");
    } catch (err) {
      alert("Restauration impossible : " + err.message);
    }
  };

  return (
    <div className="page">
      <h3 className="section-title">Général</h3>
      <div className="card pad">
        <Field label="Nom de l'établissement">
          <input className="input" defaultValue={s.shopName} onBlur={(e) => updateSettings({ shopName: e.target.value.trim() })} />
        </Field>
        <Field label="Initiales de l'opérateur (pré-remplies dans les formulaires)">
          <input className="input" defaultValue={s.operator} maxLength={12} onBlur={(e) => updateSettings({ operator: e.target.value.trim() })} />
        </Field>
      </div>

      <h3 className="section-title">Frigos & congélateurs</h3>
      <div className="card list">
        {equipments.map((eq, i) => (
          <div key={eq.id} className="list-row">
            <Thermometer size={20} className="muted" />
            <span className="list-main" onClick={() => setEqEdit(eq)}>
              <strong>{eq.name}</strong>
              <span className="muted small">
                {EQUIP_TYPES[eq.type]?.label} · {fmtNum(eq.min)} à {fmtNum(eq.max)} °C
              </span>
            </span>
            <button className="icon-btn" onClick={() => move("equipments", equipments, i, -1)} aria-label="Monter"><ArrowUp size={18} /></button>
            <button className="icon-btn" onClick={() => move("equipments", equipments, i, 1)} aria-label="Descendre"><ArrowDown size={18} /></button>
            <button className="icon-btn" onClick={() => setEqEdit(eq)} aria-label="Modifier"><Pencil size={18} /></button>
          </div>
        ))}
        <button className="list-row add-row" onClick={() => setEqEdit({ type: "frigo", ...EQUIP_TYPES.frigo, order: equipments.length })}>
          <Plus size={20} /> Ajouter un équipement
        </button>
      </div>

      <h3 className="section-title">Friteuses</h3>
      <div className="card list">
        {fryers.map((fr, i) => (
          <div key={fr.id} className="list-row">
            <Droplets size={20} className="muted" />
            <span className="list-main" onClick={() => setFrEdit(fr)}>
              <strong>{fr.name}</strong>
              <span className="muted small">
                {fr.capacity ? `${fmtNum(fr.capacity)} L · ` : ""}changement max {fr.maxDays || s.oilMaxDays || 7} j
              </span>
            </span>
            <button className="icon-btn" onClick={() => move("fryers", fryers, i, -1)} aria-label="Monter"><ArrowUp size={18} /></button>
            <button className="icon-btn" onClick={() => move("fryers", fryers, i, 1)} aria-label="Descendre"><ArrowDown size={18} /></button>
            <button className="icon-btn" onClick={() => setFrEdit(fr)} aria-label="Modifier"><Pencil size={18} /></button>
          </div>
        ))}
        <button className="list-row add-row" onClick={() => setFrEdit({ order: fryers.length })}>
          <Plus size={20} /> Ajouter une friteuse
        </button>
      </div>
      <div className="card pad grid2">
        <Field label="Changement d'huile max (jours)">
          <input className="input" inputMode="numeric" defaultValue={s.oilMaxDays} onBlur={(e) => updateSettings({ oilMaxDays: parseNum(e.target.value) || 7 })} />
        </Field>
        <Field label="Limite composés polaires (%)">
          <input className="input" inputMode="decimal" defaultValue={s.oilTpmMax} onBlur={(e) => updateSettings({ oilTpmMax: parseNum(e.target.value) || 25 })} />
        </Field>
      </div>

      <h3 className="section-title">Rapports PDF (contrôle sanitaire)</h3>
      <div className="card pad">
        <div className="grid2">
          <Field label="Du">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Au">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Chips
          options={[{ value: 7, label: "7 jours" }, { value: 30, label: "30 jours" }, { value: 90, label: "3 mois" }]}
          value={null}
          onChange={(n) => {
            if (!n) return;
            setFrom(dayKey(addDays(new Date(), -n)));
            setTo(todayKey());
          }}
        />
        <div className="grid2">
          {[
            ["temps", "Températures"],
            ["trace", "Traçabilité (photos)"],
            ["oil", "Huile de friture"],
            ["stock", "Stock"],
          ].map(([k, l]) => (
            <button key={k} className="btn btn-ghost" disabled={!!busy} onClick={() => report(k)}>
              <FileDown size={18} /> {busy === k ? "Création…" : l}
            </button>
          ))}
        </div>
      </div>

      <h3 className="section-title">Sauvegarde</h3>
      <div className="card pad">
        <p className="muted small">
          Les données sont enregistrées sur cet appareil uniquement. Fais une sauvegarde régulièrement (envoie-la sur ton Drive ou par mail) pour ne rien perdre en cas de casse ou de changement de téléphone.
          {s.lastBackup && <><br />Dernière sauvegarde : {new Date(s.lastBackup).toLocaleString("fr-FR")}</>}
        </p>
        <div className="grid2">
          <button className="btn btn-primary" disabled={!!busy} onClick={backup}>
            <Download size={18} /> {busy === "backup" ? "…" : "Sauvegarder"}
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current.click()}>
            <Upload size={18} /> Restaurer
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={restore} />
      </div>
      <p className="muted small center">O'Délices HACCP · v1.0</p>

      {eqEdit && <EquipmentForm initial={eqEdit} onClose={() => setEqEdit(null)} onSave={save} onRemove={remove} />}
      {frEdit && <FryerForm initial={frEdit} onClose={() => setFrEdit(null)} onSave={save} onRemove={remove} />}
    </div>
  );
}

function EquipmentForm({ initial, onClose, onSave, onRemove }) {
  const [f, setF] = useState({ name: "", ...initial, min: String(initial.min ?? "").replace(".", ","), max: String(initial.max ?? "").replace(".", ",") });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async () => {
    const min = parseNum(f.min), max = parseNum(f.max);
    if (!f.name.trim()) return alert("Donne un nom à l'équipement.");
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return alert("Seuils de température invalides.");
    await onSave("equipments", { ...f, name: f.name.trim(), min, max });
    onClose();
  };
  return (
    <Sheet
      title={initial.id ? "Modifier l'équipement" : "Nouvel équipement"}
      onClose={onClose}
      footer={
        <div className="row gap">
          {initial.id && (
            <button className="btn btn-ghost danger" onClick={async () => {
              if (confirm(`Supprimer « ${initial.name} » ? (les relevés passés sont conservés)`)) { await onRemove("equipments", initial.id); onClose(); }
            }}><Trash2 size={18} /></button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>Enregistrer</button>
        </div>
      }
    >
      <Field label="Nom">
        <input className="input" value={f.name} onChange={set("name")} placeholder="ex : Frigo boissons, Congélateur frites…" />
      </Field>
      <Field label="Type">
        <select
          className="input"
          value={f.type}
          onChange={(e) => {
            const t = EQUIP_TYPES[e.target.value];
            setF((s) => ({ ...s, type: e.target.value, min: String(t.min), max: String(t.max) }));
          }}
        >
          {Object.entries(EQUIP_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label="T° minimum (°C)"><input className="input" value={f.min} onChange={set("min")} /></Field>
        <Field label="T° maximum (°C)"><input className="input" value={f.max} onChange={set("max")} /></Field>
      </div>
      <p className="muted small">Repères : produits frais 0 à +4 °C, viande hachée/poisson 0 à +2 °C, surgelés -18 °C ou moins.</p>
    </Sheet>
  );
}

function FryerForm({ initial, onClose, onSave, onRemove }) {
  const [f, setF] = useState({ name: "", ...initial, capacity: String(initial.capacity ?? ""), maxDays: String(initial.maxDays ?? "") });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async () => {
    if (!f.name.trim()) return alert("Donne un nom à la friteuse.");
    await onSave("fryers", { ...f, name: f.name.trim(), capacity: parseNum(f.capacity) || null, maxDays: parseNum(f.maxDays) || null });
    onClose();
  };
  return (
    <Sheet
      title={initial.id ? "Modifier la friteuse" : "Nouvelle friteuse"}
      onClose={onClose}
      footer={
        <div className="row gap">
          {initial.id && (
            <button className="btn btn-ghost danger" onClick={async () => {
              if (confirm(`Supprimer « ${initial.name} » ?`)) { await onRemove("fryers", initial.id); onClose(); }
            }}><Trash2 size={18} /></button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>Enregistrer</button>
        </div>
      }
    >
      <Field label="Nom"><input className="input" value={f.name} onChange={set("name")} placeholder="ex : Friteuse frites" /></Field>
      <div className="grid2">
        <Field label="Capacité (L)"><input className="input" inputMode="decimal" value={f.capacity} onChange={set("capacity")} /></Field>
        <Field label="Changement max (jours)" hint="Vide = réglage général"><input className="input" inputMode="numeric" value={f.maxDays} onChange={set("maxDays")} /></Field>
      </div>
    </Sheet>
  );
}
