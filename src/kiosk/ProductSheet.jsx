import { useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { computeLine, linkCount, linkLabel, linkLimits, money, productSizes } from "../lib/pricing.js";
import { ProductImage } from "./ProductImage.jsx";

function hint(link, limits) {
  const parts = [];
  const { min, max } = limits;
  if (min > 0 && min === max) parts.push(min === 1 ? "Obligatoire" : `Obligatoire · ${min} choix`);
  else if (min > 0) parts.push(`Au moins ${min}`);
  else parts.push("Facultatif");
  if (max > 0 && min !== max) parts.push(`${max} max`);
  const extra = Number(link.extraPrice) || 0;
  const free = Number(link.free) || 0;
  if (extra > 0) parts.push(free > 0 ? `${free} offerte${free > 1 ? "s" : ""}, puis +${money(extra)}` : `+${money(extra)} chacun`);
  return parts.join(" · ");
}

export default function ProductSheet({ icon, product, groupsById, initial, onClose, onAdd }) {
  const sizes = productSizes(product);
  const [sizeId, setSizeId] = useState(initial?.sizeId || sizes[0].id);
  const [sel, setSel] = useState(initial?.sel || {});
  const [removed, setRemoved] = useState(initial?.removed || []);
  const [qty, setQty] = useState(initial?.qty || 1);
  const [flash, setFlash] = useState(null);
  const sectionRefs = useRef({});

  const calc = useMemo(() => computeLine(product, sizeId, sel, groupsById), [product, sizeId, sel, groupsById]);

  const pickSize = (id) => {
    setSizeId(id);
    // on retire les choix en trop si la nouvelle taille a moins de place
    setSel((cur) => {
      const next = { ...cur };
      for (const l of product.links || []) {
        const { max, hidden } = linkLimits(l, id);
        if (hidden) delete next[l.id];
        else if (max && linkCount(next, l.id) > max) delete next[l.id];
      }
      return next;
    });
  };

  const change = (link, optId, delta) => {
    const { max } = linkLimits(link, sizeId);
    setSel((cur) => {
      const g = { ...(cur[link.id] || {}) };
      const count = Object.values(g).reduce((a, b) => a + b, 0);
      if (delta > 0) {
        if (!link.repeat && max === 1) {
          // choix unique : on remplace
          return { ...cur, [link.id]: g[optId] ? {} : { [optId]: 1 } };
        }
        if (!link.repeat && g[optId]) {
          delete g[optId];
          return { ...cur, [link.id]: g };
        }
        if (max && count >= max) {
          setFlash(link.id);
          setTimeout(() => setFlash(null), 600);
          return cur;
        }
        g[optId] = (g[optId] || 0) + 1;
      } else {
        if ((g[optId] || 0) <= 1) delete g[optId];
        else g[optId] -= 1;
      }
      return { ...cur, [link.id]: g };
    });
  };

  const submit = () => {
    if (calc.problems.length) {
      const p = calc.problems[0];
      sectionRefs.current[p.linkId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(p.linkId);
      setTimeout(() => setFlash(null), 900);
      return;
    }
    onAdd({
      productId: product.id,
      name: product.name,
      categoryId: product.categoryId,
      sizeId: calc.size.id,
      sizeLabel: calc.size.label || "",
      sel,
      removed,
      choices: calc.choices,
      qty,
      unitPrice: calc.unit,
      totalPrice: calc.unit * qty,
      vatRate: Number(product.vatRate) || 10,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Fermer">
          <X size={26} />
        </button>
        <div className="sheet-hero">
          <ProductImage product={product} className="sheet-img" icon={icon} />
          <div className="sheet-hero-text">
            <h2>{product.name}</h2>
            {product.description && <p>{product.description}</p>}
          </div>
        </div>

        <div className="sheet-body">
          {sizes.length > 1 && (
            <section className="opt-section">
              <header>
                <h3>Format</h3>
                <span className="opt-hint">Obligatoire</span>
              </header>
              <div className="size-grid">
                {sizes.map((s) => (
                  <button key={s.id} className={`size-card ${sizeId === s.id ? "on" : ""}`} onClick={() => pickSize(s.id)}>
                    <span className="size-label">{s.label}</span>
                    <span className="size-price">{money(s.price)}</span>
                    {sizeId === s.id && <Check className="size-check" size={20} />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {product.ingredients?.length > 0 && (
            <section className="opt-section">
              <header>
                <h3>Ingrédients</h3>
                <span className="opt-hint">Touchez pour retirer</span>
              </header>
              <div className="chip-row">
                {product.ingredients.map((ing) => {
                  const off = removed.includes(ing);
                  return (
                    <button key={ing} className={`chip ${off ? "chip-off" : "chip-on"}`} onClick={() => setRemoved(off ? removed.filter((x) => x !== ing) : [...removed, ing])}>
                      {off ? <X size={16} /> : <Check size={16} />} {off ? `Sans ${ing.toLowerCase()}` : ing}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {(product.links || []).map((link) => {
            const group = groupsById[link.groupId];
            if (!group) return null;
            const limits = linkLimits(link, sizeId);
            if (limits.hidden) return null;
            const picked = sel[link.id] || {};
            const count = linkCount(sel, link.id);
            const missing = count < limits.min;
            const options = group.options.filter((o) => o.available !== false || picked[o.id]);
            const allOptions = group.options;
            return (
              <section
                key={link.id}
                ref={(el) => (sectionRefs.current[link.id] = el)}
                className={`opt-section ${flash === link.id ? "shake" : ""} ${missing ? "missing" : ""}`}
              >
                <header>
                  <h3>{linkLabel(link, group)}</h3>
                  <span className="opt-hint">{hint(link, limits)}</span>
                  {(limits.max > 0 || limits.min > 0) && (
                    <span className={`opt-count ${missing ? "" : "ok"}`}>
                      {count}/{limits.max || limits.min}
                    </span>
                  )}
                </header>
                {link.repeat ? (
                  <div className="stepper-list">
                    {allOptions.map((o) => {
                      const q = picked[o.id] || 0;
                      const out = o.available === false;
                      return (
                        <div key={o.id} className={`stepper-row ${q ? "on" : ""} ${out ? "out" : ""}`}>
                          <span className="stepper-name">
                            {o.name}
                            {o.price > 0 && <em> +{money(o.price)}</em>}
                            {out && <em className="out-tag"> Épuisé</em>}
                          </span>
                          <div className="qty">
                            <button onClick={() => change(link, o.id, -1)} disabled={!q}>
                              <Minus size={20} />
                            </button>
                            <span>{q}</span>
                            <button onClick={() => change(link, o.id, 1)} disabled={out || (limits.max > 0 && count >= limits.max)}>
                              <Plus size={20} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="chip-row">
                    {allOptions.map((o) => {
                      const on = !!picked[o.id];
                      const out = o.available === false;
                      return (
                        <button key={o.id} className={`chip ${on ? "chip-sel" : ""} ${out ? "chip-out" : ""}`} disabled={out && !on} onClick={() => change(link, o.id, 1)}>
                          {on && <Check size={16} />} {o.name}
                          {o.price > 0 && <em> +{money(o.price)}</em>}
                          {out && <em> · épuisé</em>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {options.length === 0 && <p className="opt-empty">Aucune option disponible pour le moment.</p>}
              </section>
            );
          })}
        </div>

        <footer className="sheet-footer">
          <div className="qty qty-lg">
            <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>
              <Minus size={24} />
            </button>
            <span>{qty}</span>
            <button onClick={() => setQty(qty + 1)}>
              <Plus size={24} />
            </button>
          </div>
          <button className={`btn-add ${calc.problems.length ? "btn-add-wait" : ""}`} onClick={submit}>
            {calc.problems.length ? (
              <span>{calc.problems[0].message}</span>
            ) : (
              <>
                <span>{initial ? "Mettre à jour" : "Ajouter à ma commande"}</span>
                <strong>{money(calc.unit * qty)}</strong>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
