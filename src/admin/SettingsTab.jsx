import { useEffect, useState } from "react";
import { Download, Lock, RotateCcw, Upload } from "lucide-react";
import { useStore } from "../lib/store.jsx";
import { defaultMenu } from "../lib/defaultData.js";
import { isKioskActive, isNative, setKiosk, shareFile, textToBase64 } from "../lib/native.js";
import { Field, Num, Text, Toggle } from "./ui.jsx";

export default function SettingsTab({ toast }) {
  const { data, update, replaceAll } = useStore();
  const s = data.settings;
  const set = (patch) => update((d) => void Object.assign(d.settings, patch));
  const [pin, setPin] = useState({ a: "", b: "" });
  const [kiosk, setKioskState] = useState(false);

  useEffect(() => {
    isKioskActive().then(setKioskState);
  }, []);

  return (
    <div className="settings-tab">
      <section className="card">
        <h3>Restaurant</h3>
        <div className="form-grid">
          <Field label="Nom affiché">
            <Text value={s.restaurantName} onChange={(v) => set({ restaurantName: v })} />
          </Field>
          <Field label="Slogan (écran d'accueil)">
            <Text value={s.tagline} onChange={(v) => set({ tagline: v })} />
          </Field>
          <Field label="Adresse (ticket client)">
            <Text value={s.address} onChange={(v) => set({ address: v })} />
          </Field>
          <Field label="Téléphone (ticket client)">
            <Text value={s.phone} onChange={(v) => set({ phone: v })} inputMode="tel" />
          </Field>
          <Field label="SIRET">
            <Text value={s.siret} onChange={(v) => set({ siret: v })} />
          </Field>
          <Field label="Message en bas du ticket">
            <Text value={s.ticketFooter} onChange={(v) => set({ ticketFooter: v })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3>Borne de commande</h3>
        <div className="toggle-col">
          <Toggle checked={s.orderTypes.surPlace} onChange={(v) => update((d) => void (d.settings.orderTypes.surPlace = v || !d.settings.orderTypes.emporter))} label="Proposer « Sur place »" />
          <Toggle checked={s.orderTypes.emporter} onChange={(v) => update((d) => void (d.settings.orderTypes.emporter = v || !d.settings.orderTypes.surPlace))} label="Proposer « À emporter »" />
          <Toggle checked={s.askName} onChange={(v) => set({ askName: v })} label="Demander le prénom du client" />
          <Toggle checked={s.hideUnavailable} onChange={(v) => set({ hideUnavailable: v })} label="Masquer les produits épuisés (sinon affichés grisés « Épuisé »)" />
        </div>
        <Field label="Retour automatique à l'accueil après inactivité (secondes)" className="w-price">
          <Num decimals={0} value={s.idleSeconds} onChange={(v) => set({ idleSeconds: Math.max(20, v) })} />
        </Field>
      </section>

      <section className="card">
        <h3>
          <Lock size={18} /> Sécurité
        </h3>
        <p className="field-hint">
          L'espace gérant s'ouvre par un <b>appui long (2 secondes) sur le logo</b>, puis le code PIN.
        </p>
        <div className="form-grid">
          <Field label="Nouveau code PIN (4 à 6 chiffres)">
            <input className="input" type="password" inputMode="numeric" value={pin.a} onChange={(e) => setPin({ ...pin, a: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
          </Field>
          <Field label="Confirmer le code">
            <input className="input" type="password" inputMode="numeric" value={pin.b} onChange={(e) => setPin({ ...pin, b: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
          </Field>
        </div>
        <button
          className="btn-primary btn-sm"
          disabled={pin.a.length < 4 || pin.a !== pin.b}
          onClick={() => {
            set({ adminPin: pin.a });
            setPin({ a: "", b: "" });
            toast("Code PIN modifié");
          }}
        >
          Changer le code
        </button>
        <hr />
        <Toggle
          checked={kiosk}
          onChange={async (v) => {
            if (!isNative) return toast("Disponible uniquement dans l'application Android", true);
            await setKiosk(v);
            setTimeout(async () => setKioskState(await isKioskActive()), 800);
          }}
          label="Mode borne verrouillé (les clients ne peuvent pas quitter l'application)"
        />
        <p className="field-hint">
          Android vous demandera de confirmer l'épinglage de l'écran. Pour sortir : désactivez ce mode ici (espace gérant). Astuce : dans Paramètres Android → Sécurité → « Épinglage
          d'application », activez « Demander le code avant de désépingler ».
        </p>
      </section>

      <section className="card">
        <h3>Sauvegarde du menu</h3>
        <p className="field-hint">Exportez le menu et les réglages (à garder sur votre téléphone ou Drive), pour les restaurer ou les copier sur une autre tablette.</p>
        <div className="btn-row">
          <button
            className="btn-ghost"
            onClick={() => {
              const { counter, ...rest } = data;
              shareFile(`odelices-menu-${new Date().toISOString().slice(0, 10)}.json`, textToBase64(JSON.stringify(rest, null, 1)), "application/json").catch((e) =>
                toast(e.message || String(e), true)
              );
            }}
          >
            <Download size={16} /> Exporter
          </button>
          <label className="btn-ghost">
            <Upload size={16} /> Importer
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const d = JSON.parse(await f.text());
                  if (!d.menu?.products) throw new Error("Fichier invalide");
                  if (!window.confirm("Remplacer le menu et les réglages actuels par ceux du fichier ?")) return;
                  replaceAll({ ...d, counter: data.counter });
                  toast("Menu importé ✔");
                } catch (err) {
                  toast("Import impossible : " + err.message, true);
                }
              }}
            />
          </label>
          <button
            className="btn-ghost danger"
            onClick={() => {
              if (window.confirm("Remettre le menu d'origine ? Vos modifications du menu seront perdues (les réglages et commandes sont conservés).")) {
                update((d) => void (d.menu = defaultMenu()));
                toast("Menu d'origine restauré");
              }
            }}
          >
            <RotateCcw size={16} /> Menu d'origine
          </button>
        </div>
      </section>
    </div>
  );
}
