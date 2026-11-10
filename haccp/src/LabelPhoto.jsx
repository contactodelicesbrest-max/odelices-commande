import { useState } from "react";
import { PhotoInput, Chips } from "./ui.jsx";
import { isOcrAvailable, readLabel } from "./labelReader.js";

// Photo d'étiquette + lecture automatique (nom, type, lot, DLC/DDM, quantité, conseil).
// onRead(result) reçoit le résultat ; onPick(champ, texte) permet de choisir une ligne lue
// à la main si la lecture automatique s'est trompée (ex : numéro de lot).
export default function LabelPhoto({ photoId, onChange, onRead, onPick, label = "Photo de l'étiquette", read = true, pickFields = ["lot", "product"] }) {
  const [st, setSt] = useState(null);
  const [lines, setLines] = useState([]);
  const [target, setTarget] = useState(pickFields[0]);
  const onOcr = async (dataUrl) => {
    setSt({ busy: true });
    try {
      const r = await readLabel(dataUrl);
      onRead?.(r);
      setLines(r.lines || []);
      setSt({ found: r.found });
    } catch (e) {
      setSt({ error: e.message });
    }
  };
  const labels = { lot: "N° de lot", product: "Nom" };
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
      {onPick && lines.length > 0 && (
        <details className="ocr-lines">
          <summary>Texte lu sur l'étiquette — touche une ligne pour la mettre dans un champ</summary>
          <Chips options={pickFields.map((f) => ({ value: f, label: labels[f] || f }))} value={target} onChange={(v) => v && setTarget(v)} />
          <div className="ocr-list">
            {lines.map((l, i) => (
              <button type="button" key={i} className="ocr-line" onClick={() => onPick(target, l.replace(/^(n°\s*(de\s*)?)?(lot|l0t|1ot)\s*(n°)?\s*[:.]?\s*/i, ""))}>
                {l}
              </button>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
