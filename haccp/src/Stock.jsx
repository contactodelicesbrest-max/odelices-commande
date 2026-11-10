import { useMemo, useState } from "react";
import { Package, Plus, Minus, Search, ShoppingCart, Trash2, CheckCircle2, History, Truck } from "lucide-react";
import ReceptionForm, { ReceptionList } from "./Reception.jsx";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips, Badge, Empty } from "./ui.jsx";
import { daysUntil, fmtDate, fmtDateTime, fmtNum, parseNum, shareText } from "./utils.js";
import { dlcTone } from "./Tracabilite.jsx";

export const CATEGORIES = ["Viandes", "Volailles", "Fruits & légumes", "Crèmerie / fromages", "Sauces", "Surgelés", "Pains", "Épicerie", "Boissons", "Emballages", "Hygiène", "Autre"];
export const UNITS = ["kg", "g", "L", "pièce", "carton", "sachet", "seau", "boîte", "bouteille", "pack"];
const MOVE_KINDS = {
  in: { label: "Entrée / livraison", sign: 1 },
  out: { label: "Sortie / utilisation", sign: -1 },
  loss: { label: "Perte / casse / jeté", sign: -1 },
  inv: { label: "Inventaire (quantité réelle)", sign: 0 },
};

export const isLow = (s) => Number.isFinite(s.min) && s.min > 0 && (s.qty || 0) <= s.min;

