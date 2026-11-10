import { useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips, Badge, PhotoInput, PhotoThumb, TempInput } from "./ui.jsx";
import { daysUntil, fmtDate, fmtDateTime, parseNum } from "./utils.js";
import { UNITS } from "./Stock.jsx";

// Contrôle à réception (règlement CE 852/2004, GBPH) : température des produits,
// état des emballages, étiquetage, DLC suffisante, propreté du véhicule.
export const RECEPTION_TYPES = {
  frais: { label: "Frais", max: 4, rule: "+4 °C max" },
  hache: { label: "Viande hachée / poisson", max: 2, rule: "+2 °C max" },
  surgele: { label: "Surgelé", max: -18, tolerance: -15, rule: "-18 °C (toléré jusqu'à -15 °C)" },
  sec: { label: "Sec / ambiant", max: null, rule: "pas de température" },
};
export const RECEPTION_CHECKS = [
  ["vehicle", "Véhicule / livreur propre"],
  ["packaging", "Emballages intacts, non souillés"],
  ["labels", "Étiquettes présentes et lisibles (lot, DLC, estampille)"],
  ["dlc", "DLC suffisantes"],
];
const DECISIONS = {
  accepted: { label: "Acceptée", short: "acceptée", tone: "ok" },
  partial: { label: "Acceptée avec réserves / refus partiel", short: "avec réserves", tone: "warn" },
  refused: { label: "Refusée", short: "refusée", tone: "ko" },
};

export function lineStatus(l) {
  const t = RECEPTION_TYPES[l.type];
  const v = parseNum(l.temp);
  let tempOk = true;
  if (t?.max !== null && t?.max !== undefined) {
    if (!Number.isFinite(v)) tempOk = null;
    else tempOk = v <= (t.tolerance ?? t.max);
  }
  const dlcOk = !l.dlc || daysUntil(l.dlc) >= 1;
  return { tempOk, dlcOk, ok: tempOk !== false && dlcOk };
}

export function ReceptionList({ onOpen }) {
  const { data } = useData();
  const list = useMemo(() => [...data.receptions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10), [data.receptions]);
  if (!list.length) return <p className="muted small">Aucune réception enregistrée.</p>;
  return (
    <div className="card list">
      {list.map((r) => (
        <button key={r.id} className="list-row" onClick={() => onOpen(r)}>
          <PhotoThumb id={r.photoId} />
          <span className="list-main">
            <strong>{r.supplier || "Livraison"}</strong>
            <span className="muted small">
              {fmtDateTime(r.at)} · {r.lines?.length || 0} produit(s) {r.by && `· ${r.by}`}
            </span>
          </span>
          <Badge tone={DECISIONS[r.decision]?.tone}>{DECISIONS[r.decision]?.short}</Badge>
        </button>
      ))}
    </div>
  );
}

const emptyLine = () => ({ key: Math.random().toString(36).slice(2), stockId: "", name: "", qty: "", unit: "kg", type: "frais", temp: "", lot: "", dlc: "", accepted: true });

