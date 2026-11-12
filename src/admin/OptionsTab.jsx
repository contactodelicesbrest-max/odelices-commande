import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "../lib/store.jsx";
import { Field, MoveButtons, Num, Text, Toggle, move, uid } from "./ui.jsx";

export default function OptionsTab() {
  const { data, update } = useStore();
  const { groups, products } = data.menu;
  const [gid, setGid] = useState(groups[0]?.id);
  const gi = Math.max(0, groups.findIndex((g) => g.id === gid));
  const g = groups[gi];
  const usedBy = (id) => products.filter((p) => p.links.some((l) => l.groupId === id));

  const setGroup = (fn) => update((d) => fn(d.menu.groups[gi]));

  return (
    <div className="menu-tab">
      <div className="cat-col">
        <div className="col-head">
          <h3>Listes d'options</h3>
          <button
            className="btn-sm btn-primary"
            onClick={() => {
              const id = uid("g");
              update((d) => void d.menu.groups.push({ id, name: "Nouvelle liste", options: [] }));
              setGid(id);
            }}
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
        <ul className="cat-list">
          {groups.map((x) => (
            <li key={x.id} className={`cat-item ${x.id === g?.id ? "on" : ""}`} onClick={() => setGid(x.id)}>
              <span className="cat-name">
                {x.name}
                <small>
                  {x.options.length} options · {usedBy(x.id).length} produits
                  {x.options.some((o) => o.available === false) ? " · ruptures" : ""}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="prod-col">
        {g && (
          <>
            <div className="col-head">
              <Field label="Nom de la liste" className="grow">
                <Text value={g.name} onChange={(v) => setGroup((x) => void (x.name = v))} />
              </Field>
              <button
                className="btn-ghost danger btn-sm"
                onClick={() => {
                  const u = usedBy(g.id);
                  if (u.length) return window.alert(`Cette liste est utilisée par : ${u.map((p) => p.name).join(", ")}.\nRetirez-la d'abord de ces produits.`);
                  if (window.confirm(`Supprimer la liste « ${g.name} » ?`)) update((d) => void (d.menu.groups = d.menu.groups.filter((x) => x.id !== g.id)));
                }}
              >
                <Trash2 size={16} /> Supprimer la liste
              </button>
            </div>
            <p className="field-hint">
              Utilisée par : {usedBy(g.id).map((p) => p.name).join(", ") || "aucun produit"}. Une modification ici s'applique à tous ces produits. Le prix d'une option
              s'ajoute au prix du produit.
            </p>
            <div className="rows opt-rows">
              <div className="row row-head">
                <span>Option</span>
                <span>Prix en plus</span>
                <span>Disponible</span>
                <span />
              </div>
              {g.options.map((o, i) => (
                <div key={o.id} className={`row ${o.available === false ? "out" : ""}`}>
                  <Text value={o.name} onChange={(v) => setGroup((x) => void (x.options[i].name = v))} />
                  <div className="with-unit">
                    <Num value={o.price} onChange={(v) => setGroup((x) => void (x.options[i].price = v))} />
                    <span>€</span>
                  </div>
                  <Toggle checked={o.available !== false} onChange={(v) => setGroup((x) => void (x.options[i].available = v))} label={o.available !== false ? "Oui" : "Épuisé"} />
                  <span className="row-actions">
                    <MoveButtons
                      disableUp={i === 0}
                      disableDown={i === g.options.length - 1}
                      onUp={() => setGroup((x) => void (x.options = move(x.options, i, i - 1)))}
                      onDown={() => setGroup((x) => void (x.options = move(x.options, i, i + 1)))}
                    />
                    <button className="icon-btn danger" onClick={() => setGroup((x) => void x.options.splice(i, 1))}>
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              ))}
              <button className="btn-ghost btn-sm" onClick={() => setGroup((x) => void x.options.push({ id: uid("o"), name: "", price: 0, available: true }))}>
                <Plus size={16} /> Ajouter une option
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
