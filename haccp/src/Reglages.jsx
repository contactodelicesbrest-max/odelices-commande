import { useEffect, useRef, useState } from "react";
import { onCloudStatus, restoreFromCloud, syncNow } from "./cloud.js";
import { coldMeats } from "./Process.jsx";
import { CHARSETS, charsetOf, isPrintAvailable, listPrinters, printCharsetTest, printTest } from "./printer.js";
import { Plus, Trash2, FileDown, Upload, Download, Thermometer, Droplets, Pencil, ArrowUp, ArrowDown, Cloud, CloudDownload, RefreshCw } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips } from "./ui.jsx";
import { EQUIP_TYPES, exportAll, importAll } from "./db.js";
import { addDays, dayKey, fmtNum, parseNum, saveFile, todayKey } from "./utils.js";
import { pdfCleaning, pdfOil, pdfProcess, pdfReceptions, pdfStock, pdfTemperatures, pdfTrace } from "./pdf.js";

export default function Reglages({ go }) {
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
      const fn = { temps: pdfTemperatures, process: pdfProcess, trace: pdfTrace, oil: pdfOil, reception: pdfReceptions, clean: pdfCleaning, stock: pdfStock }[kind];
      const name = { temps: "temperatures", process: "cuisson-refroidissement", trace: "tracabilite", oil: "huile", reception: "receptions", clean: "nettoyage", stock: "stock" }[kind];
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
      <button className="btn btn-ghost" onClick={() => go("memo")}>📖 Mémo des règles HACCP appliquées</button>
      <h3 className="section-title">Général</h3>
      <div className="card pad">
        <Field label="Nom de l'établissement">
          <input className="input" defaultValue={s.shopName} onBlur={(e) => updateSettings({ shopName: e.target.value.trim() })} />
        </Field>
        <Field label="Initiales de l'opérateur (pré-remplies dans les formulaires)">
          <input className="input" defaultValue={s.operator} maxLength={12} onBlur={(e) => updateSettings({ operator: e.target.value.trim() })} />
        </Field>
      </div>

      <h3 className="section-title">Viandes cuites puis conservées au froid</h3>
      <div className="card pad">
        <Field label="Liste (séparée par des virgules)" hint="Ces viandes suivent le circuit : cuisson → refroidissement rapide → frigo (+3 °C, J+3) → remise en température. Le kebab est traité à part (broche).">
          <input className="input" defaultValue={coldMeats(s).join(", ")} onBlur={(e) => updateSettings({ coldMeats: e.target.value })} />
        </Field>
      </div>

      <h3 className="section-title">Imprimante d'étiquettes DLC (Bluetooth)</h3>
      <PrinterCard settings={s} updateSettings={updateSettings} />

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
            ["process", "Cuisson / refroid."],
            ["trace", "Traçabilité (photos)"],
            ["oil", "Huile de friture"],
            ["reception", "Réceptions"],
            ["clean", "Nettoyage"],
            ["stock", "Stock"],
          ].map(([k, l]) => (
            <button key={k} className="btn btn-ghost" disabled={!!busy} onClick={() => report(k)}>
              <FileDown size={18} /> {busy === k ? "Création…" : l}
            </button>
          ))}
        </div>
      </div>

      <h3 className="section-title">Sauvegarde automatique (cloud)</h3>
      <CloudCard onRestored={reload} />

      <h3 className="section-title">Sauvegarde manuelle (fichier)</h3>
      <div className="card pad">
        <p className="muted small">
          En plus de la sauvegarde automatique, tu peux exporter un fichier de sauvegarde (à garder sur ton Drive ou par mail).
          {s.lastBackup && <><br />Dernier fichier : {new Date(s.lastBackup).toLocaleString("fr-FR")}</>}
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
      <div className="alert info">ℹ️ {EQUIP_TYPES[f.type]?.rule}</div>
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