export default function ReceptionForm({ initial, onClose }) {
  const { data, save, remove } = useData();
  const isNew = !initial?.id;
  const [f, setF] = useState(() => ({
    supplier: "",
    photoId: null,
    checks: Object.fromEntries(RECEPTION_CHECKS.map(([k]) => [k, true])),
    comment: "",
    by: data.settings.operator || "",
    ...(initial || {}),
    lines: initial?.lines?.length ? initial.lines.map((l) => ({ key: Math.random().toString(36).slice(2), ...l })) : [emptyLine()],
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const setLine = (key, patch) => setF((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const suppliers = [...new Set([...data.receptions.map((r) => r.supplier), ...data.stock.map((s) => s.supplier)].filter(Boolean))];
  const stockSorted = [...data.stock].sort((a, b) => a.name.localeCompare(b.name));

  const lines = f.lines.map((l) => ({ ...l, st: lineStatus(l) }));
  const checksOk = RECEPTION_CHECKS.every(([k]) => f.checks[k]);
  const anyBad = lines.some((l) => !l.st.ok) || !checksOk;
  const refusedLines = lines.filter((l) => !l.accepted);
  const decision = lines.every((l) => !l.accepted) ? "refused" : refusedLines.length || anyBad ? "partial" : "accepted";

  const submit = async () => {
    const valid = lines.filter((l) => l.name.trim() || l.stockId);
    if (!valid.length) return alert("Ajoute au moins un produit.");
    if (valid.some((l) => l.accepted && !l.st.ok) && !confirm("Des produits sont hors température ou avec une DLC trop courte mais marqués « acceptés ». Continuer ?")) return;
    if (anyBad && !f.comment.trim()) return alert("Non-conformité : indique dans le commentaire ce qui a été fait (refus, réserve sur le bon de livraison, appel au fournisseur…).");
    const at = initial?.at || new Date().toISOString();
    const rec = {
      ...(initial || {}),
      supplier: f.supplier.trim(),
      photoId: f.photoId,
      checks: f.checks,
      comment: f.comment.trim(),
      by: f.by.trim(),
      at,
      decision,
      lines: valid.map(({ key, st, ...l }) => ({
        ...l,
        name: l.name.trim() || data.stock.find((s) => s.id === l.stockId)?.name || "",
        temp: Number.isFinite(parseNum(l.temp)) ? parseNum(l.temp) : null,
        qty: Number.isFinite(parseNum(l.qty)) ? parseNum(l.qty) : null,
        tempOk: st.tempOk,
        dlcOk: st.dlcOk,
      })),
    };
    // Ajout au stock des produits acceptés (uniquement à la création)
    if (isNew) {
      for (const l of rec.lines) {
        if (!l.accepted || !l.qty) continue;
        let item = data.stock.find((s) => s.id === l.stockId);
        if (!item) item = data.stock.find((s) => s.name.toLowerCase() === l.name.toLowerCase());
        const before = item?.qty || 0;
        const saved = await save("stock", {
          ...(item || { name: l.name, category: "Autre", unit: l.unit, min: null, location: "" }),
          supplier: item?.supplier || rec.supplier,
          qty: before + l.qty,
          // PEPS : on garde la DLC la plus proche (le lot le plus ancien est utilisé en premier)
          dlc: [item?.dlc, l.dlc].filter(Boolean).sort()[0] || "",
        });
        await save("moves", {
          stockId: saved.id,
          name: saved.name,
          kind: "in",
          qty: l.qty,
          unit: saved.unit,
          reason: `Livraison ${rec.supplier}${l.lot ? ` — lot ${l.lot}` : ""}`,
          at,
          by: rec.by,
        });
      }
    }
    await save("receptions", rec);
    onClose();
  };

  return (
    <Sheet
      title={isNew ? "Réception livraison" : `Réception — ${f.supplier}`}
      onClose={onClose}
      footer={
        <div className="row gap">
          {!isNew && (
            <button
              className="btn btn-ghost danger"
              onClick={async () => {
                if (confirm("Supprimer cette réception ? (le stock n'est pas modifié)")) {
                  await remove("receptions", initial.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>
            <CheckCircle2 size={20} /> Enregistrer ({DECISIONS[decision].short})
          </button>
        </div>
      }
    >
      <div className="alert info">
        ℹ️ Contrôler à chaque livraison : température des produits, emballages, étiquettes et DLC. Ranger les produits froids immédiatement (surgelés en premier). Refuser ce qui n'est pas conforme et le noter sur le bon de livraison.
      </div>
      <Field label="Fournisseur">
        <input className="input" list="rec-suppliers" value={f.supplier} onChange={set("supplier")} />
        <datalist id="rec-suppliers">{suppliers.map((x) => <option key={x} value={x} />)}</datalist>
      </Field>
      <PhotoInput photoId={f.photoId} onChange={set("photoId")} label="Photo du bon de livraison" />

      <span className="field-label">Contrôles</span>
      <div className="checks">
        {RECEPTION_CHECKS.map(([k, label]) => (
          <label key={k} className={"check" + (f.checks[k] ? "" : " bad")}>
            <input type="checkbox" checked={!!f.checks[k]} onChange={(e) => setF((s) => ({ ...s, checks: { ...s.checks, [k]: e.target.checked } }))} />
            {label}
          </label>
        ))}
      </div>

      <span className="field-label">Produits reçus</span>
      {lines.map((l) => {
        const t = RECEPTION_TYPES[l.type];
        return (
          <div key={l.key} className={"rec-line" + (l.st.ok ? "" : " bad") + (l.accepted ? "" : " refused")}>
            <div className="grid2">
              <select className="input" value={l.stockId} onChange={(e) => {
                const it = data.stock.find((s) => s.id === e.target.value);
                setLine(l.key, { stockId: e.target.value, name: it?.name || l.name, unit: it?.unit || l.unit });
              }}>
                <option value="">— Nouveau produit —</option>
                {stockSorted.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {!l.stockId ? (
                <input className="input" placeholder="Nom du produit" value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} />
              ) : (
                <input className="input" placeholder="N° de lot" value={l.lot} onChange={(e) => setLine(l.key, { lot: e.target.value })} />
              )}
            </div>
            <div className="row gap-s">
              <input className="input" inputMode="decimal" placeholder="Qté" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} />
              <select className="input" value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} disabled={!!l.stockId}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            {!l.stockId && <input className="input" placeholder="N° de lot" value={l.lot} onChange={(e) => setLine(l.key, { lot: e.target.value })} />}
            <Chips options={Object.entries(RECEPTION_TYPES).map(([value, x]) => ({ value, label: x.label }))} value={l.type} onChange={(v) => v && setLine(l.key, { type: v })} />
            <div className="grid2">
              {t.max !== null ? (
                <Field label={`T° produit (${t.rule})`}>
                  <TempInput value={l.temp} negativeDefault={l.type === "surgele"} onChange={(v) => setLine(l.key, { temp: v })} />
                </Field>
              ) : <span />}
              <Field label="DLC">
                <input className="input" type="date" value={l.dlc} onChange={(e) => setLine(l.key, { dlc: e.target.value })} />
              </Field>
            </div>
            {l.st.tempOk === false && <div className="alert ko">Température non conforme ({t.rule}) : refuser le produit.</div>}
            {!l.st.dlcOk && <div className="alert ko">DLC dépassée ou trop courte : refuser le produit.</div>}
            <div className="row between">
              <Chips options={[{ value: true, label: "Accepté" }, { value: false, label: "Refusé" }]} value={l.accepted} onChange={(v) => v !== null && setLine(l.key, { accepted: v })} />
              {f.lines.length > 1 && (
                <button className="icon-btn" onClick={() => setF((s) => ({ ...s, lines: s.lines.filter((x) => x.key !== l.key) }))} aria-label="Retirer">
                  <XCircle size={20} />
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button className="btn btn-ghost" onClick={() => setF((s) => ({ ...s, lines: [...s.lines, emptyLine()] }))}>
        <Plus size={18} /> Ajouter un produit
      </button>

      <div className="grid2">
        <Field label="Initiales">
          <input className="input" value={f.by} onChange={set("by")} maxLength={12} />
        </Field>
        <Field label={anyBad ? "Commentaire / mesure prise *" : "Commentaire"}>
          <input className="input" value={f.comment} onChange={set("comment")} />
        </Field>
      </div>
      <p className="muted small">
        Décision : <Badge tone={DECISIONS[decision].tone}>{DECISIONS[decision].label}</Badge>
        {isNew && " — les produits acceptés sont ajoutés au stock."}
      </p>
      {!isNew && initial?.at && <p className="muted small">Reçue le {fmtDate(initial.at)}.</p>}
    </Sheet>
  );
}

