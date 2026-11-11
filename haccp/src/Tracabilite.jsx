import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, Trash2, CheckCircle2, Search, Printer } from "lucide-react";
import { isPrintAvailable, printLabelsSafe } from "./printer.js";
import ServicePrint from "./ServicePrint.jsx";
import LabelPhoto from "./LabelPhoto.jsx";
import { openingAdvice, isDdm } from "./products.js";
import SauceForm from "./Sauce.jsx";
import { useData } from "./store.jsx";
import { Sheet, Field, Chips, Badge, Empty, PhotoInput, PhotoThumb } from "./ui.jsx";
import { addDays, dayKey, daysUntil, fmtDate, fmtDayLong, fmtTime, fmtDateTime, toLocalInput, todayKey, parseNum, fmtNum } from "./utils.js";

export const TRACE_STATUS = {
  open: { label: "En cours", tone: "info" },
  used: { label: "Consommé", tone: "ok" },
  thrown: { label: "Jeté", tone: "ko" },
  replaced: { label: "Remplacé (nouveau lot)", tone: "neutral" },
};

// Durées de conservation par défaut (GBPH restauration / arrêté du 21/12/2009) — modifiables.
export const TRACE_KINDS = {
  open: {
    label: "Produit ouvert",
    days: 3,
    rule: "Respecte la durée « après ouverture » indiquée sur l'étiquette si elle existe. Sans indication : J+3 maximum, et jamais au-delà de la DLC d'origine.",
  },
  homemade: {
    label: "Préparation maison",
    days: 3,
    rule: "Sauces, marinades, préparations faites sur place : 3 jours maximum après le jour de fabrication (sans étude de durée de vie), conservées à +3 °C.",
  },
  frozen: {
    label: "Congélation",
    days: 90,
    rule: "Congeler uniquement un produit frais AVANT sa DLC (idéalement le jour de la réception), en portions, emballé et étiqueté (nom, lot, date de congélation), au congélateur à -18 °C. Conseil : 3 mois maximum. Une fois congelé à temps, la DLC d'origine ne compte plus.",
  },
  thawed: {
    label: "Décongélation",
    days: 3,
    rule: "Décongeler au réfrigérateur (jamais à température ambiante). À consommer sous 3 jours maximum après la mise en décongélation. Ne JAMAIS recongeler un produit décongelé. Si le produit a été congelé avant sa DLC, la DLC d'origine ne compte plus.",
  },
};


export function dlcTone(d) {
  if (!d) return "neutral";
  const n = daysUntil(d);
  if (n < 0) return "ko";
  if (n <= 1) return "warn";
  return "ok";
}
export function dlcLabel(d) {
  if (!d) return "—";
  const n = daysUntil(d);
  if (n < 0) return `DLC dépassée (${fmtDate(d)})`;
  if (n === 0) return "À consommer aujourd'hui";
  if (n > 20) return `Jusqu'au ${fmtDate(d)}`;
  if (n === 1) return "À consommer demain";
  return `Jusqu'au ${fmtDate(d)}`;
}
export { frozenInTime, effectiveDlc } from "./traceRules.js";
import { frozenInTime, effectiveDlc, autoReplaceOn, olderLots, replaceOlderLots } from "./traceRules.js";

