import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, X, Trash2 } from "lucide-react";
import { compressImage } from "./utils.js";
import { loadPhoto, useData } from "./store.jsx";

export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={22} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const l = typeof o === "object" ? o.label : o;
        return (
          <button
            type="button"
            key={String(v)}
            className={"chip" + (value === v ? " active" : "")}
            onClick={() => onChange(value === v ? null : v)}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}

export function Empty({ icon: Icon, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={36} />}
      <p>{children}</p>
    </div>
  );
}

// Saisie de température avec bouton de signe (le clavier numérique Android
// n'a pas toujours la touche "moins").
export function TempInput({ value, onChange, negativeDefault, autoFocus }) {
  const raw = value ?? "";
  const neg = raw.startsWith("-") || (raw === "" && negativeDefault);
  const abs = raw.replace(/^[-+]/, "");
  const [sign, setSign] = useState(neg ? "-" : "+");
  useEffect(() => {
    if (raw.startsWith("-")) setSign("-");
  }, [raw]);
  const emit = (s, a) => onChange(a === "" ? "" : (s === "-" ? "-" : "") + a);
  return (
    <div className="temp-input">
      <button
        type="button"
        className={"sign " + (sign === "-" ? "neg" : "pos")}
        onClick={() => {
          const s = sign === "-" ? "+" : "-";
          setSign(s);
          emit(s, abs);
        }}
      >
        {sign === "-" ? "−" : "+"}
      </button>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0,0"
        value={abs}
        onChange={(e) => emit(sign, e.target.value.replace(/[^0-9.,]/g, ""))}
      />
      <span className="unit">°C</span>
    </div>
  );
}

export function PhotoInput({ photoId, onChange, label = "Photo de l'étiquette", onOcr }) {
  const { savePhoto } = useData();
  const camRef = useRef();
  const galRef = useRef();
  const [busy, setBusy] = useState(false);
  const handle = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(f);
      const id = await savePhoto(dataUrl);
      onChange(id);
      // Lecture automatique de l'étiquette : image plus grande pour lire les petits caractères
      if (onOcr) onOcr(await compressImage(f, 2000, 0.9));
    } catch (err) {
      alert("Impossible de lire la photo : " + err?.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="photo-input">
      <span className="field-label">{label}</span>
      {photoId ? (
        <div className="photo-preview">
          <PhotoThumb id={photoId} large />
          <button type="button" className="btn btn-ghost danger" onClick={() => onChange(null)}>
            <Trash2 size={18} /> Retirer
          </button>
        </div>
      ) : (
        <div className="row gap">
          <button type="button" className="btn btn-photo" disabled={busy} onClick={() => camRef.current.click()}>
            <Camera size={22} /> {busy ? "Traitement…" : "Prendre une photo"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => galRef.current.click()}>
            <ImageIcon size={20} /> Galerie
          </button>
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={handle} />
    </div>
  );
}

export function PhotoThumb({ id, large }) {
  const [url, setUrl] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    loadPhoto(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!id) return null;
  return (
    <>
      <button
        type="button"
        className={"thumb" + (large ? " thumb-lg" : "")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {url ? <img src={url} alt="" /> : <span className="thumb-ph" />}
      </button>
      {open && url && (
        <div className="lightbox" onClick={() => setOpen(false)}>
          <img src={url} alt="" />
          <button className="icon-btn lightbox-close" aria-label="Fermer">
            <X size={28} />
          </button>
        </div>
      )}
    </>
  );
}

export function confirmAction(msg) {
  return window.confirm(msg);
}
