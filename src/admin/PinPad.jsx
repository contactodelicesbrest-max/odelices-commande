import { useEffect, useState } from "react";
import { Delete, Lock } from "lucide-react";

export default function PinPad({ pin, onOk, onCancel }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (v.length && v.length === pin.length) {
      if (v === pin) onOk();
      else {
        setErr(true);
        setTimeout(() => {
          setErr(false);
          setV("");
        }, 600);
      }
    }
  }, [v, pin, onOk]);
  // fermeture auto si on laisse le clavier ouvert
  useEffect(() => {
    const t = setTimeout(onCancel, 30000);
    return () => clearTimeout(t);
  }, [v, onCancel]);
  const press = (k) => setV((x) => (x.length < pin.length ? x + k : x));
  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className={`pinpad ${err ? "shake" : ""}`} onClick={(e) => e.stopPropagation()}>
        <Lock size={28} />
        <h2>Espace gérant</h2>
        <div className="pin-dots">
          {Array.from({ length: pin.length }).map((_, i) => (
            <span key={i} className={i < v.length ? "on" : ""} />
          ))}
        </div>
        <div className="pin-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
            <button key={k} onClick={() => press(k)}>{k}</button>
          ))}
          <button className="pin-cancel" onClick={onCancel}>Annuler</button>
          <button onClick={() => press("0")}>0</button>
          <button onClick={() => setV(v.slice(0, -1))} aria-label="Effacer"><Delete size={24} /></button>
        </div>
      </div>
    </div>
  );
}
