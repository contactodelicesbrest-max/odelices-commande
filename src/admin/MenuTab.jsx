import { useState } from "react";
import { Copy, Eye, EyeOff, ImagePlus, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useStore } from "../lib/store.jsx";
import { fromPrice, money, productSizes } from "../lib/pricing.js";
import { ProductImage } from "../kiosk/ProductImage.jsx";
import { Field, Modal, MoveButtons, Num, Seg, Text, Toggle, move, readImage, uid } from "./ui.jsx";

export default function MenuTab() {
  const { data, update } = useStore();
  const { categories, products, groups } = data.menu;
  const [catId, setCatId] = useState(categories[0]?.id);
  const [editCat, setEditCat] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const cat = categories.find((c) => c.id === catId) || categories[0];
  const list = products.filter((p) => p.categoryId === cat?.id);

  const setProduct = (id, patch) =>
    update((d) => {
      const p = d.menu.products.find((x) => x.id === id);
      Object.assign(p, patch);
    });

  const moveProduct = (p, dir) =>
    update((d) => {
      const arr = d.menu.products;
      const same = arr.map((x, i) => [x, i]).filter(([x]) => x.categoryId === p.categoryId);
      const k = same.findIndex(([x]) => x.id === p.id);
      const other = same[k + dir];
      if (!other) return;
      const i = same[k][1];
      const j = other[1];
      [arr[i], arr[j]] = [arr[j], arr[i]];
    });

  const saveCat = (c) =>
    update((d) => {
      const i = d.menu.categories.findIndex((x) => x.id === c.id);
      if (i >= 0) d.menu.categories[i] = c;
      else d.menu.categories.push(c);
    });

  const deleteCat = (c) => {
    const n = products.filter((p) => p.categoryId === c.id).length;
    if (!window.confirm(n ? `Supprimer « ${c.name} » et ses ${n} produits ?` : `Supprimer « ${c.name} » ?`)) return;
    update((d) => {
      d.menu.categories = d.menu.categories.filter((x) => x.id !== c.id);
      d.menu.products = d.menu.products.filter((x) => x.categoryId !== c.id);
    });
    setEditCat(null);
  };

  const saveProduct = (p) => {
    update((d) => {
      const i = d.menu.products.findIndex((x) => x.id === p.id);
      if (i >= 0) d.menu.products[i] = p;
      else d.menu.products.push(p);
    });
    setCatId(p.categoryId);
    setEditProduct(null);
  };

  const newProduct = () =>
    setEditProduct({
      id: uid("p"),
      categoryId: cat.id,
      name: "",
      description: "",
      image: "",
      sizes: [],
      price: 0,
      ingredients: [],
      links: [],
      vatRate: 10,
      available: true,
      hidden: false,
      popular: false,
      _new: true,
    });

  return (
    <div className="menu-tab">
      <div className="cat-col">
        <div className="col-head">
          <h3>Catégories</h3>
          <button className="btn-sm btn-primary" onClick={() => setEditCat({ id: uid("c"), name: "", icon: "🍽️", note: "", hidden: false, _new: true })}>
            <Plus size={16} /> Ajouter
          </button>
        </div>
        <ul className="cat-list">
          {categories.map((c, i) => (
            <li key={c.id} className={`cat-item ${c.id === cat?.id ? "on" : ""} ${c.hidden ? "muted" : ""}`} onClick={() => setCatId(c.id)}>
              <span className="cat-emoji">{c.icon}</span>
              <span className="cat-name">
                {c.name}
                <small>{products.filter((p) => p.categoryId === c.id).length} produits{c.hidden ? " · masquée" : ""}</small>
              </span>
              <span onClick={(e) => e.target.closest("button") && e.stopPropagation()} className="row-actions">
                <MoveButtons
                  disableUp={i === 0}
                  disableDown={i === categories.length - 1}
                  onUp={() => update((d) => void (d.menu.categories = move(d.menu.categories, i, i - 1)))}
                  onDown={() => update((d) => void (d.menu.categories = move(d.menu.categories, i, i + 1)))}
                />
                <button className="icon-btn" onClick={() => setEditCat({ ...c })} aria-label="Modifier">
                  <Pencil size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="prod-col">
        {cat ? (
          <>
            <div className="col-head">
              <h3>
                {cat.icon} {cat.name}
              </h3>
              <button className="btn-sm btn-primary" onClick={newProduct}>
                <Plus size={16} /> Nouveau produit
              </button>
            </div>
            {list.length === 0 && <p className="empty">Aucun produit dans cette catégorie.</p>}
            <ul className="prod-list">
              {list.map((p, i) => (
                <li key={p.id} className={`prod-item ${!p.available ? "out" : ""} ${p.hidden ? "muted" : ""}`}>
                  <ProductImage product={p} className="prod-thumb" icon={cat.icon} />
                  <div className="prod-main" onClick={() => setEditProduct(structuredClone(p))}>
                    <strong>{p.name}</strong>
                    <span>
                      {productSizes(p).length > 1 ? `${productSizes(p).length} formats · dès ` : ""}
                      {money(fromPrice(p))} · TVA {p.vatRate}%{p.hidden ? " · masqué" : ""}
                    </span>
                  </div>
                  <Toggle checked={p.available} onChange={(v) => setProduct(p.id, { available: v })} label={p.available ? "En stock" : "Épuisé"} />
                  <div className="row-actions">
                    <button className={`icon-btn ${p.popular ? "star-on" : ""}`} onClick={() => setProduct(p.id, { popular: !p.popular })} aria-label="Populaire">
                      <Star size={18} fill={p.popular ? "currentColor" : "none"} />
                    </button>
                    <button className="icon-btn" onClick={() => setProduct(p.id, { hidden: !p.hidden })} aria-label="Masquer">
                      {p.hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button className="icon-btn" onClick={() => setEditProduct(structuredClone(p))} aria-label="Modifier">
                      <Pencil size={18} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setEditProduct({ ...structuredClone(p), id: uid("p"), name: p.name + " (copie)", _new: true })}
                      aria-label="Dupliquer"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => window.confirm(`Supprimer « ${p.name} » ?`) && update((d) => void (d.menu.products = d.menu.products.filter((x) => x.id !== p.id)))}
                      aria-label="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                    <MoveButtons disableUp={i === 0} disableDown={i === list.length - 1} onUp={() => moveProduct(p, -1)} onDown={() => moveProduct(p, 1)} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty">Créez une première catégorie.</p>
        )}
      </div>

      {editCat && (
        <Modal
          title={editCat._new ? "Nouvelle catégorie" : "Modifier la catégorie"}
          onClose={() => setEditCat(null)}
          footer={
            <>
              {!editCat._new && (
                <button className="btn-ghost danger" onClick={() => deleteCat(editCat)}>
                  <Trash2 size={16} /> Supprimer
                </button>
              )}
              <span className="spacer" />
              <button className="btn-ghost" onClick={() => setEditCat(null)}>
                Annuler
              </button>
              <button
                className="btn-primary"
                disabled={!editCat.name.trim()}
                onClick={() => {
                  const { _new, ...c } = editCat;
                  saveCat(c);
                  setCatId(c.id);
                  setEditCat(null);
                }}
              >
                Enregistrer
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="Icône (emoji)" className="w-small">
              <Text value={editCat.icon} onChange={(v) => setEditCat({ ...editCat, icon: v.slice(0, 4) })} />
            </Field>
            <Field label="Nom">
              <Text value={editCat.name} onChange={(v) => setEditCat({ ...editCat, name: v })} autoFocus />
            </Field>
          </div>
          <div className="emoji-row">
            {"🌮🍔🥙🌯🍕🍟🍗🥗🧒🥤🍺🍷☕🍰🍦🍩⭐🔥".match(/\p{Extended_Pictographic}/gu).map((e) => (
              <button key={e} className="emoji-btn" onClick={() => setEditCat({ ...editCat, icon: e })}>
                {e}
              </button>
            ))}
          </div>
          <Field label="Texte d'information (affiché en haut de la catégorie)">
            <Text value={editCat.note} onChange={(v) => setEditCat({ ...editCat, note: v })} />
          </Field>
          <Toggle checked={!editCat.hidden} onChange={(v) => setEditCat({ ...editCat, hidden: !v })} label="Visible sur la borne" />
        </Modal>
      )}

      {editProduct && <ProductEditor initial={editProduct} categories={categories} groups={groups} onClose={() => setEditProduct(null)} onSave={saveProduct} />}
    </div>
  );
}

function ProductEditor({ initial, categories, groups, onClose, onSave }) {
  const [p, setP] = useState(initial);
  const [ing, setIng] = useState("");
  const set = (patch) => setP({ ...p, ...patch });
  const hasSizes = p.sizes.length > 0;
  const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]));

  const setLink = (i, patch) => set({ links: p.links.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const setSizeRule = (i, sizeId, patch) => {
    const l = p.links[i];
    const cur = l.bySize?.[sizeId] || { min: l.min, max: l.max };
    setLink(i, { bySize: { ...(l.bySize || {}), [sizeId]: { ...cur, ...patch } } });
  };
  const clearSizeRule = (i, sizeId) => {
    const by = { ...(p.links[i].bySize || {}) };
    delete by[sizeId];
    setLink(i, { bySize: by });
  };

  const save = () => {
    const { _new, ...clean } = p;
    clean.name = clean.name.trim();
    onSave(clean);
  };

  return (
    <Modal
      wide
      title={initial._new ? "Nouveau produit" : `Modifier · ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" disabled={!p.name.trim()} onClick={save}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="pe-top">
        <div className="pe-photo">
          <ProductImage product={p.name ? p : { ...p, name: "?" }} className="pe-img" icon={categories.find((c) => c.id === p.categoryId)?.icon} />
          <label className="btn-ghost btn-sm">
            <ImagePlus size={16} /> {p.image ? "Changer" : "Ajouter une photo"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) set({ image: await readImage(f) });
                e.target.value = "";
              }}
            />
          </label>
          {p.image && (
            <button className="btn-ghost btn-sm danger" onClick={() => set({ image: "" })}>
              Retirer la photo
            </button>
          )}
        </div>
        <div className="pe-fields">
          <Field label="Nom du produit">
            <Text value={p.name} onChange={(v) => set({ name: v })} autoFocus={initial._new} />
          </Field>
          <Field label="Description (visible par le client)">
            <textarea className="input" rows={2} value={p.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <div className="form-grid">
            <Field label="Catégorie">
              <select className="input" value={p.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="TVA">
              <Seg
                value={Number(p.vatRate)}
                onChange={(v) => set({ vatRate: v })}
                options={[
                  { value: 5.5, label: "5,5 %" },
                  { value: 10, label: "10 %" },
                  { value: 20, label: "20 %" },
                ]}
              />
            </Field>
          </div>
          <div className="toggle-row">
            <Toggle checked={p.available} onChange={(v) => set({ available: v })} label="En stock" />
            <Toggle checked={!p.hidden} onChange={(v) => set({ hidden: !v })} label="Visible" />
            <Toggle checked={p.popular} onChange={(v) => set({ popular: v })} label="Populaire ⭐" />
          </div>
        </div>
      </div>

      <section className="pe-section">
        <div className="pe-section-head">
          <h4>Prix et formats</h4>
          <Seg
            value={hasSizes}
            onChange={(v) => set(v ? { sizes: [{ id: uid("s"), label: "Normal", price: p.price || 0 }] } : { sizes: [], price: p.sizes[0]?.price || 0 })}
            options={[
              { value: false, label: "Prix unique" },
              { value: true, label: "Plusieurs formats" },
            ]}
          />
        </div>
        {!hasSizes ? (
          <Field label="Prix TTC (€)" className="w-price">
            <Num value={p.price} onChange={(v) => set({ price: v })} />
          </Field>
        ) : (
          <div className="rows">
            {p.sizes.map((s, i) => (
              <div key={s.id} className="row">
                <Text value={s.label} onChange={(v) => set({ sizes: p.sizes.map((x, k) => (k === i ? { ...x, label: v } : x)) })} placeholder="Ex : Avec boisson, XL…" />
                <div className="with-unit">
                  <Num value={s.price} onChange={(v) => set({ sizes: p.sizes.map((x, k) => (k === i ? { ...x, price: v } : x)) })} />
                  <span>€</span>
                </div>
                <MoveButtons disableUp={i === 0} disableDown={i === p.sizes.length - 1} onUp={() => set({ sizes: move(p.sizes, i, i - 1) })} onDown={() => set({ sizes: move(p.sizes, i, i + 1) })} />
                <button className="icon-btn danger" disabled={p.sizes.length <= 1} onClick={() => set({ sizes: p.sizes.filter((_, k) => k !== i) })}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="btn-ghost btn-sm" onClick={() => set({ sizes: [...p.sizes, { id: uid("s"), label: "", price: 0 }] })}>
              <Plus size={16} /> Ajouter un format
            </button>
          </div>
        )}
      </section>

      <section className="pe-section">
        <div className="pe-section-head">
          <h4>Ingrédients retirables</h4>
          <span className="field-hint">Le client pourra demander « sans … »</span>
        </div>
        <div className="chip-row">
          {p.ingredients.map((x) => (
            <span key={x} className="tag">
              {x}
              <button onClick={() => set({ ingredients: p.ingredients.filter((y) => y !== x) })}>
                <X size={14} />
              </button>
            </span>
          ))}
          <form
            className="tag-add"
            onSubmit={(e) => {
              e.preventDefault();
              const v = ing.trim();
              if (v && !p.ingredients.includes(v)) set({ ingredients: [...p.ingredients, v] });
              setIng("");
            }}
          >
            <input className="input" value={ing} onChange={(e) => setIng(e.target.value)} placeholder="Ajouter (ex : Oignons)" />
            <button className="btn-ghost btn-sm" type="submit">
              <Plus size={16} />
            </button>
          </form>
        </div>
      </section>

      <section className="pe-section">
        <div className="pe-section-head">
          <h4>Choix proposés au client</h4>
          <span className="field-hint">Sauces, viandes, suppléments, boisson… (listes gérées dans l'onglet « Options »)</span>
        </div>
        {p.links.length === 0 && <p className="empty">Aucun choix : le produit s'ajoute directement.</p>}
        {p.links.map((l, i) => {
          const g = groupsById[l.groupId];
          return (
            <div key={l.id} className="link-card">
              <div className="link-head">
                <select className="input" value={l.groupId} onChange={(e) => setLink(i, { groupId: e.target.value })}>
                  {groups.map((x) => (
                    <option key={x.id} value={x.id}>
                      Liste : {x.name}
                    </option>
                  ))}
                </select>
                <Text value={l.label} onChange={(v) => setLink(i, { label: v })} placeholder={`Titre affiché (défaut : ${g?.name || ""})`} />
                <MoveButtons disableUp={i === 0} disableDown={i === p.links.length - 1} onUp={() => set({ links: move(p.links, i, i - 1) })} onDown={() => set({ links: move(p.links, i, i + 1) })} />
                <button className="icon-btn danger" onClick={() => set({ links: p.links.filter((_, k) => k !== i) })}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="link-rules">
                <Field label="Minimum" hint="0 = facultatif">
                  <Num decimals={0} value={l.min} onChange={(v) => setLink(i, { min: v })} />
                </Field>
                <Field label="Maximum" hint="0 = illimité">
                  <Num decimals={0} value={l.max} onChange={(v) => setLink(i, { max: v })} />
                </Field>
                <Field label="Choix offerts" hint="avant surcoût">
                  <Num decimals={0} value={l.free} onChange={(v) => setLink(i, { free: v })} />
                </Field>
                <Field label="Surcoût / choix" hint="au-delà des offerts">
                  <Num value={l.extraPrice} onChange={(v) => setLink(i, { extraPrice: v })} />
                </Field>
                <Field label="Quantités">
                  <Toggle checked={l.repeat} onChange={(v) => setLink(i, { repeat: v })} label="Plusieurs fois la même" />
                </Field>
              </div>
              {hasSizes && (
                <div className="by-size">
                  <span className="field-label">Selon le format (laisser « Comme ci-dessus » sinon — mettre 0/0 pour masquer)</span>
                  {p.sizes.map((s) => {
                    const r = l.bySize?.[s.id];
                    return (
                      <div key={s.id} className="by-size-row">
                        <span className="by-size-name">{s.label || "(sans nom)"}</span>
                        {r ? (
                          <>
                            <span>min</span>
                            <Num decimals={0} value={r.min} onChange={(v) => setSizeRule(i, s.id, { min: v })} />
                            <span>max</span>
                            <Num decimals={0} value={r.max} onChange={(v) => setSizeRule(i, s.id, { max: v })} />
                            {r.min === 0 && r.max === 0 && <em className="hidden-tag">masqué</em>}
                            <button className="btn-ghost btn-sm" onClick={() => clearSizeRule(i, s.id)}>
                              Comme ci-dessus
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="muted-text">Comme ci-dessus</span>
                            <button className="btn-ghost btn-sm" onClick={() => setSizeRule(i, s.id, {})}>
                              Personnaliser
                            </button>
                            <button className="btn-ghost btn-sm" onClick={() => setSizeRule(i, s.id, { min: 0, max: 0 })}>
                              Masquer
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {groups.length > 0 && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => set({ links: [...p.links, { id: uid("l"), groupId: groups[0].id, label: "", min: 0, max: 0, free: 0, extraPrice: 0, repeat: false, bySize: {} }] })}
          >
            <Plus size={16} /> Ajouter un choix
          </button>
        )}
      </section>
    </Modal>
  );
}
