import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { wipeAndUninstall } from "../lib/native.js";
import PinPad from "./PinPad.jsx";
import { Field, Modal, Text } from "./ui.jsx";

// Ouvre la suppression depuis n'importe où (ex. bouton de l'onglet Réglages)
export const openDeleteApp = () => window.dispatchEvent(new Event("odelices:delete-app"));

/**
 * Bouton rouge « Supprimer l'appli », visible sur tous les écrans.
 * Sur les écrans clients, le code PIN gérant est demandé d'abord,
 * puis il faut taper SUPPRIMER pour confirmer.
 */
export default function DeleteApp({ pin, needPin, inAdmin }) {
  const [step, setStep] = useState(null); // null | "pin" | "confirm"
  const [text, setText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [error, setError] = useState("");

  const open = () => {
    setText("");
    setError("");
    setStep(needPin ? "pin" : "confirm");
  };
  useEffect(() => {
    window.addEventListener("odelices:delete-app", open);
    return () => window.removeEventListener("odelices:delete-app", open);
  });

  return (
    <>
      <button className={`delete-fab ${inAdmin ? "in-admin" : ""}`} onClick={open} aria-label="Supprimer l'application">
        <Trash2 size={18} /> <span>Supprimer l'appli</span>
      </button>

      {step === "pin" && <PinPad pin={pin} onOk={() => setStep("confirm")} onCancel={() => setStep(null)} />}

      {step === "confirm" && (
        <Modal
          title="Supprimer définitivement ?"
          onClose={() => !wiping && setStep(null)}
          footer={
            <>
              <span className="spacer" />
              <button className="btn-ghost" disabled={wiping} onClick={() => setStep(null)}>
                Annuler
              </button>
              <button
                className="btn-primary btn-danger"
                disabled={text.trim().toUpperCase() !== "SUPPRIMER" || wiping}
                onClick={async () => {
                  setWiping(true);
                  try {
                    await wipeAndUninstall();
                  } catch (e) {
                    setError(e?.message || String(e));
                    setTimeout(() => window.location.reload(), 4000);
                  }
                }}
              >
                <Trash2 size={16} /> {wiping ? "Suppression…" : "Tout supprimer"}
              </button>
            </>
          }
        >
          <p>Toutes les données de la borne vont être effacées : menu, prix, photos, réglages, imprimantes, commandes et chiffre d'affaires. Elles ne pourront pas être récupérées.</p>
          <p>
            Android vous demandera ensuite de <b>confirmer la désinstallation</b>. Si vous annulez à ce moment-là, l'application restera installée mais repartira de zéro (menu d'origine,
            code PIN 1234).
          </p>
          <Field label="Pour confirmer, tapez SUPPRIMER">
            <Text value={text} onChange={setText} autoFocus autoComplete="off" placeholder="SUPPRIMER" />
          </Field>
          {error && <p className="od-err">{error}</p>}
        </Modal>
      )}
    </>
  );
}
