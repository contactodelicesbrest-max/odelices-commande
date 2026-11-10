import { useMemo, useState } from "react";
import { Printer, ReceiptText } from "lucide-react";
import { useData } from "./store.jsx";
import { Sheet, Chips } from "./ui.jsx";
import { fmtTime, momentOfDay } from "./utils.js";
import { buildRecap, isPrintAvailable, printLabelsSafe, printRecap, serviceTraces } from "./printer.js";
import { fryerStatus } from "./Huile.jsx";
import { taskState } from "./Nettoyage.jsx";

// Fenêtre « Impression du service » : récap matin/soir + étiquettes DLC du service.
export default function ServicePrint({ onClose }) {
  const { data, saveMany } = useData();
  const [moment, setMoment] = useState(momentOfDay());
  const [busy, setBusy] = useState(false);
  const canPrint = isPrintAvailable() && !!data.settings.printerAddress;

  const extra = useMemo(
    () => ({
      fryers: data.fryers.map((f) => {
        const st = fryerStatus(f, data.oil, data.settings);
        const last = st.lastControl;
        return {
          name: f.name,
          text: st.forbidden
            ? "A CHANGER"
            : st.days === null
            ? "changement non noté"
            : `changée il y a ${st.days} j${last && Number.isFinite(last.tpm) ? `, ${last.tpm}%` : ""}`,
        };
      }),
      cleanTodo: [...data.cleanTasks]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((t) => ({ t, ...taskState(t, data.cleanLogs) }))
        .filter((x) => !x.done && (!x.t.hood || x.late))
        .map((x) => x.t.name),
    }),
    [data]
  );
  const preview = useMemo(() => buildRecap(data, moment, extra).preview.join("\n"), [data, moment, extra]);
  const items = serviceTraces(data.trace, moment);
  const [selected, setSelected] = useState(() => new Set(items.filter((t) => !t.printedAt).map((t) => t.id)));

  const recap = async () => {
    setBusy(true);
    try {
      await printRecap(data, moment, extra);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  const labels = async () => {
    const list = items.filter((t) => selected.has(t.id));
    if (!list.length) return alert("Aucune étiquette sélectionnée.");
    setBusy(true);
    const ok = await printLabelsSafe(list, data.settings, 1);
    if (ok) await saveMany("trace", list.map((t) => ({ ...t, printedAt: new Date().toISOString() })));
    setBusy(false);
  };

  return (
    <Sheet title="Impression du service" onClose={onClose}>
      {!canPrint && (
        <div className="alert warn">
          {isPrintAvailable() ? "Choisis d'abord l'imprimante dans Réglages → Imprimante d'étiquettes." : "L'impression fonctionne seulement dans l'appli Android (APK). Aperçu ci-dessous."}
        </div>
      )}
      <Chips options={["Matin", "Soir"]} value={moment} onChange={(v) => v && setMoment(v)} />

      <span className="field-label">Ticket récap du service</span>
      <pre className="ticket">{preview}</pre>
      <button className="btn btn-primary" disabled={busy || !canPrint} onClick={recap}>
        <ReceiptText size={20} /> Imprimer le récap {moment.toLowerCase()}
      </button>

      <span className="field-label">Étiquettes DLC des produits du service ({items.length})</span>
      {!items.length && <p className="muted small">Aucun produit enregistré dans la traçabilité pour ce service.</p>}
      {items.length > 0 && (
        <div className="checks">
          {items.map((t) => (
            <label key={t.id} className="check">
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={(e) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    e.target.checked ? n.add(t.id) : n.delete(t.id);
                    return n;
                  })
                }
              />
              <span className="list-main">
                <strong>{t.product}</strong>
                <span className="muted small">
                  {fmtTime(t.at)}
                  {t.printedAt ? " · déjà imprimée" : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      <button className="btn btn-ghost" disabled={busy || !canPrint || !items.length} onClick={labels}>
        <Printer size={20} /> Imprimer {selected.size} étiquette(s)
      </button>
    </Sheet>
  );
}
