import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, Printer, RotateCcw, Ban, CheckCircle2, AlertTriangle } from "lucide-react";
import { useStore, dayKey } from "../lib/store.jsx";
import { money, vatBreakdown } from "../lib/pricing.js";
import { printOrderTickets } from "../lib/orderService.js";
import { printSegments, shareFile, textToBase64 } from "../lib/native.js";
import { clientTicket, kitchenTicket, reportTicket } from "../lib/tickets.js";
import { Modal, TicketPreview } from "./ui.jsx";

export default function OrdersTab({ toast }) {
  const { data, orders, patchOrder } = useStore();
  const s = data.settings;
  const [day, setDay] = useState(dayKey());
  const [open, setOpen] = useState(null);
  const [preview, setPreview] = useState(null);

  const list = useMemo(() => orders.filter((o) => dayKey(o.createdAt) === day).sort((a, b) => b.createdAt - a.createdAt), [orders, day]);
  const valid = list.filter((o) => !o.cancelled);
  const total = valid.reduce((a, o) => a + o.total, 0);
  const items = valid.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0);
  const top = useMemo(() => {
    const m = {};
    for (const o of valid) for (const it of o.items) m[it.name] = (m[it.name] || 0) + it.qty;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [valid]);
  const maxTop = top[0]?.[1] || 1;

  const shift = (n) => {
    const d = new Date(day + "T12:00:00");
    d.setDate(d.getDate() + n);
    setDay(dayKey(d.getTime()));
  };
  const isToday = day === dayKey();
  const dateLabel = new Date(day + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const reprint = async (o, which) => {
    const r = await printOrderTickets(o, s, { kitchen: which === "kitchen", client: which === "client" });
    if (r.ok) toast("Ticket envoyé à l'imprimante");
    else {
      toast(r.errors.join(" — ") || "Impression impossible", true);
      setPreview(which === "kitchen" ? kitchenTicket(o, s) : clientTicket(o, s));
    }
    if (which === "kitchen") patchOrder(o.id, { printed: r.ok, printErrors: r.errors });
  };

  const printReport = async () => {
    const segs = reportTicket(day, list, s);
    const cfg = s.printers.counter.enabled && s.printers.counter.type !== "none" ? s.printers.counter : s.printers.kitchen;
    const r = await printSegments(segs, cfg);
    if (r.ok) toast("Rapport imprimé");
    else {
      toast(r.error, true);
      setPreview(segs);
    }
  };

  const exportCsv = () => {
    const rows = [["N°", "Date", "Heure", "Type", "Client", "Produit", "Format", "Détails", "Qté", "Prix TTC", "TVA %", "Statut"]];
    for (const o of [...list].reverse())
      for (const it of o.items)
        rows.push([
          o.number,
          new Date(o.createdAt).toLocaleDateString("fr-FR"),
          new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          o.orderType,
          o.clientName || "",
          it.name,
          it.sizeLabel || "",
          [it.removed?.length ? "Sans " + it.removed.join(", ") : "", ...(it.choices || []).map((c) => `${c.label}: ${c.items.map((i) => i.name + (i.qty > 1 ? " x" + i.qty : "")).join(", ")}`)].filter(Boolean).join(" | "),
          it.qty,
          it.totalPrice.toFixed(2).replace(".", ","),
          it.vatRate,
          o.cancelled ? "Annulée" : o.paid ? "Payée" : "En attente",
        ]);
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    shareFile(`commandes-${day}.csv`, textToBase64(csv), "text/csv").catch((e) => toast(String(e.message || e), true));
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(18);
    doc.text(`${s.restaurantName} — Rapport du ${new Date(day + "T12:00:00").toLocaleDateString("fr-FR")}`, 14, y);
    y += 10;
    doc.setFontSize(11);
    const lines = [
      `Commandes : ${valid.length}   (annulées : ${list.length - valid.length})`,
      `Chiffre d'affaires TTC : ${money(total)}`,
      `Panier moyen : ${money(valid.length ? total / valid.length : 0)}`,
      ...vatBreakdown(valid.flatMap((o) => o.items)).map((v) => `TVA ${v.rate}% : HT ${money(v.ht)} — TVA ${money(v.tva)} — TTC ${money(v.ttc)}`),
    ];
    for (const l of lines) {
      doc.text(l.replace(/ /g, " "), 14, y);
      y += 7;
    }
    y += 4;
    doc.setFontSize(13);
    doc.text("Détail des commandes", 14, y);
    y += 8;
    doc.setFontSize(10);
    for (const o of [...valid].reverse()) {
      if (y > 275) {
        doc.addPage();
        y = 18;
      }
      const t = new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      doc.text(`N° ${o.number} — ${t} — ${o.orderType}${o.clientName ? " — " + o.clientName : ""}`, 14, y);
      doc.text(money(o.total).replace(/ /g, " "), 196, y, { align: "right" });
      y += 5;
      const desc = o.items.map((i) => `${i.qty}x ${i.name}${i.sizeLabel ? " (" + i.sizeLabel + ")" : ""}`).join(", ");
      for (const part of doc.splitTextToSize(desc, 175)) {
        doc.setTextColor(110);
        doc.text(part, 18, y);
        doc.setTextColor(0);
        y += 5;
      }
      y += 2;
    }
    const b64 = doc.output("datauristring").split(",")[1];
    shareFile(`rapport-${day}.pdf`, b64, "application/pdf").catch((e) => toast(String(e.message || e), true));
  };

  return (
    <div className="orders-tab">
      <div className="day-bar">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Jour précédent">
          <ChevronLeft size={22} />
        </button>
        <div className="day-label">
          <strong>{isToday ? "Aujourd'hui" : dateLabel}</strong>
          {isToday && <span>{dateLabel}</span>}
        </div>
        <button className="icon-btn" onClick={() => shift(1)} disabled={isToday} aria-label="Jour suivant">
          <ChevronRight size={22} />
        </button>
        <span className="spacer" />
        <button className="btn-ghost btn-sm" onClick={printReport}>
          <Printer size={16} /> Imprimer le rapport
        </button>
        <button className="btn-ghost btn-sm" onClick={exportPdf}>
          <FileDown size={16} /> PDF
        </button>
        <button className="btn-ghost btn-sm" onClick={exportCsv}>
          <FileDown size={16} /> Excel (CSV)
        </button>
      </div>

      <div className="kpis">
        <div className="kpi kpi-main">
          <span>Chiffre d'affaires TTC</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="kpi">
          <span>Commandes</span>
          <strong>{valid.length}</strong>
        </div>
        <div className="kpi">
          <span>Panier moyen</span>
          <strong>{money(valid.length ? total / valid.length : 0)}</strong>
        </div>
        <div className="kpi">
          <span>Articles vendus</span>
          <strong>{items}</strong>
        </div>
      </div>

      <div className="orders-grid">
        <div className="orders-list">
          <h3>Commandes</h3>
          {list.length === 0 && <p className="empty">Aucune commande ce jour-là.</p>}
          {list.map((o) => (
            <button key={o.id} className={`order-row ${o.cancelled ? "cancelled" : ""}`} onClick={() => setOpen(o)}>
              <span className="order-num">{o.number}</span>
              <span className="order-main">
                <strong>
                  {o.orderType}
                  {o.clientName ? ` · ${o.clientName}` : ""}
                </strong>
                <small>
                  {new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {o.items.reduce((a, i) => a + i.qty, 0)} articles
                </small>
              </span>
              {o.printed === false && !o.cancelled && (
                <span className="pill pill-err">
                  <AlertTriangle size={14} /> Non imprimée
                </span>
              )}
              {o.cancelled ? <span className="pill">Annulée</span> : o.paid ? <span className="pill pill-ok">Payée</span> : <span className="pill pill-wait">À encaisser</span>}
              <span className="order-total">{money(o.total)}</span>
            </button>
          ))}
        </div>
        <div className="top-products">
          <h3>Meilleures ventes</h3>
          {top.length === 0 && <p className="empty">—</p>}
          {top.map(([n, q]) => (
            <div key={n} className="bar-row">
              <span className="bar-name">{n}</span>
              <span className="bar">
                <span style={{ width: `${(q / maxTop) * 100}%` }} />
              </span>
              <span className="bar-val">{q}</span>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <OrderModal
          order={orders.find((o) => o.id === open.id) || open}
          onClose={() => setOpen(null)}
          onReprint={reprint}
          onPatch={(patch) => patchOrder(open.id, patch)}
          settings={s}
        />
      )}
      {preview && (
        <Modal title="Aperçu du ticket" onClose={() => setPreview(null)}>
          <TicketPreview segs={preview} width={s.printers.kitchen.width} />
        </Modal>
      )}
    </div>
  );
}

function OrderModal({ order: o, onClose, onReprint, onPatch, settings }) {
  return (
    <Modal
      wide
      title={`Commande N° ${o.number}`}
      onClose={onClose}
      footer={
        <>
          {!o.cancelled ? (
            <button className="btn-ghost danger" onClick={() => window.confirm("Annuler cette commande ? Elle ne comptera plus dans le chiffre du jour.") && onPatch({ cancelled: true })}>
              <Ban size={16} /> Annuler la commande
            </button>
          ) : (
            <button className="btn-ghost" onClick={() => onPatch({ cancelled: false })}>
              <RotateCcw size={16} /> Rétablir
            </button>
          )}
          <span className="spacer" />
          <button className="btn-ghost" onClick={() => onReprint(o, "kitchen")}>
            <Printer size={16} /> Ticket cuisine
          </button>
          <button className="btn-ghost" onClick={() => onReprint(o, "client")}>
            <Printer size={16} /> Ticket client
          </button>
          {!o.cancelled &&
            (o.paid ? (
              <button className="btn-ghost" onClick={() => onPatch({ paid: false, paymentMethod: null })}>
                Marquer non payée
              </button>
            ) : (
              <>
                <button className="btn-primary" onClick={() => onPatch({ paid: true, paymentMethod: "Espèces" })}>
                  <CheckCircle2 size={16} /> Payé espèces
                </button>
                <button className="btn-primary" onClick={() => onPatch({ paid: true, paymentMethod: "Carte" })}>
                  <CheckCircle2 size={16} /> Payé carte
                </button>
              </>
            ))}
        </>
      }
    >
      <div className="order-detail">
        <div>
          <p className="od-meta">
            {new Date(o.createdAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })} · <strong>{o.orderType}</strong>
            {o.clientName && <> · {o.clientName}</>}
            {o.paid && <> · Payée ({o.paymentMethod})</>}
          </p>
          {o.printErrors?.length > 0 && <p className="od-err">⚠ Impression : {o.printErrors.join(" — ")}</p>}
          <ul className="checkout-list">
            {o.items.map((it, i) => (
              <li key={i}>
                <div>
                  <strong>
                    {it.qty} × {it.name}
                  </strong>
                  {it.sizeLabel && <span> · {it.sizeLabel}</span>}
                  {it.removed?.length > 0 && <p>Sans {it.removed.join(", ").toLowerCase()}</p>}
                  {(it.choices || []).map((c, k) => (
                    <p key={k}>
                      {c.label} : {c.items.map((x) => (x.qty > 1 ? `${x.name} ×${x.qty}` : x.name)).join(", ")}
                    </p>
                  ))}
                </div>
                <span>{money(it.totalPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="checkout-total">
            <span>Total TTC</span>
            <strong>{money(o.total)}</strong>
          </div>
        </div>
        <div>
          <span className="field-label">Ticket cuisine</span>
          <TicketPreview segs={kitchenTicket(o, settings)} width={settings.printers.kitchen.width} />
        </div>
      </div>
    </Modal>
  );
}
