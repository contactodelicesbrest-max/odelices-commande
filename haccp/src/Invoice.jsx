import { useMemo, useRef, useState } from "react";
import { Camera, FileText, Image as ImageIcon, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Field, Badge, PhotoThumb } from "./ui.jsx";
import { compressImage, dayKey, fmtDate, fmtNum, parseNum, todayKey } from "./utils.js";
import { guessUnit, parseInvoice, readInvoicePdf, readInvoicePhoto, SUPPLIERS } from "./invoiceReader.js";
import { isOcrAvailable } from "./labelReader.js";
import { detectType } from "./products.js";
import { UNITS } from "./Stock.jsx";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
const words = (s) =>
  norm(s)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !["kg", "les", "des", "pour", "avec", "carton", "pack", "colis", "kilos"].includes(w));

// Produit du stock qui ressemble le plus à la ligne de facture
function matchStock(name, stock) {
  const w = new Set(words(name));
  if (!w.size) return null;
  let best = null;
  for (const it of stock) {
    const iw = words(it.name);
    if (!iw.length) continue;
    const common = iw.filter((x) => w.has(x)).length;
    const score = common / Math.min(iw.length, w.size);
    if (common && score >= 0.5 && (!best || score > best.score)) best = { it, score };
  }
  return best?.it || null;
}

const key = () => Math.random().toString(36).slice(2);
const fmtMoney = (n) => (Number.isFinite(n) ? n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "—");

