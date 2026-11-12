import { useState } from "react";
import { Bluetooth, Printer, RefreshCw, Wifi } from "lucide-react";
import { useStore } from "../lib/store.jsx";
import { isNative, listBluetoothPrinters, printSegments } from "../lib/native.js";
import { clientTicket, kitchenTicket, testTicket } from "../lib/tickets.js";
import { Field, Num, Seg, Text, Toggle, TicketPreview } from "./ui.jsx";

const SAMPLE = {
  number: 42,
  createdAt: Date.now(),
  orderType: "Sur place",
  clientName: "Sarah",
  total: 22.5,
  items: [
    { qty: 1, name: "Tacos", sizeLabel: "L · 2 viandes", removed: [], choices: [{ label: "Viandes", items: [{ name: "Kebab", qty: 1 }, { name: "Tenders", qty: 1 }] }, { label: "Sauces", items: [{ name: "Algérienne", qty: 1 }] }], totalPrice: 12.5, vatRate: 10 },
    { qty: 1, name: "Döner Kebab", sizeLabel: "Avec boisson", removed: ["Oignons"], choices: [{ label: "Viande", items: [{ name: "Kebab", qty: 1 }] }, { label: "Pain ou galette", items: [{ name: "Galette", qty: 1 }] }, { label: "Boisson", items: [{ name: "Coca-Cola", qty: 1 }] }], totalPrice: 10, vatRate: 10 },
  ],
};

export default function PrintersTab({ toast }) {
  const { data, update } = useStore();
  const s = data.settings;
  const [devices, setDevices] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [which, setWhich] = useState("kitchen");

  const scan = async () => {
    setScanning(true);
    try {
      setDevices(await listBluetoothPrinters());
    } catch (e) {
      toast(e.message || String(e), true);
      setDevices([]);
    }
    setScanning(false);
  };

  const card = (key, title, desc) => {
    const cfg = s.printers[key];
    const set = (patch) => update((d) => void Object.assign(d.settings.printers[key], patch));
    const enabled = key === "kitchen" || cfg.enabled;
    return (
      <div className={`printer-card ${which === key ? "on" : ""}`} onClick={() => setWhich(key)}>
        <div className="printer-head">
          <Printer size={22} />
          <div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </div>
          {key === "counter" && <Toggle checked={cfg.enabled} onChange={(v) => set({ enabled: v })} />}
        </div>
        {enabled && (
          <>
            <Field label="Connexion">
              <Seg
                value={cfg.type}
                onChange={(v) => set({ type: v })}
                options={[
                  { value: "bluetooth", label: "Bluetooth" },
                  { value: "network", label: "Wi-Fi / Ethernet" },
                  { value: "none", label: "Aucune" },
                ]}
              />
            </Field>
            {cfg.type === "bluetooth" && (
              <div className="bt-box">
                <p className="field-hint">
                  1. Allumez l'imprimante et appairez-la dans <b>Paramètres Android → Bluetooth</b> (code souvent 0000 ou 1234).
                  <br />
                  2. Revenez ici et touchez « Rechercher ».
                </p>
                <div className="bt-current">
                  <Bluetooth size={18} /> {cfg.address ? `${cfg.name || "Imprimante"} (${cfg.address})` : "Aucune imprimante choisie"}
                </div>
                <button className="btn-ghost btn-sm" onClick={scan} disabled={!isNative || scanning}>
                  <RefreshCw size={16} className={scanning ? "spin" : ""} /> Rechercher les appareils appairés
                </button>
                {!isNative && <p className="field-hint">La recherche Bluetooth fonctionne uniquement dans l'application Android.</p>}
                {devices && (
                  <div className="chip-row">
                    {devices.length === 0 && <span className="field-hint">Aucun appareil appairé trouvé.</span>}
                    {devices.map((dv) => (
                      <button key={dv.address} className={`chip ${cfg.address === dv.address ? "chip-sel" : ""}`} onClick={() => set({ address: dv.address, name: dv.name })}>
                        {dv.name || dv.address}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {cfg.type === "network" && (
              <div className="form-grid">
                <Field label="Adresse IP de l'imprimante" hint="Imprimez la page de config de l'imprimante pour la connaître">
                  <Text value={cfg.host} onChange={(v) => set({ host: v.trim() })} placeholder="192.168.1.100" inputMode="decimal" />
                </Field>
                <Field label="Port" className="w-small">
                  <Num decimals={0} value={cfg.port} onChange={(v) => set({ port: v })} />
                </Field>
              </div>
            )}
            {cfg.type !== "none" && (
              <>
                <div className="form-grid">
                  <Field label="Largeur du papier">
                    <Seg
                      value={Number(cfg.width)}
                      onChange={(v) => set({ width: v })}
                      options={[
                        { value: 32, label: "58 mm" },
                        { value: 48, label: "80 mm" },
                      ]}
                    />
                  </Field>
                  <Field label="Exemplaires" className="w-small">
                    <Num decimals={0} value={cfg.copies} onChange={(v) => set({ copies: Math.max(1, Math.min(5, v)) })} />
                  </Field>
                </div>
                <div className="toggle-row">
                  <Toggle checked={cfg.accents} onChange={(v) => set({ accents: v })} label="Imprimer les accents (é, à, €)" />
                  <Toggle checked={cfg.cut} onChange={(v) => set({ cut: v })} label="Coupe automatique" />
                  {key === "counter" && <Toggle checked={cfg.vat} onChange={(v) => set({ vat: v })} label="Détail TVA" />}
                </div>
                <p className="field-hint">Si les accents s'impriment mal (caractères bizarres), désactivez l'option : le texte sera imprimé sans accents.</p>
                <button
                  className="btn-primary"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const r = await printSegments(testTicket(s, title), cfg);
                    r.ok ? toast("Ticket de test envoyé ✔") : toast(r.error, true);
                  }}
                >
                  <Printer size={16} /> Imprimer un test
                </button>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const k = s.printers.kitchen;
  return (
    <div className="printers-tab">
      <div className="printers-col">
        {card("kitchen", "Imprimante cuisine", "Reçoit chaque commande dès qu'elle est validée sur la borne.")}
        {card("counter", "Imprimante caisse (facultatif)", "Imprime le ticket client avec les prix, au comptoir.")}
        {!s.printers.counter.enabled && (
          <div className="printer-card">
            <Toggle
              checked={s.clientTicketOnKitchen}
              onChange={(v) => update((d) => void (d.settings.clientTicketOnKitchen = v))}
              label="Sans imprimante caisse : imprimer aussi le ticket client (avec prix et TVA) sur l'imprimante cuisine"
            />
          </div>
        )}
      </div>
      <div className="preview-col">
        <span className="field-label">Aperçu {which === "kitchen" ? "ticket cuisine" : "ticket client"}</span>
        <TicketPreview segs={which === "kitchen" ? kitchenTicket(SAMPLE, s) : clientTicket(SAMPLE, s, true)} width={(which === "kitchen" ? k : s.printers.counter).width || 32} />
      </div>
    </div>
  );
}