export default function Tracabilite({ intent }) {
  const { data, save } = useData();
  const [edit, setEdit] = useState(intent === "new" ? {} : null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [sauce, setSauce] = useState(intent === "sauce");

  const list = useMemo(() => [...data.trace].sort((a, b) => b.at.localeCompare(a.at)), [data.trace]);
  const watch = list.filter((t) => t.status === "open" && effectiveDlc(t) && daysUntil(effectiveDlc(t)) <= 1);
  const filtered = list.filter(
    (t) =>
      (!status || t.status === status) &&
      (!q || `${t.product} ${t.lot} ${t.supplier}`.toLowerCase().includes(q.toLowerCase()))
  );
  const byDay = useMemo(() => {
    const m = new Map();
    for (const t of filtered) {
      const k = dayKey(t.at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return [...m.entries()].slice(0, 60);
  }, [filtered]);
  const todayCount = list.filter((t) => dayKey(t.at) === todayKey()).length;

  return (
    <div className="page">
      <div className="hero hero-neutral">
        <div>
          <div className="hero-title">Traçabilité du jour</div>
          <div className="hero-sub">{todayCount} produit(s) enregistré(s) aujourd'hui</div>
        </div>
        <div className="col gap-s">
          <button className="btn btn-primary" onClick={() => setEdit({})}>
            <Plus size={20} /> Produit sorti
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSauce(true)}>
            🥣 Sauce maison
          </button>
        </div>
      </div>
      {sauce && <SauceForm onClose={() => setSauce(false)} />}

      <button className="btn btn-ghost" onClick={() => setPrintOpen(true)}>
        <Printer size={18} /> Récap / étiquettes du service
      </button>
      {printOpen && <ServicePrint onClose={() => setPrintOpen(false)} />}
      {watch.length > 0 && (
        <>
          <h3 className="section-title">⚠️ À surveiller</h3>
          <div className="card list">
            {watch.map((t) => (
              <TraceRow key={t.id} t={t} onClick={() => setEdit(t)} onDone={(s) => save("trace", { ...t, status: s, closedAt: new Date().toISOString() })} />
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">Registre</h3>
      <div className="search">
        <Search size={18} />
        <input placeholder="Rechercher produit, lot, fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Chips
        options={Object.entries(TRACE_STATUS).map(([value, s]) => ({ value, label: s.label }))}
        value={status}
        onChange={setStatus}
      />
      {byDay.length === 0 && <Empty icon={ClipboardCheck}>Aucun produit enregistré.</Empty>}
      {byDay.map(([k, items]) => (
        <div key={k} className="day-group">
          <div className="day-title">{fmtDayLong(k)}</div>
          <div className="card list">
            {items.map((t) => (
              <TraceRow key={t.id} t={t} onClick={() => setEdit(t)} />
            ))}
          </div>
        </div>
      ))}

      {edit && <TraceForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function TraceRow({ t, onClick, onDone }) {
  const d = effectiveDlc(t);
  return (
    <div className="list-row" onClick={onClick} role="button">
      <PhotoThumb id={t.photoId} />
      <span className="list-main">
        <strong>{t.product}</strong>
        <span className="muted small">
          {TRACE_KINDS[t.kind || "open"]?.label} · {fmtTime(t.at)} {t.lot && `· Lot ${t.lot}`} {t.qty && `· ${t.qty}`} {t.by && `· ${t.by}`}
        </span>
        <span className="row gap-s wrap">
          <Badge tone={TRACE_STATUS[t.status]?.tone}>{TRACE_STATUS[t.status]?.label}</Badge>
          {t.status === "open" && d && <Badge tone={dlcTone(d)}>{dlcLabel(d)}</Badge>}
          {t.status === "open" && (t.saladette || []).some((e) => dayKey(e.at) === todayKey()) && <Badge tone="info">🥗 En saladette</Badge>}
        </span>
      </span>
      {onDone && (
        <span className="col gap-s" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm btn-ok" onClick={() => onDone("used")}>Consommé</button>
          <button className="btn btn-sm btn-ko" onClick={() => onDone("thrown")}>Jeté</button>
        </span>
      )}
    </div>
  );
}

function TraceForm({ initial, onClose }) {
  const { data, save, remove } = useData();
  const isNew = !initial.id;
  const [f, setF] = useState(() => ({
    product: "",
    supplier: "",
    lot: "",
    dlc: "",
    qty: "",
    kind: "open",
    dlcType: "DLC",
    keepDays: 3,
    status: "open",
    by: data.settings.operator || "",
    comment: "",
    photoId: null,
    stockId: "",
    stockQty: "",
    ...initial,
    atLocal: toLocalInput(initial.at || new Date()),
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const stockItem = data.stock.find((s) => s.id === f.stockId);
  const dlcAfter = f.keepDays ? dayKey(addDays(new Date(f.atLocal), Number(f.keepDays))) : "";
  const names = useMemo(
    () => [...new Set([...data.stock.map((s) => s.name), ...data.trace.map((t) => t.product)])].sort(),
    [data.stock, data.trace]
  );

  const kind = TRACE_KINDS[f.kind] || TRACE_KINDS.open;
  const canPrint = isPrintAvailable() && !!data.settings.printerAddress;
  const [labelText, setLabelText] = useState("");
  const [keepTouched, setKeepTouched] = useState(!isNew);
  const [typeTouched, setTypeTouched] = useState(!isNew);
  // DLC ou DDM selon le produit (frites, épicerie, boissons, sauces en bouteille… = DDM), tant que l'utilisateur n'a pas choisi
  useEffect(() => {
    if (typeTouched || f.kind === "homemade" || !f.product) return;
    const t = isDdm({ name: f.product, product: f.product }) ? "DDM" : "DLC";
    setF((s) => (s.dlcType === t ? s : { ...s, dlcType: t }));
  }, [f.product, typeTouched]); // eslint-disable-line react-hooks/exhaustive-deps
  const advice = f.kind === "open" && (f.product || labelText) ? openingAdvice(f.product, labelText) : null;
  // Durée conseillée appliquée automatiquement tant que l'utilisateur ne l'a pas changée
  useEffect(() => {
    if (!keepTouched && advice) setF((s) => (s.keepDays === (advice.days || "") ? s : { ...s, keepDays: advice.days || "" }));
  }, [advice?.days, keepTouched]); // eslint-disable-line react-hooks/exhaustive-deps
  const onRead = (r) => {
    setLabelText(r.raw || "");
    // « à consommer jusqu'au » / « de préférence avant » lu sur l'étiquette : c'est sûr
    if (r.dlc && !r.found?.includes("date (à vérifier)")) setTypeTouched(true);
    setF((s) => ({
      ...s,
      product: s.product || r.product,
      lot: s.lot || r.lot,
      dlc: s.dlc || r.dlc,
      dlcType: s.dlc ? s.dlcType : r.dlcType || s.dlcType,
      stamp: s.stamp || r.stamp,
    }));
  };
  // Choisir un produit du stock : tout est repris (nom, lot, date, photo, fournisseur)
  const pickStock = (id) => {
    const it = data.stock.find((x) => x.id === id);
    if (it?.dlcType) setTypeTouched(true);
    setF((s) => ({
      ...s,
      stockId: id,
      ...(it
        ? {
            product: it.name,
            lot: it.lot || s.lot,
            dlc: it.dlc || s.dlc,
            dlcType: it.dlcType || (isDdm(it) ? "DDM" : "DLC"),
            supplier: it.supplier || s.supplier,
            photoId: s.photoId || it.photoId || null,
          }
        : {}),
    }));
  };
  const [doPrint, setDoPrint] = useState(isNew && canPrint && !!data.settings.printerAuto);
  const frozenAtVal = f.kind === "frozen" ? f.atLocal : f.kind === "thawed" ? f.frozenAt : "";
  const okFrozen = !!frozenAtVal && (!f.dlc || dayKey(frozenAtVal) <= f.dlc);
  const frozenTooLate = !!frozenAtVal && f.dlc && f.dlcType === "DLC" && dayKey(frozenAtVal) > f.dlc;
  const dlcExpired = f.dlc && f.dlcType === "DLC" && daysUntil(f.dlc) < 0 && !okFrozen;
  // Lots congelés disponibles pour une décongélation
  const frozenLots = data.trace.filter((t) => t.kind === "frozen" && t.status === "open").sort((a, b) => a.at.localeCompare(b.at));
  const pickFrozen = (id) => {
    const t = frozenLots.find((x) => x.id === id);
    setF((s) => ({
      ...s,
      frozenId: id,
      ...(t ? { product: t.product, lot: t.lot || "", dlc: t.dlc || "", dlcType: t.dlcType || "DLC", supplier: t.supplier || "", photoId: s.photoId || t.photoId || null, frozenAt: dayKey(t.at) } : {}),
    }));
  };
  const ddmExpired = f.dlc && f.dlcType === "DDM" && daysUntil(f.dlc) < 0;

  const submit = async () => {
    if (!f.product.trim()) return alert("Indique le nom du produit.");
    if (isNew && !f.photoId && f.kind !== "homemade" && !confirm("Aucune photo de l'étiquette. Enregistrer quand même ?")) return;
    const { atLocal, stockQty, ...rest } = f;
    const rec = { ...rest, product: f.product.trim(), at: new Date(atLocal).toISOString(), dlcAfter };
    // DLC dépassée : le produit ne peut pas être utilisé (il doit être retiré et jeté).
    if (isNew && frozenTooLate) {
      return alert("Congelé APRÈS la DLC : ce n'est pas autorisé. Le produit ne peut pas être utilisé.");
    }
    if (isNew && dlcExpired) {
      if (!confirm("DLC dépassée : ce produit est INTERDIT à l'utilisation.\n\nL'enregistrer comme JETÉ ?")) return;
      rec.status = "thrown";
      rec.comment = [rec.comment, "Jeté : DLC dépassée"].filter(Boolean).join(" — ");
      rec.closedAt = new Date().toISOString();
    }
    // Déduction automatique du stock
    const dq = parseNum(stockQty);
    if (isNew && stockItem && Number.isFinite(dq) && dq > 0) {
      await save("stock", { ...stockItem, qty: Math.max(0, (stockItem.qty || 0) - dq) });
      await save("moves", {
        stockId: stockItem.id,
        name: stockItem.name,
        kind: "out",
        qty: -dq,
        unit: stockItem.unit,
        reason: "Sortie traçabilité",
        at: rec.at,
        by: f.by,
      });
      rec.stockQty = dq;
    }
    // Décongélation d'un lot congelé : le lot congelé est clôturé
    if (isNew && f.kind === "thawed" && f.frozenId) {
      const fl = frozenLots.find((x) => x.id === f.frozenId);
      if (fl && f.thawAll !== false) await save("trace", { ...fl, status: "used", closedAt: rec.at, comment: [fl.comment, "Décongelé"].filter(Boolean).join(" — ") });
    }
    const saved = await save("trace", rec);
    // Nouvelle préparation maison : l'ancien lot du même produit est remplacé
    if (isNew && f.kind === "homemade" && autoReplaceOn(data.settings)) await replaceOlderLots(save, data.trace, saved);
    onClose();
    if (doPrint && saved.status !== "thrown") printLabelsSafe([saved], data.settings);
  };

  return (
    <Sheet
      title={isNew ? "Produit sorti / ouvert" : f.product}
      onClose={onClose}
      footer={
        <div className="row gap">
          {!isNew && (
            <button
              className="btn btn-ghost danger"
              onClick={async () => {
                if (confirm("Supprimer cet enregistrement ?")) {
                  await remove("trace", initial.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          {!isNew && canPrint && (
            <button className="btn btn-ghost" onClick={() => printLabelsSafe([{ ...initial }], data.settings)} aria-label="Imprimer l'étiquette">
              <Printer size={20} />
            </button>
          )}
          <button className="btn btn-primary btn-block" onClick={submit}>
            <CheckCircle2 size={20} /> Enregistrer
          </button>
        </div>
      }
    >
      <Chips
        options={Object.entries(TRACE_KINDS).map(([value, k]) => ({ value, label: k.label }))}
        value={f.kind}
        onChange={(v) => v && setF((s) => ({ ...s, kind: v, keepDays: TRACE_KINDS[v].days }))}
      />
      <div className="alert info">ℹ️ {kind.rule}</div>
      {isNew && f.kind === "thawed" && frozenLots.length > 0 && (
        <Field label="Lot congelé à décongeler">
          <select className="input" value={f.frozenId || ""} onChange={(e) => pickFrozen(e.target.value)}>
            <option value="">— Choisir un lot congelé —</option>
            {frozenLots.map((t) => (
              <option key={t.id} value={t.id}>
                {t.product} — congelé le {fmtDate(t.at)}{t.lot ? ` · lot ${t.lot}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      {isNew && f.kind !== "homemade" && !(f.kind === "thawed" && f.frozenId) && data.stock.length > 0 && (
        <Field label="Prendre dans le stock (remplit tout automatiquement)">
          <select className="input" value={f.stockId} onChange={(e) => pickStock(e.target.value)}>
            <option value="">— Nouveau produit (photo) —</option>
            {[...data.stock].sort((a, b) => a.name.localeCompare(b.name)).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({fmtNum(x.qty, 2)} {x.unit}){x.dlc ? ` · ${x.dlcType || "DLC"} ${fmtDate(x.dlc)}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      <LabelPhoto
        photoId={f.photoId}
        onChange={set("photoId")}
        onRead={onRead}
        onPick={(field, text) => setF((s) => ({ ...s, [field]: text }))}
        read={f.kind !== "homemade"}
        label={f.kind === "homemade" ? "Photo (facultatif)" : "Photo de l'étiquette"}
      />
      <Field label="Produit *">
        <input className="input" list="trace-names" value={f.product} onChange={set("product")} placeholder="ex : Poulet mariné, Sauce blanche…" />
        <datalist id="trace-names">
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Field>
      <div className="grid2">
        <Field label="N° de lot">
          <input className="input" value={f.lot} onChange={set("lot")} />
        </Field>
        <Field label="Fournisseur">
          <input className="input" value={f.supplier} onChange={set("supplier")} />
        </Field>
        {(f.stamp || labelText) && (
          <Field label="Estampille sanitaire">
            <input className="input" value={f.stamp || ""} onChange={set("stamp")} placeholder="ex : FR 29.019.001 CE" />
          </Field>
        )}
        <Field label={f.kind === "homemade" ? "DLC ingrédient le plus court" : "Date sur l'étiquette"}>
          <input className="input" type="date" value={f.dlc} onChange={set("dlc")} />
          <Chips
            options={[{ value: "DLC", label: "DLC (à consommer jusqu'au)" }, { value: "DDM", label: "DDM (de préférence avant)" }]}
            value={f.dlcType}
            onChange={(v) => {
              if (!v) return;
              setTypeTouched(true);
              set("dlcType")(v);
            }}
          />
        </Field>
        <Field label="Quantité">
          <input className="input" value={f.qty} onChange={set("qty")} placeholder="ex : 2 kg, 1 seau" />
        </Field>
      </div>
      {f.kind === "thawed" && !f.frozenId && (
        <Field label="Congelé le (date de congélation)" hint="Si le produit a été congelé avant sa DLC, la DLC d'origine ne compte plus.">
          <input className="input" type="date" value={f.frozenAt || ""} onChange={set("frozenAt")} />
        </Field>
      )}
      {frozenTooLate && <div className="alert ko">Congelé après la DLC : interdit, le produit ne peut pas être utilisé.</div>}
      {okFrozen && f.dlc && f.dlcType === "DLC" && daysUntil(f.dlc) < 0 && (
        <div className="alert ok">Congelé avant la DLC ({fmtDate(f.dlc)}) : la DLC d'origine ne compte plus. Date limite = durée ci-dessous.</div>
      )}
      {dlcExpired && <div className="alert ko">DLC dépassée : produit interdit à l'utilisation, à retirer et jeter.</div>}
      {ddmExpired && <div className="alert warn">DDM dépassée : le produit reste consommable si l'emballage est intact et l'aspect normal (qualité moindre).</div>}
      <Field label={{ open: "Ouvert le", homemade: "Fabriqué le", thawed: "Mis à décongeler le", frozen: "Congelé le" }[f.kind] || "Date"}>
        <input className="input" type="datetime-local" value={f.atLocal} onChange={set("atLocal")} />
      </Field>
      <Field
        label="Durée de conservation"
        hint={
          dlcAfter
            ? f.kind === "frozen"
              ? `À utiliser avant le ${fmtDate(dlcAfter)} (au congélateur)`
              : `À consommer avant le ${fmtDate(!okFrozen && f.dlc && f.dlcType === "DLC" && f.dlc < dlcAfter ? f.dlc : dlcAfter)}${!okFrozen && f.dlc && f.dlcType === "DLC" && f.dlc < dlcAfter ? " (DLC d'origine plus courte)" : ""}`
            : "Pas de DLC secondaire"
        }
      >
        <Chips
          options={
            f.kind === "frozen"
              ? [{ value: 30, label: "1 mois" }, { value: 60, label: "2 mois" }, { value: 90, label: "3 mois ★" }, { value: 180, label: "6 mois" }]
              : [...new Set([1, 2, 3, 5, 7, ...(advice?.days ? [advice.days] : [])])]
                  .sort((x, y) => x - y)
                  .map((n) => ({ value: n, label: `J+${n}${advice?.days === n ? " ★" : ""}` }))
          }
          value={Number(f.keepDays) || null}
          onChange={(v) => {
            setKeepTouched(true);
            set("keepDays")(v || "");
          }}
        />
      </Field>
      {advice && (
        <div className="alert info">
          💡 <strong>Conseil{advice.type ? ` (${advice.type.label})` : ""} :</strong>{" "}
          {advice.days ? `${advice.days} jour(s) maximum après ouverture` : "pas de limite après ouverture, suivre la date du fabricant"}. {advice.text}
        </div>
      )}
      {Number(f.keepDays) > 3 && (f.kind === "homemade" || f.kind === "thawed") && (
        <div className="alert warn">Plus de 3 jours : seulement si une étude de durée de vie ou le fabricant le permet.</div>
      )}
      {isNew && stockItem && (
        <Field label={`Quantité retirée du stock (${stockItem.unit}) — en stock : ${fmtNum(stockItem.qty, 2)}`}>
          <input className="input" inputMode="decimal" value={f.stockQty} onChange={set("stockQty")} placeholder="ex : 1" />
        </Field>
      )}
      {!isNew && (
        <Field label="Statut">
          <Chips
            options={Object.entries(TRACE_STATUS).map(([value, s]) => ({ value, label: s.label }))}
            value={f.status}
            onChange={(v) => v && set("status")(v)}
          />
        </Field>
      )}
      <div className="grid2">
        <Field label="Initiales">
          <input className="input" value={f.by} onChange={set("by")} maxLength={12} />
        </Field>
        <Field label="Commentaire">
          <input className="input" value={f.comment} onChange={set("comment")} />
        </Field>
      </div>
      {isNew && canPrint && (
        <label className="check">
          <input type="checkbox" checked={doPrint} onChange={(e) => setDoPrint(e.target.checked)} />
          <Printer size={18} /> Imprimer l'étiquette DLC
        </label>
      )}
      {isNew && f.kind === "homemade" && autoReplaceOn(data.settings) && olderLots(data.trace, f.product).length > 0 && (
        <div className="alert info">
          ♻️ L'ancien lot de « {f.product} » (du {olderLots(data.trace, f.product).map((t) => fmtDate(t.at)).join(", ")}) sera clôturé automatiquement et remplacé par celui-ci.
        </div>
      )}
      {initial.ingredients?.length > 0 && (
        <div className="card pad">
          <span className="field-label">Ingrédients (traçabilité)</span>
          {initial.ingredients.map((i, k) => (
            <div key={k} className="small">
              <strong>{i.name}</strong>
              {i.lot && ` · lot ${i.lot}`}
              {i.dlc && ` · DLC ${fmtDate(i.dlc)}`}
            </div>
          ))}
        </div>
      )}
      {!isNew && <p className="muted small">Créé le {fmtDateTime(initial.createdAt)}</p>}
    </Sheet>
  );
}
