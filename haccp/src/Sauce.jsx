import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Printer, XCircle } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips, PhotoInput } from "./ui.jsx";
import { addDays, dayKey, daysUntil, fmtDate, toLocalInput } from "./utils.js";
import { isPrintAvailable, printLabelsSafe } from "./printer.js";
import { effectiveDlc, autoReplaceOn, olderLots, replaceOlderLots } from "./traceRules.js";

// Recettes maison par défaut (modifiables dans Réglages → Recettes maison).
// Sans étude de durée de vie : 3 jours maximum après la fabrication, à +3 °C.
export const DEFAULT_RECIPES = [
  {
    id: "sauce-blanche",
    name: "Sauce blanche (maison)",
    keepDays: 3,
    ingredients: ["Yaourt / fromage blanc", "Mayonnaise", "Ail", "Herbes / épices"],
    note: "Conserver à +3 °C dans un bac fermé. Si la mayonnaise est faite maison avec des œufs crus : à consommer dans la journée (œufs pasteurisés conseillés).",
  },
  {
    id: "harissa",
    name: "Harissa (maison)",
    keepDays: 3,
    ingredients: ["Piments", "Ail", "Huile", "Épices"],
    note: "Ail et piments dans l'huile : toujours au frigo (risque botulique à température ambiante). 3 jours maximum.",
  },
  {
    id: "sauce-piment-tomate",
    name: "Sauce piment (tomate, maison)",
    keepDays: 3,
    ingredients: ["Sauce tomate / concentré", "Piments", "Ail", "Oignon", "Huile", "Épices"],
    note: "Si la sauce est cuite : la refroidir rapidement (moins de +10 °C en moins de 2 h, en bac peu profond) avant de la mettre au frigo à +3 °C. Boîte de tomate ouverte : la transvaser (ne pas garder dans la boîte métal). 3 jours maximum.",
  },
];

export const recipesOf = (settings) => (Array.isArray(settings?.recipes) && settings.recipes.length ? settings.recipes : DEFAULT_RECIPES);

const newIng = (name = "") => ({ key: Math.random().toString(36).slice(2), name, lot: "", dlc: "", traceId: "" });