function CloudCard({ onRestored }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onCloudStatus(setSt), []);
  if (!st) return null;
  const label = {
    ok: "✅ Données sauvegardées",
    syncing: "⏳ Envoi en cours…",
    offline: "📴 Hors connexion",
    error: "⚠️ Erreur de sauvegarde",
    idle: "…",
  }[st.state];
  const restore = async () => {
    if (!confirm("Récupérer les données sauvegardées dans le cloud sur ce téléphone ? (les données déjà présentes sont conservées)")) return;
    setBusy(true);
    try {
      const n = await restoreFromCloud();
      await onRestored();
      alert(`${n} élément(s) récupéré(s) ✓`);
    } catch (e) {
      alert("Récupération impossible : " + (e.message === "timeout" ? "pas de connexion" : e.message));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card pad">
      <div className="row gap">
        <Cloud size={22} className={st.state === "error" ? "ko-text" : st.state === "ok" ? "ok-text" : "muted"} />
        <div className="col">
          <strong>{label}</strong>
          <span className="muted small">
            {st.lastOk ? `Dernière sauvegarde : ${new Date(st.lastOk).toLocaleString("fr-FR")}` : "Jamais sauvegardé pour l'instant"}
          </span>
        </div>
      </div>
      {st.error && <div className="alert ko">{st.error}</div>}
      <p className="muted small">
        Chaque relevé, photo, contrôle ou mouvement de stock est envoyé automatiquement quelques secondes après (photos comprises). Sans réseau, l'envoi se fait dès que la connexion revient. Sur un nouveau téléphone, installe l'appli puis appuie sur « Récupérer ».
      </p>
      <div className="grid2">
        <button className="btn btn-ghost" disabled={busy || st.state === "syncing"} onClick={() => syncNow()}>
          <RefreshCw size={18} /> Envoyer maintenant
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={restore}>
          <CloudDownload size={18} /> {busy ? "Récupération…" : "Récupérer"}
        </button>
      </div>
    </div>
  );
}

function PrinterCard({ settings, updateSettings }) {
  const [devices, setDevices] = useState(null);
  const [busy, setBusy] = useState(false);
  const native = isPrintAvailable();
  const search = async () => {
    setBusy(true);
    try {
      setDevices(await listPrinters());
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  const test = async (fn = printTest) => {
    setBusy(true);
    try {
      await fn(settings);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card pad">
      {!native && <div className="alert warn">L'impression Bluetooth fonctionne uniquement dans l'appli Android (APK).</div>}
      <p className="muted small">
        1. Allume l'imprimante et appaire-la dans les paramètres Bluetooth d'Android (code souvent 0000 ou 1234).
        2. Choisis-la ci-dessous. Elle ne peut être connectée qu'à un appareil à la fois : si la tablette Uber Eats est connectée, l'impression peut échouer.
      </p>
      <div className="row gap">
        <div className="col list-main">
          <strong>{settings.printerName || "Aucune imprimante choisie"}</strong>
          {settings.printerAddress && <span className="muted small">{settings.printerAddress}</span>}
        </div>
        <button className="btn btn-ghost" disabled={busy || !native} onClick={search}>Choisir</button>
      </div>
      {devices && (
        <div className="list">
          {!devices.length && <p className="muted small">Aucun appareil appairé. Appaire d'abord l'imprimante dans les paramètres Bluetooth.</p>}
          {devices.map((d) => (
            <button
              key={d.address}
              className={"list-row" + (d.address === settings.printerAddress ? " selected" : "")}
              onClick={() => {
                updateSettings({ printerAddress: d.address, printerName: d.name });
                setDevices(null);
              }}
            >
              <span className="list-main">
                <strong>{d.name}</strong>
                <span className="muted small">{d.address}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <Field label="Largeur du papier">
        <Chips options={[{ value: 58, label: "58 mm" }, { value: 80, label: "80 mm" }]} value={Number(settings.printerWidth) || 58} onChange={(v) => v && updateSettings({ printerWidth: v })} />
      </Field>
      <Field label="Nombre d'étiquettes par produit">
        <Chips options={[1, 2, 3]} value={Number(settings.printerCopies) || 1} onChange={(v) => v && updateSettings({ printerCopies: v })} />
      </Field>
      <Field label="Réglage des accents" hint="Imprime « Test des accents », puis choisis le numéro où é è à ç et ° sont corrects.">
        <Chips
          options={Object.entries(CHARSETS).map(([value, c]) => ({ value, label: c.label }))}
          value={charsetOf(settings)}
          onChange={(v) => v && updateSettings({ printerCharset: v })}
        />
      </Field>
      <button className="btn btn-ghost" disabled={busy || !native || !settings.printerAddress} onClick={() => test(printCharsetTest)}>
        Test des accents
      </button>
      <label className="check">
        <input type="checkbox" checked={!!settings.printerAuto} onChange={(e) => updateSettings({ printerAuto: e.target.checked })} />
        Imprimer automatiquement l'étiquette à chaque produit enregistré
      </label>
      <button className="btn btn-primary" disabled={busy || !native || !settings.printerAddress} onClick={() => test()}>
        {busy ? "…" : "Imprimer une étiquette test"}
      </button>
    </div>
  );
}