export default function InvoiceForm({ initial, onClose }) {
  const { data, save, saveMany, remove, savePhoto } = useData();
  const isNew = !initial?.id;
  const [head, setHead] = useState({
    supplier: initial?.supplier || "",
    number: initial?.number || "",
    date: initial?.date || todayKey(),
    totalTTC: initial?.totalTTC != null ? String(initial.totalTTC).replace(".", ",") : "",
  });
  const [photoIds, setPhotoIds] = useState(initial?.photoIds || []);
  const [lines, setLines] = useState(() => (initial?.lines || []).map((l) => ({ key: key(), ...l })));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const camRef = useRef();
  const galRef = useRef();
  const pdfRef = useRef();
  const stock = data.stock;

  const addParsed = (parsed) => {
    setHead((h) => ({
      supplier: h.supplier || parsed.supplier,
      number: h.number || parsed.number,
      date: (h.date === todayKey() && parsed.date) || h.date,
      totalTTC: h.totalTTC || (parsed.totalTTC != null ? String(parsed.totalTTC).replace(".", ",") : ""),
    }));
    const newLines = parsed.lines.map((l) => {
      const m = matchStock(l.name, stock);
      return {
        key: key(),
        include: true,
        name: l.name,
        qty: String(l.qty).replace(".", ","),
        unit: m?.unit || guessUnit(l.name, l.pack),
        pack: l.pack,
        unitPrice: l.unitPrice ?? (l.unitPriceTTC ? +(l.unitPriceTTC / 1.055).toFixed(3) : null),
        total: l.total,
        ttc: !!l.unitPriceTTC,
        stockId: m?.id || "",
      };
    });
    setLines((ls) => [...ls, ...newLines]);
    setMsg(
      newLines.length
        ? { tone: "ok", text: `${newLines.length} ligne(s) trouvée(s)${parsed.supplier ? ` — ${parsed.supplier}` : ""}. Vérifie chaque ligne avant d'ajouter au stock.` }
        : { tone: "warn", text: "Aucune ligne de produit reconnue. Reprends la photo bien à plat et de face, ou ajoute les lignes à la main." }
    );
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("Lecture de la facture…");
    try {
      const keep = await compressImage(f, 1600, 0.7);
      const id = await savePhoto(keep);
      setPhotoIds((p) => [...p, id]);
      if (!isOcrAvailable()) {
        setMsg({ tone: "warn", text: "La lecture des photos fonctionne dans l'appli Android. Ici, ajoute les lignes à la main ou importe le PDF." });
        return;
      }
      const big = await compressImage(f, 2600, 0.88);
      addParsed(parseInvoice(await readInvoicePhoto(big)));
    } catch (err) {
      setMsg({ tone: "warn", text: "Lecture impossible : " + (err?.message || err) });
    } finally {
      setBusy("");
    }
  };

  const onPdf = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy("Lecture du PDF…");
    try {
      const { items, images } = await readInvoicePdf(f);
      for (const img of images.slice(0, 3)) {
        const id = await savePhoto(img);
        setPhotoIds((p) => [...p, id]);
      }
      addParsed(parseInvoice(items));
    } catch (err) {
      setMsg({ tone: "warn", text: "PDF illisible : " + (err?.message || err) });
    } finally {
      setBusy("");
    }
  };

  const setLine = (k, patch) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const included = lines.filter((l) => l.include && l.name.trim() && Number.isFinite(parseNum(l.qty)) && parseNum(l.qty) > 0);
  const sumHT = lines.filter((l) => l.include).reduce((s, l) => s + (Number(l.total) || 0), 0);
  const sortedStock = useMemo(() => [...stock].sort((a, b) => a.name.localeCompare(b.name)), [stock]);

  const submit = async () => {
    if (!included.length) return alert("Aucune ligne à ajouter (coche au moins une ligne avec une quantité).");
    setBusy("Ajout au stock…");
    const at = new Date((head.date || todayKey()) + "T12:00:00").toISOString();
    const by = data.settings.operator || "";
    const supplier = head.supplier.trim();
    const savedLines = [];
    const moves = [];
    for (const l of lines) {
      const qty = parseNum(l.qty);
      if (!(l.include && l.name.trim() && qty > 0)) {
        savedLines.push({ ...l, include: false, key: undefined });
        continue;
      }
      let item = stock.find((s) => s.id === l.stockId);
      const price = Number.isFinite(l.unitPrice) ? l.unitPrice : null;
      const saved = await save("stock", {
        ...(item || {
          name: l.name.trim(),
          category: detectType(l.name)?.cat || "Autre",
          unit: l.unit,
          min: null,
          location: "",
        }),
        qty: (item?.qty || 0) + qty,
        supplier: supplier || item?.supplier || "",
        lastPrice: price ?? item?.lastPrice ?? null,
      });
      moves.push({
        stockId: saved.id,
        name: saved.name,
        kind: "in",
        qty,
        unit: saved.unit,
        reason: `Facture ${supplier}${head.number ? " n° " + head.number : ""}`,
        at,
        by,
      });
      savedLines.push({ ...l, key: undefined, qty, stockId: saved.id });
    }
    if (moves.length) await saveMany("moves", moves);
    await save("invoices", {
      supplier,
      number: head.number.trim(),
      date: head.date,
      totalTTC: Number.isFinite(parseNum(head.totalTTC)) ? parseNum(head.totalTTC) : null,
      totalHT: +sumHT.toFixed(2),
      photoIds: photoIds.filter(Boolean),
      lines: savedLines,
      at,
      by,
    });
    setBusy("");
    alert(`${moves.length} produit(s) ajouté(s) au stock ✓`);
    onClose();
  };

  // --- Facture déjà enregistrée : consultation
  if (!isNew) {
    return (
      <Sheet
        title={`Facture ${initial.supplier || ""}`}
        onClose={onClose}
        footer={
          <button
            className="btn btn-ghost danger"
            onClick={async () => {
              if (confirm("Supprimer cette facture ? (le stock n'est pas modifié)")) {
                await remove("invoices", initial.id);
                onClose();
              }
            }}
          >
            <Trash2 size={18} /> Supprimer la facture
          </button>
        }
      >
        <div className="kv">
          <span>Fournisseur</span>
          <strong>{initial.supplier || "—"}</strong>
          <span>N°</span>
          <strong>{initial.number || "—"}</strong>
          <span>Date</span>
          <strong>{fmtDate(initial.date)}</strong>
          <span>Total TTC</span>
          <strong>{fmtMoney(initial.totalTTC)}</strong>
        </div>
        <div className="row gap-s wrap">{(initial.photoIds || []).map((id) => <PhotoThumb key={id} id={id} large />)}</div>
        <div className="card list">
          {(initial.lines || []).filter((l) => l.include !== false).map((l, i) => (
            <div key={i} className="list-row">
              <span className="list-main">
                <strong>{l.name}</strong>
                <span className="muted small">
                  {fmtNum(Number(l.qty), 2)} {l.unit}
                  {l.unitPrice ? ` × ${fmtMoney(l.unitPrice)}` : ""}
                </span>
              </span>
              <span className="temp-val ok">{fmtMoney(l.total)}</span>
            </div>
          ))}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Facture fournisseur"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" disabled={!!busy} onClick={submit}>
          <CheckCircle2 size={20} /> Ajouter {included.length} produit(s) au stock
        </button>
      }
    >
      <div className="grid2">
        <button className="btn btn-photo" disabled={!!busy} onClick={() => camRef.current.click()}>
          <Camera size={20} /> {photoIds.length ? "Page suivante" : "Photo"}
        </button>
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => pdfRef.current.click()}>
          <FileText size={20} /> Importer PDF
        </button>
      </div>
      <button className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => galRef.current.click()}>
        <ImageIcon size={16} /> Choisir une photo dans la galerie
      </button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={onPdf} />
      {photoIds.filter(Boolean).length > 0 && <div className="row gap-s wrap">{photoIds.filter(Boolean).map((id) => <PhotoThumb key={id} id={id} />)}</div>}
      {busy && <div className="alert info">🔎 {busy}</div>}
      {msg && <div className={"alert " + msg.tone}>{msg.text}</div>}
      <p className="muted small">Astuce : facture bien à plat, de face, toute la page dans la photo et sans ombre. Une photo par page.</p>

      <div className="grid2">
        <Field label="Fournisseur">
          <input className="input" list="inv-suppliers" value={head.supplier} onChange={(e) => setHead({ ...head, supplier: e.target.value })} />
          <datalist id="inv-suppliers">
            {[...new Set([...SUPPLIERS.map((s) => s.name), ...data.invoices.map((i) => i.supplier).filter(Boolean)])].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="N° de facture">
          <input className="input" value={head.number} onChange={(e) => setHead({ ...head, number: e.target.value })} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} />
        </Field>
        <Field label="Total TTC">
          <input className="input" inputMode="decimal" value={head.totalTTC} onChange={(e) => setHead({ ...head, totalTTC: e.target.value })} />
        </Field>
      </div>

      <span className="field-label">
        Lignes ({lines.filter((l) => l.include).length}) — total HT lu : {fmtMoney(sumHT)}
      </span>
      {lines.map((l) => {
        const item = stock.find((s) => s.id === l.stockId);
        return (
          <div key={l.key} className={"rec-line" + (l.include ? "" : " refused")}>
            <div className="row gap-s">
              <input type="checkbox" className="big-check" checked={l.include} onChange={(e) => setLine(l.key, { include: e.target.checked })} />
              <input className="input" value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} placeholder="Produit" />
              <button className="icon-btn" aria-label="Retirer" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                <XCircle size={20} />
              </button>
            </div>
            <div className="row gap-s">
              <input className="input qty" inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} placeholder="Qté" />
              <select className="input" value={item ? item.unit : l.unit} disabled={!!item} onChange={(e) => setLine(l.key, { unit: e.target.value })}>
                {[...new Set([...UNITS, "pack", l.unit])].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <span className="muted small nowrap">{l.total != null ? fmtMoney(l.total) : ""}</span>
            </div>
            {l.pack && <span className="muted small">Colis de {l.pack}</span>}
            <select className="input" value={l.stockId} onChange={(e) => setLine(l.key, { stockId: e.target.value })}>
              <option value="">➕ Nouveau produit dans le stock</option>
              {sortedStock.map((s) => (
                <option key={s.id} value={s.id}>
                  → {s.name} ({fmtNum(s.qty, 2)} {s.unit})
                </option>
              ))}
            </select>
            {item && <Badge tone="info">Ajouté à « {item.name} »</Badge>}
          </div>
        );
      })}
      <button className="btn btn-ghost" onClick={() => setLines((ls) => [...ls, { key: key(), include: true, name: "", qty: "1", unit: "pièce", stockId: "", total: null }])}>
        <Plus size={18} /> Ajouter une ligne à la main
      </button>
    </Sheet>
  );
}

