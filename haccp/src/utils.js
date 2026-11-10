import { Capacitor } from "@capacitor/core";

// ---------- Dates ----------
export const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const todayKey = () => dayKey(new Date());
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
export const fmtTime = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (d) => `${fmtDate(d)} ${fmtTime(d)}`;
export const fmtDayLong = (key) =>
  new Date(key + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// Nombre de jours entiers (calendaires) entre aujourd'hui et une date (négatif = passé).
export const daysUntil = (d) => {
  const a = new Date(todayKey() + "T00:00:00");
  const b = new Date(dayKey(d) + "T00:00:00");
  return Math.round((b - a) / 86400000);
};
export const daysSince = (d) => -daysUntil(d);
export const toLocalInput = (d) => {
  const x = new Date(d);
  return `${dayKey(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
export const momentOfDay = (d = new Date()) => (new Date(d).getHours() < 14 ? "Matin" : "Soir");

export const parseNum = (s) => {
  if (s === null || s === undefined) return NaN;
  const v = parseFloat(String(s).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(v) ? v : NaN;
};
export const fmtNum = (n, digits = 1) =>
  Number.isFinite(n) ? n.toLocaleString("fr-FR", { maximumFractionDigits: digits }) : "—";

// ---------- Photos : redimensionnement + compression JPEG ----------
export function compressImage(file, maxSize = 1024, quality = 0.66) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// ---------- Enregistrer / partager un fichier (PDF, sauvegarde) ----------
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function saveFile(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    // Ouvre le menu de partage Android : Drive, Gmail, WhatsApp, "Enregistrer dans Fichiers"...
    await Share.share({ title: filename, files: [res.uri], dialogTitle: "Enregistrer ou envoyer" });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareText(title, text) {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text, dialogTitle: title });
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch {
      /* annulé */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    alert("Liste copiée dans le presse-papiers.");
  } catch {
    alert(text);
  }
}