export default function SauceForm({ onClose }) {
  const { data, save } = useData();
  const recipes = recipesOf(data.settings);
  const [recipeId, setRecipeId] = useState(recipes[0]?.id || "");
  const recipe = recipes.find((r) => r.id === recipeId);
  const [ings, setIngs] = useState(() => (recipes[0]?.ingredients || []).map((n) => newIng(n)));
  const [atLocal, setAtLocal] = useState(toLocalInput(new Date()));
  const [keepDays, setKeepDays] = useState(recipes[0]?.keepDays || 3);
  const [qty, setQty] = useState("");
  const [by, setBy] = useState(data.settings.operator || "");
  const [photoId, setPhotoId] = useState(null);
  const canPrint = isPrintAvailable() && !!data.settings.printerAddress;
  const [doPrint, setDoPrint] = useState(canPrint);

  // Produits ouverts / préparations en cours : on peut y piocher le lot et la DLC
  const openItems = useMemo(
    () => data.trace.filter((t) => t.status === "open" && t.kind !== "frozen").sort((a, b) => a.product.localeCompare(b.product)),
    [data.trace]
  );

  const pickRecipe = (id) => {
    const r = recipes.find((x) => x.id === id);
    setRecipeId(id);
    setIngs((r?.ingredients || []).map((n) => newIng(n)));
    setKeepDays(r?.keepDays || 3);
  };
  const setIng = (key, patch) => setIngs((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const ingDlcs = ings.map((i) => i.dlc).filter(Boolean).sort();
  const earliest = ingDlcs[0] || null;
  const byDays = dayKey(addDays(new Date(atLocal), Number(keepDays) || 3));
  const limit = earliest && earliest < byDays ? earliest : byDays;
  const expiredIng = ings.filter((i) => i.dlc && daysUntil(i.dlc) < 0);

  const submit = async () => {
    if (!recipe) return alert("Choisis une recette.");
    if (expiredIng.length) return alert(`Ingrédient périmé : ${expiredIng.map((i) => i.name).join(", ")}. Il ne doit pas être utilisé.`);
    const missing = ings.filter((i) => i.name && !i.lot && !i.traceId && !i.dlc);
    if (missing.length && !confirm(`Lot / DLC non renseigné pour : ${missing.map((i) => i.name).join(", ")}.\nEnregistrer quand même ?`)) return;
    const at = new Date(atLocal).toISOString();
    const rec = await save("trace", {
      kind: "homemade",
      product: recipe.name,
      at,
      keepDays: Number(keepDays) || 3,
      dlcAfter: byDays,
      dlc: earliest || "",
      dlcType: "DLC",
      status: "open",
      qty: qty.trim(),
      by: by.trim(),
      photoId,
      recipeId: recipe.id,
      ingredients: ings
        .filter((i) => i.name.trim())
        .map(({ key, ...i }) => ({ ...i, name: i.name.trim(), lot: i.lot.trim() })),
      lot: `F${atLocal.slice(2, 10).replace(/-/g, "")}${atLocal.slice(11, 16).replace(":", "")}`,
      comment: "",
    });
    if (autoReplaceOn(data.settings)) await replaceOlderLots(save, data.trace, rec);
    onClose();
    if (doPrint) printLabelsSafe([rec], data.settings);
  };

  return (
    <Sheet
      title="Fabrication sauce maison"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={submit}>
          <CheckCircle2 size={20} /> Enregistrer — à consommer avant le {fmtDate(limit)}
        </button>
      }
    >
      <Chips options={recipes.map((r) => ({ value: r.id, label: r.name }))} value={recipeId} onChange={(v) => v && pickRecipe(v)} />
      {recipe?.note && <div className="alert info">ℹ️ {recipe.note}</div>}
      {recipe && autoReplaceOn(data.settings) && olderLots(data.trace, recipe.name).length > 0 && (
        <div className="alert info">♻️ L'ancien bac de « {recipe.name} » (du {olderLots(data.trace, recipe.name).map((t) => fmtDate(t.at)).join(", ")}) sera clôturé automatiquement.</div>
      )}

      <div className="grid2">
        <Field label="Fabriquée le">
          <input className="input" type="datetime-local" value={atLocal} onChange={(e) => setAtLocal(e.target.value)} />
        </Field>
        <Field label="Quantité">
          <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="ex : 2 bacs, 3 L" />
        </Field>
      </div>
      <Field label="Durée de conservation" hint={`À consommer avant le ${fmtDate(limit)}${earliest && earliest < byDays ? " (ingrédient qui périme avant)" : ""}`}>
        <Chips options={[{ value: 1, label: "J+1" }, { value: 2, label: "J+2" }, { value: 3, label: "J+3" }]} value={Number(keepDays)} onChange={(v) => v && setKeepDays(v)} />
      </Field>

      <span className="field-label">Ingrédients utilisés (lot et DLC)</span>
      {ings.map((i) => (
        <div key={i.key} className={"rec-line" + (i.dlc && daysUntil(i.dlc) < 0 ? " bad" : "")}>
          <div className="row gap-s">
            <input className="input" value={i.name} placeholder="Ingrédient" onChange={(e) => setIng(i.key, { name: e.target.value })} />
            <button className="icon-btn" aria-label="Retirer" onClick={() => setIngs((l) => l.filter((x) => x.key !== i.key))}>
              <XCircle size={20} />
            </button>
          </div>
          {openItems.length > 0 && (
            <select
              className="input"
              value={i.traceId}
              onChange={(e) => {
                const t = openItems.find((x) => x.id === e.target.value);
                setIng(i.key, t ? { traceId: t.id, lot: t.lot || "", dlc: effectiveDlc(t) || "" } : { traceId: "" });
              }}
            >
              <option value="">— Produit ouvert (traçabilité) —</option>
              {openItems.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.product}
                  {t.lot ? ` · lot ${t.lot}` : ""} · {fmtDate(t.at)}
                </option>
              ))}
            </select>
          )}
          <div className="grid2">
            <input className="input" placeholder="N° de lot" value={i.lot} onChange={(e) => setIng(i.key, { lot: e.target.value })} />
            <input className="input" type="date" value={i.dlc} onChange={(e) => setIng(i.key, { dlc: e.target.value })} />
          </div>
          {i.dlc && daysUntil(i.dlc) < 0 && <div className="alert ko">DLC dépassée : ne pas utiliser cet ingrédient.</div>}
        </div>
      ))}
      <button className="btn btn-ghost" onClick={() => setIngs((l) => [...l, newIng()])}>
        <Plus size={18} /> Ajouter un ingrédient
      </button>

      <PhotoInput photoId={photoId} onChange={setPhotoId} label="Photo des étiquettes des ingrédients (facultatif)" />
      <Field label="Initiales">
        <input className="input" value={by} onChange={(e) => setBy(e.target.value)} maxLength={12} />
      </Field>
      {canPrint && (
        <label className="check">
          <input type="checkbox" checked={doPrint} onChange={(e) => setDoPrint(e.target.checked)} />
          <Printer size={18} /> Imprimer l'étiquette du bac
        </label>
      )}
    </Sheet>
  );
}

