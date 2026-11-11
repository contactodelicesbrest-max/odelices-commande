import { useMemo, useState } from "react";
import { CheckCircle2, FileDown, Plus, Trash2, Monitor } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Badge } from "./ui.jsx";
import { ALLERGENS, allergenById, DISH_GROUPS } from "./allergens.js";
import { saveFile, todayKey } from "./utils.js";
import { pdfAllergens } from "./pdf.js";

export default function Allergenes() {
  const { data, save } = useData();
  const [edit, setEdit] = useState(null);
  const [display, setDisplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const dishes = useMemo(() => [...data.dishes].sort((a, b) => DISH_GROUPS.indexOf(a.group) - DISH_GROUPS.indexOf(b.group) || (a.order ?? 0) - (b.order ?? 0)), [data.dishes]);
  const toVerify = dishes.filter((d) => !d.verified).length;
  const groups = DISH_GROUPS.filter((g) => dishes.some((d) => d.group === g));

  const exportPdf = async () => {
    if (toVerify && !confirm(`${toVerify} élément(s) ne sont pas encore vérifiés. Imprimer quand même ?`)) return;
    setBusy(true);
    try {
      await saveFile(await pdfAllergens(data), `allergenes-${todayKey()}.pdf`);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="alert info">
        ℹ️ Obligatoire : informer les clients des 14 allergènes de chaque plat (règlement UE 1169/2011, décret 2015-447). Affiche le tableau au comptoir ou garde-le à disposition. Mets-le à jour à chaque changement de produit ou de fournisseur.
      </div>
      {toVerify > 0 && (
        <div className="alert warn">
          {toVerify} élément(s) pré-remplis <strong>à vérifier</strong> avec les étiquettes de tes produits (chaque marque est différente), puis coche « Vérifié ».
        </div>
      )}
      <div className="grid2">
        <button className="btn btn-primary" disabled={busy} onClick={exportPdf}>
          <FileDown size={18} /> Tableau PDF
        </button>
        <button className="btn btn-ghost" onClick={() => setDisplay(true)}>
          <Monitor size={18} /> Affichage client
        </button>
      </div>

      {groups.map((g) => (
        <div key={g} className="day-group">
          <div className="day-title">{g}</div>
          <div className="card list">
            {dishes
              .filter((d) => d.group === g)
              .map((d) => (
                <button key={d.id} className="list-row" onClick={() => setEdit(d)}>
                  <span className="list-main">
                    <strong>{d.name}</strong>
                    <span className="allergen-chips">
                      {d.allergens?.length ? (
                        d.allergens.map((a) => (
                          <span key={a} className="allergen-chip">
                            {allergenById[a]?.icon} {allergenById[a]?.label}
                          </span>
                        ))
                      ) : (
                        <span className="muted small">Aucun allergène</span>
                      )}
                      {d.traces?.length > 0 && <span className="muted small">· traces : {d.traces.map((a) => allergenById[a]?.label).join(", ")}</span>}
                    </span>
                  </span>
                  {d.verified ? <Badge tone="ok">✓ Vérifié</Badge> : <Badge tone="warn">À vérifier</Badge>}
                </button>
              ))}
          </div>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={() => setEdit({ group: "Autre", allergens: [], verified: false, order: dishes.length })}>
        <Plus size={18} /> Ajouter un élément
      </button>

      {edit && <DishForm initial={edit} onClose={() => setEdit(null)} />}
      {display && <ClientDisplay dishes={dishes} groups={groups} onClose={() => setDisplay(false)} />}
    </div>
  );
}

function DishForm({ initial, onClose }) {
  const { save, remove } = useData();
  const [f, setF] = useState({ name: "", group: "Autre", allergens: [], traces: [], verified: false, ...initial });
  const toggle = (field, id) =>
    setF((s) => {
      const set = new Set(s[field] || []);
      set.has(id) ? set.delete(id) : set.add(id);
      return { ...s, [field]: [...set] };
    });
  const submit = async () => {
    if (!f.name.trim()) return alert("Donne un nom.");
    await save("dishes", { ...f, name: f.name.trim(), verified: true });
    onClose();
  };
  return (
    <Sheet
      title={initial.id ? f.name : "Nouvel élément"}
      onClose={onClose}
      footer={
        <div className="row gap">
          {initial.id && (
            <button className="btn btn-ghost danger" onClick={async () => confirm(`Supprimer « ${initial.name} » ?`) && (await remove("dishes", initial.id), onClose())}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>
            <CheckCircle2 size={20} /> Enregistrer (vérifié)
          </button>
        </div>
      }
    >
      <div className="grid2">
        <Field label="Nom">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Catégorie">
          <select className="input" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
            {DISH_GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
      </div>
      <span className="field-label">Contient</span>
      <div className="allergen-grid">
        {ALLERGENS.map((a) => (
          <button key={a.id} type="button" className={"allergen-btn" + (f.allergens?.includes(a.id) ? " on" : "")} onClick={() => toggle("allergens", a.id)}>
            <span>{a.icon}</span> {a.label}
          </button>
        ))}
      </div>
      <span className="field-label">Peut contenir (traces)</span>
      <div className="allergen-grid">
        {ALLERGENS.map((a) => (
          <button key={a.id} type="button" className={"allergen-btn trace" + (f.traces?.includes(a.id) ? " on" : "")} onClick={() => toggle("traces", a.id)}>
            <span>{a.icon}</span> {a.label}
          </button>
        ))}
      </div>
      <p className="muted small">Vérifie la liste des ingrédients sur l'étiquette du produit (les allergènes y sont écrits en gras). En enregistrant, l'élément est marqué « vérifié ».</p>
    </Sheet>
  );
}

function ClientDisplay({ dishes, groups, onClose }) {
  return (
    <div className="client-display" onClick={onClose}>
      <h2>Allergènes — informations clients</h2>
      <div className="client-table-wrap">
        <table className="client-table">
          <thead>
            <tr>
              <th></th>
              {ALLERGENS.map((a) => (
                <th key={a.id}>
                  <div>{a.icon}</div>
                  <small>{a.short}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => [
              <tr key={g} className="grp">
                <td colSpan={ALLERGENS.length + 1}>{g}</td>
              </tr>,
              ...dishes
                .filter((d) => d.group === g)
                .map((d) => (
                  <tr key={d.id}>
                    <td className="dish">{d.name}</td>
                    {ALLERGENS.map((a) => (
                      <td key={a.id} className={d.allergens?.includes(a.id) ? "yes" : d.traces?.includes(a.id) ? "trace" : ""}>
                        {d.allergens?.includes(a.id) ? "●" : d.traces?.includes(a.id) ? "○" : ""}
                      </td>
                    ))}
                  </tr>
                )),
            ])}
          </tbody>
        </table>
      </div>
      <p className="small">● contient · ○ peut contenir (traces). Pour toute question, demandez au personnel. — Touchez pour fermer</p>
    </div>
  );
}