// Liste des dernières factures (onglet Stock)
export function InvoiceList({ onOpen }) {
  const { data } = useData();
  const list = [...data.invoices].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.at.localeCompare(a.at));
  const month = todayKey().slice(0, 7);
  const monthTotal = list.filter((i) => (i.date || dayKey(i.at)).startsWith(month)).reduce((s, i) => s + (i.totalTTC || 0), 0);
  if (!list.length) return <p className="muted small">Aucune facture enregistrée. Bouton « Facture » en haut : photo ou PDF, les produits vont directement dans le stock.</p>;
  return (
    <>
      <p className="muted small">Achats du mois (TTC) : <strong>{fmtMoney(monthTotal)}</strong></p>
      <div className="card list">
        {list.slice(0, 15).map((i) => (
          <div key={i.id} className="list-row" role="button" onClick={() => onOpen(i)}>
            {i.photoIds?.[0] && <PhotoThumb id={i.photoIds[0]} />}
            <span className="list-main">
              <strong>{i.supplier || "Facture"}</strong>
              <span className="muted small">
                {fmtDate(i.date)}
                {i.number ? ` · n° ${i.number}` : ""} · {(i.lines || []).filter((l) => l.include !== false).length} produit(s)
              </span>
            </span>
            <span className="temp-val">{fmtMoney(i.totalTTC ?? i.totalHT)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