// Gestion des recettes (Réglages)
export function RecipesCard({ settings, updateSettings }) {
  const recipes = recipesOf(settings);
  const [edit, setEdit] = useState(null);
  const saveAll = (list) => updateSettings({ recipes: list });
  return (
    <div className="card list">
      {recipes.map((r) => (
        <button key={r.id} className="list-row" onClick={() => setEdit(r)}>
          <span className="list-main">
            <strong>{r.name}</strong>
            <span className="muted small">
              J+{r.keepDays} · {r.ingredients.join(", ")}
            </span>
          </span>
        </button>
      ))}
      <button className="list-row add-row" onClick={() => setEdit({ id: "", name: "", keepDays: 3, ingredients: [], note: "" })}>
        <Plus size={20} /> Ajouter une recette
      </button>
      {edit && (
        <RecipeForm
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={(r) => {
            const list = r.id && recipes.some((x) => x.id === r.id) ? recipes.map((x) => (x.id === r.id ? r : x)) : [...recipes, { ...r, id: Math.random().toString(36).slice(2, 10) }];
            saveAll(list);
            setEdit(null);
          }}
          onDelete={(id) => {
            saveAll(recipes.filter((x) => x.id !== id));
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

function RecipeForm({ initial, onClose, onSave, onDelete }) {
  const [name, setName] = useState(initial.name);
  const [keepDays, setKeepDays] = useState(initial.keepDays || 3);
  const [ingredients, setIngredients] = useState((initial.ingredients || []).join(", "));
  const [note, setNote] = useState(initial.note || "");
  return (
    <Sheet
      title={initial.id ? "Modifier la recette" : "Nouvelle recette"}
      onClose={onClose}
      footer={
        <div className="row gap">
          {initial.id && (
            <button className="btn btn-ghost danger" onClick={() => confirm(`Supprimer « ${initial.name} » ?`) && onDelete(initial.id)}>
              Supprimer
            </button>
          )}
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              if (!name.trim()) return alert("Donne un nom à la recette.");
              onSave({ ...initial, name: name.trim(), keepDays: Number(keepDays) || 3, ingredients: ingredients.split(",").map((x) => x.trim()).filter(Boolean), note: note.trim() });
            }}
          >
            Enregistrer
          </button>
        </div>
      }
    >
      <Field label="Nom">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Sauce samouraï maison" />
      </Field>
      <Field label="Conservation" hint="Sans étude de durée de vie : 3 jours maximum. Œufs crus : dans la journée.">
        <Chips options={[{ value: 1, label: "J+1" }, { value: 2, label: "J+2" }, { value: 3, label: "J+3" }]} value={Number(keepDays)} onChange={(v) => v && setKeepDays(v)} />
      </Field>
      <Field label="Ingrédients (séparés par des virgules)">
        <input className="input" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </Field>
      <Field label="Consigne (affichée à la fabrication)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  );
}