export default function Stock() {
  const { data } = useData();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [move, setMove] = useState(null);
  const [showMoves, setShowMoves] = useState(false);
  const [reception, setReception] = useState(null);

  const items = useMemo(() => [...data.stock].sort((a, b) => a.name.localeCompare(b.name)), [data.stock]);
  const low = items.filter(isLow);
  const expired = items.filter((s) => s.dlc && (s.qty || 0) > 0 && daysUntil(s.dlc) < 0);
  const filtered = items.filter(
    (s) => (!cat || s.category === cat) && (!onlyLow || isLow(s)) && (!q || `${s.name} ${s.location} ${s.supplier}`.toLowerCase().includes(q.toLowerCase()))
  );
  const usedCats = CATEGORIES.filter((c) => items.some((s) => s.category === c));

  const shoppingList = () => {
    const text =
      `Liste de courses — ${data.settings.shopName || "O'Délices"} (${fmtDate(new Date())})\n\n` +
      low.map((s) => `• ${s.name} : reste ${fmtNum(s.qty, 2)} ${s.unit} (mini ${fmtNum(s.min, 2)})${s.supplier ? ` — ${s.supplier}` : ""}`).join("\n");
    shareText("Liste de courses", text);
  };

  return (
    <div className="page">
      <div className="hero hero-neutral">
        <div>
          <div className="hero-title">Stock</div>
          <div className="hero-sub">
            {items.length} produit(s) · {low.length} en alerte
          </div>
        </div>
        <div className="col gap-s">
          <button className="btn btn-primary" onClick={() => setReception({})}>
            <Truck size={20} /> Livraison
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setEdit({})}>
            <Plus size={16} /> Produit
          </button>
        </div>
      </div>
      {expired.length > 0 && (
        <div className="alert ko">
          DLC dépassée — à retirer et jeter : {expired.map((s) => s.name).join(", ")}
        </div>
      )}

      {low.length > 0 && (
        <div className="card alert-card">
          <div className="row between">
            <strong>
              <ShoppingCart size={18} /> {low.length} produit(s) à commander
            </strong>
            <button className="btn btn-sm btn-primary" onClick={shoppingList}>Partager la liste</button>
          </div>
          <div className="muted small">{low.map((s) => s.name).join(", ")}</div>
        </div>
      )}

      <div className="search">
        <Search size={18} />
        <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="row gap-s wrap">
        <button className={"chip" + (onlyLow ? " active" : "")} onClick={() => setOnlyLow(!onlyLow)}>⚠️ En alerte</button>
        <button className="chip" onClick={() => setShowMoves(true)}>
          <History size={14} /> Mouvements
        </button>
      </div>
      {usedCats.length > 1 && <Chips options={usedCats} value={cat} onChange={setCat} />}

      {filtered.length === 0 && <Empty icon={Package}>{items.length ? "Aucun résultat." : "Ajoute tes produits avec le bouton « Produit »."}</Empty>}
      <div className="card list">
        {filtered.map((s) => (
          <div key={s.id} className="list-row" onClick={() => setEdit(s)} role="button">
            <span className="list-main">
              <strong>{s.name}</strong>
              <span className="muted small">
                {[s.category, s.location, s.supplier].filter(Boolean).join(" · ")}
              </span>
              <span className="row gap-s wrap">
                {isLow(s) && <Badge tone="ko">Stock bas (mini {fmtNum(s.min, 2)})</Badge>}
                {s.dlc && <Badge tone={dlcTone(s.dlc)}>DLC {fmtDate(s.dlc)}{daysUntil(s.dlc) < 0 ? " dépassée" : ""}</Badge>}
              </span>
            </span>
            <span className="stock-ctrl" onClick={(e) => e.stopPropagation()}>
              <button className="round-btn" onClick={() => setMove({ item: s, kind: "out" })} aria-label="Sortie">
                <Minus size={18} />
              </button>
              <span className={"stock-qty" + (isLow(s) ? " ko-text" : "")}>
                {fmtNum(s.qty || 0, 2)}
                <small>{s.unit}</small>
              </span>
              <button className="round-btn plus" onClick={() => setMove({ item: s, kind: "in" })} aria-label="Entrée">
                <Plus size={18} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <h3 className="section-title">Réceptions récentes</h3>
      <ReceptionList onOpen={setReception} />
      <p className="muted small rule">ℹ️ PEPS (premier entré, premier sorti) : ranger les nouvelles livraisons derrière et utiliser d'abord les produits dont la DLC est la plus proche.</p>

      {reception && <ReceptionForm initial={reception} onClose={() => setReception(null)} />}
      {edit && <StockForm initial={edit} onClose={() => setEdit(null)} onMove={(kind) => { setMove({ item: edit, kind }); setEdit(null); }} />}
      {move && <MoveForm {...move} onClose={() => setMove(null)} />}
      {showMoves && <MovesSheet onClose={() => setShowMoves(false)} />}
    </div>
  );
}

function StockForm({ initial, onClose, onMove }) {
  const { data, save, remove } = useData();
  const isNew = !initial.id;
  const [f, setF] = useState({
    name: "",
    category: "Autre",
    unit: "kg",
    location: "",
    supplier: "",
    dlc: "",
    ...initial,
    qty: initial.qty != null ? String(initial.qty).replace(".", ",") : "",
    min: initial.min != null ? String(initial.min).replace(".", ",") : "",
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const locations = [...new Set([...data.equipments.map((e) => e.name), "Réserve sèche", ...data.stock.map((s) => s.location).filter(Boolean)])];

  const submit = async () => {
    if (!f.name.trim()) return alert("Indique le nom du produit.");
    const qty = parseNum(f.qty);
    const min = parseNum(f.min);
    const rec = { ...f, name: f.name.trim(), qty: Number.isFinite(qty) ? qty : 0, min: Number.isFinite(min) ? min : null };
    const saved = await save("stock", rec);
    const before = isNew ? 0 : initial.qty || 0;
    if (rec.qty !== before) {
      await save("moves", {
        stockId: saved.id,
        name: saved.name,
        kind: isNew ? "in" : "inv",
        qty: rec.qty - before,
        unit: saved.unit,
        reason: isNew ? "Création du produit" : "Correction de quantité",
        at: new Date().toISOString(),
        by: data.settings.operator || "",
      });
    }
    onClose();
  };

  return (
    <Sheet
      title={isNew ? "Nouveau produit" : f.name}
      onClose={onClose}
      footer={
        <div className="row gap">
          {!isNew && (
            <button
              className="btn btn-ghost danger"
              onClick={async () => {
                if (confirm(`Supprimer « ${initial.name} » du stock ?`)) {
                  await remove("stock", initial.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>
            <CheckCircle2 size={20} /> Enregistrer
          </button>
        </div>
      }
    >
      {!isNew && initial.dlc && daysUntil(initial.dlc) < 0 && (initial.qty || 0) > 0 && (
        <div className="alert ko col gap-s">
          DLC dépassée ({fmtDate(initial.dlc)}) : produit interdit à l'utilisation.
          <button
            className="btn btn-ko"
            onClick={async () => {
              if (!confirm(`Retirer ${fmtNum(initial.qty, 2)} ${initial.unit} de « ${initial.name} » (jeté) ?`)) return;
              await save("stock", { ...initial, qty: 0, dlc: "" });
              await save("moves", { stockId: initial.id, name: initial.name, kind: "loss", qty: -(initial.qty || 0), unit: initial.unit, reason: "Jeté : DLC dépassée", at: new Date().toISOString(), by: data.settings.operator || "" });
              onClose();
            }}
          >
            <Trash2 size={18} /> Retirer et jeter
          </button>
        </div>
      )}
      {!isNew && (
        <div className="row gap">
          <button className="btn btn-ghost btn-block" onClick={() => onMove("out")}><Minus size={18} /> Sortie</button>
          <button className="btn btn-ghost btn-block" onClick={() => onMove("in")}><Plus size={18} /> Livraison</button>
          <button className="btn btn-ghost btn-block" onClick={() => onMove("loss")}><Trash2 size={18} /> Perte</button>
        </div>
      )}
      <Field label="Nom *">
        <input className="input" value={f.name} onChange={set("name")} />
      </Field>
      <div className="grid2">
        <Field label="Quantité en stock">
          <input className="input" inputMode="decimal" value={f.qty} onChange={set("qty")} />
        </Field>
        <Field label="Unité">
          <select className="input" value={f.unit} onChange={set("unit")}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Seuil d'alerte (mini)">
          <input className="input" inputMode="decimal" value={f.min} onChange={set("min")} placeholder="ex : 2" />
        </Field>
        <Field label="Catégorie">
          <select className="input" value={f.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Emplacement">
          <input className="input" list="stock-locs" value={f.location} onChange={set("location")} />
          <datalist id="stock-locs">{locations.map((l) => <option key={l} value={l} />)}</datalist>
        </Field>
        <Field label="Fournisseur">
          <input className="input" value={f.supplier} onChange={set("supplier")} />
        </Field>
      </div>
      <Field label="DLC du lot en stock (facultatif)">
        <input className="input" type="date" value={f.dlc || ""} onChange={set("dlc")} />
      </Field>
    </Sheet>
  );
}

function MoveForm({ item, kind: initialKind, onClose }) {
  const { data, save } = useData();
  const [kind, setKind] = useState(initialKind);
  const [qty, setQty] = useState(kind === "inv" ? String(item.qty || 0) : "");
  const [reason, setReason] = useState("");
  const [dlc, setDlc] = useState("");
  const k = MOVE_KINDS[kind];
  const v = parseNum(qty);

  const submit = async () => {
    if (!Number.isFinite(v) || v < 0) return alert("Quantité invalide.");
    const before = item.qty || 0;
    const after = kind === "inv" ? v : Math.max(0, before + k.sign * v);
    const patch = { ...item, qty: after };
    if (kind === "in" && dlc) patch.dlc = dlc;
    await save("stock", patch);
    await save("moves", {
      stockId: item.id,
      name: item.name,
      kind,
      qty: after - before,
      unit: item.unit,
      reason: reason.trim() || k.label,
      at: new Date().toISOString(),
      by: data.settings.operator || "",
    });
    onClose();
  };

  return (
    <Sheet
      title={item.name}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={submit}>
          <CheckCircle2 size={20} /> Valider
        </button>
      }
    >
      <Chips options={Object.entries(MOVE_KINDS).map(([value, m]) => ({ value, label: m.label }))} value={kind} onChange={(x) => x && setKind(x)} />
      <p className="muted">En stock : <strong>{fmtNum(item.qty || 0, 2)} {item.unit}</strong></p>
      <Field label={kind === "inv" ? `Quantité comptée (${item.unit})` : `Quantité (${item.unit})`}>
        <input className="input input-xl" inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
      </Field>
      {kind !== "inv" && Number.isFinite(v) && (
        <p className="muted">Après : <strong>{fmtNum(Math.max(0, (item.qty || 0) + k.sign * v), 2)} {item.unit}</strong></p>
      )}
      {kind === "in" && (
        <Field label="DLC de la livraison (facultatif)">
          <input className="input" type="date" value={dlc} onChange={(e) => setDlc(e.target.value)} />
        </Field>
      )}
      <Field label="Motif / commentaire">
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Sheet>
  );
}

function MovesSheet({ onClose }) {
  const { data } = useData();
  const moves = [...data.moves].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
  return (
    <Sheet title="Mouvements de stock" onClose={onClose}>
      {moves.length === 0 && <Empty icon={History}>Aucun mouvement.</Empty>}
      <div className="list">
        {moves.map((m) => (
          <div key={m.id} className="list-row">
            <span className="list-main">
              <strong>{m.name}</strong>
              <span className="muted small">
                {fmtDateTime(m.at)} · {m.reason} {m.by && `· ${m.by}`}
              </span>
            </span>
            <span className={"temp-val " + (m.qty >= 0 ? "ok" : "ko")}>
              {m.qty > 0 ? "+" : ""}
              {fmtNum(m.qty, 2)} {m.unit}
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
