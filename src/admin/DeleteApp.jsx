import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { wipeAndUninstall } from "../lib/native.js";

// Ouvre la suppression depuis n'importe où (ex. bouton de l'onglet Réglages)
export const openDeleteApp = () => window.dispatchEvent(new Event("odelices:delete-app"));

/**
 * Bouton rouge « Supprimer l'appli », visible sur tous les écrans.
 * Un appui efface toutes les données puis ouvre la désinstallation Android.
 */
export default function DeleteApp({ inAdmin }) {
  const [wiping, setWiping] = useState(false);

  const run = async () => {
    if (wiping) return;
    setWiping(true);
    try {
      await wipeAndUninstall();
    } catch {
      setTimeout(() => window.location.reload(), 1500);
    }
  };
  useEffect(() => {
    window.addEventListener("odelices:delete-app", run);
    return () => window.removeEventListener("odelices:delete-app", run);
  });

  return (
    <button className={`delete-fab ${inAdmin ? "in-admin" : ""}`} onClick={run} disabled={wiping} aria-label="Supprimer l'application">
      <Trash2 size={18} /> <span>{wiping ? "Suppression…" : "Supprimer l'appli"}</span>
    </button>
  );
}
