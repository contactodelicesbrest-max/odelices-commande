import { useState } from "react";
import { PhotoInput } from "./ui.jsx";
import { isOcrAvailable, readLabel } from "./labelReader.js";

// Photo d'étiquette + lecture automatique (nom, type, lot, DLC/DDM, quantité, conseil).
// onRead(result) reçoit le résultat ; à l'appelant de remplir les champs vides.
export default function LabelPhoto({ photoId, onChange, onRead, label = "Photo de l'étiquette", read = true }) {
  const [st, setSt] = useState(null);
  const onOcr = async (dataUrl) => {
    setSt({ busy: true });
    try {
      const r = await readLabel(dataUrl);
      onRead?.(r);
      setSt({ found: r.found });
    } catch (e) {
      setSt({ error: e.message });
    }
  };
  return (
    <>
      <PhotoInput photoId={photoId} onChange={onChange} label={label} onOcr={read && isOcrAvailable() ? onOcr : null} />
      {st?.busy && <div className="alert info">🔎 Lecture de l'étiquette…</div>}
      {st?.found && (
        <div className={"alert " + (st.found.length ? "ok" : "warn")}>
          {st.found.length
            ? `📷 Lu sur l'étiquette : ${st.found.join(", ")}. Vérifie avant d'enregistrer.`
            : "Rien de lisible trouvé : rapproche-toi de l'étiquette ou remplis à la main."}
        </div>
      )}
      {st?.error && <div className="alert warn">Lecture impossible : {st.error}</div>}
    </>
  );
}
