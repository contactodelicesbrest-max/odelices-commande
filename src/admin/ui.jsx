import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { previewLines } from "../lib/tickets.js";

export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Text({ value, onChange, ...rest }) {
  return <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

// Saisie de prix / nombre acceptant la virgule
export function Num({ value, onChange, decimals = 2, ...rest }) {
  const fmt = (v) => (v === "" || v == null ? "" : String(v).replace(".", ","));
  const [txt, setTxt] = useState(fmt(value));
  useEffect(() => {
    const parsed = parseFloat(String(txt).replace(",", "."));
    if ((isNaN(parsed) ? 0 : parsed) !== Number(value || 0)) setTxt(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className="input input-num"
      inputMode="decimal"
      value={txt}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, "");
        setTxt(t);
        const n = parseFloat(t.replace(",", "."));
        onChange(isNaN(n) ? 0 : decimals === 0 ? Math.round(n) : n);
      }}
      onFocus={(e) => e.target.select()}
      {...rest}
    />
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </button>
  );
}

export function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={String(o.value)} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MoveButtons({ onUp, onDown, disableUp, disableDown }) {
  return (
    <span className="move">
      <button type="button" className="icon-btn" onClick={onUp} disabled={disableUp} aria-label="Monter">
        <ArrowUp size={16} />
      </button>
      <button type="button" className="icon-btn" onClick={onDown} disabled={disableDown} aria-label="Descendre">
        <ArrowDown size={16} />
      </button>
    </span>
  );
}

export function move(arr, i, j) {
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  const [x] = a.splice(i, 1);
  a.splice(j, 0, x);
  return a;
}

export function TicketPreview({ segs, width = 32 }) {
  return (
    <div className="ticket-preview" style={{ "--cols": width }}>
      {previewLines(segs, width).map((l, i) => (
        <div key={i} className={`tp-line ${l.bold ? "b" : ""} tp-s${l.size}`}>
          {l.text || " "}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="a-modal-backdrop" onClick={onClose}>
      <div className={`a-modal ${wide ? "wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="a-modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="a-modal-body">{children}</div>
        {footer && <div className="a-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Redimensionne une photo pour ne pas surcharger la mémoire de la tablette
export function readImage(file, maxSize = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function Toast({ msg }) {
  if (!msg) return null;
  return <div className={`toast ${msg.err ? "err" : ""}`}>{msg.text}</div>;
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  const show = (text, err = false) => {
    setMsg({ text, err });
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 3200);
  };
  return [msg, show];
}
