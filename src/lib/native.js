// Pont vers le code Android natif (imprimante Bluetooth / réseau, mode borne).
import { Capacitor, registerPlugin } from "@capacitor/core";
import { encodeEscPos, toBase64 } from "./tickets.js";

export const isNative = Capacitor.isNativePlatform();
const Printer = registerPlugin("ThermalPrinter");
const Kiosk = registerPlugin("Kiosk");

export async function listBluetoothPrinters() {
  if (!isNative) return [];
  const r = await Printer.listPaired();
  return r.devices || [];
}

// Envoie un ticket à une imprimante. cfg = réglages de l'imprimante.
export async function printSegments(segs, cfg, copies = 1) {
  if (!cfg || cfg.type === "none") return { ok: false, error: "Aucune imprimante configurée" };
  if (!isNative) return { ok: false, error: "Impression disponible uniquement dans l'application Android" };
  const one = encodeEscPos(segs, cfg);
  const n = Math.max(1, Number(copies) || 1);
  const all = new Uint8Array(one.length * n);
  for (let i = 0; i < n; i++) all.set(one, i * one.length);
  const data = toBase64(all);
  try {
    if (cfg.type === "bluetooth") {
      if (!cfg.address) return { ok: false, error: "Choisissez une imprimante Bluetooth" };
      await Printer.printBluetooth({ address: cfg.address, data });
    } else if (cfg.type === "network") {
      if (!cfg.host) return { ok: false, error: "Indiquez l'adresse IP de l'imprimante" };
      await Printer.printNetwork({ host: cfg.host, port: Number(cfg.port) || 9100, data });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function setKiosk(on) {
  if (!isNative) return false;
  try {
    await (on ? Kiosk.start() : Kiosk.stop());
    return true;
  } catch {
    return false;
  }
}

export async function isKioskActive() {
  if (!isNative) return false;
  try {
    return (await Kiosk.isActive()).active;
  } catch {
    return false;
  }
}

// Enregistre un fichier et ouvre le menu de partage Android (mail, Drive, WhatsApp...)
export async function shareFile(filename, base64, mime) {
  if (!isNative) {
    const a = document.createElement("a");
    a.href = `data:${mime};base64,${base64}`;
    a.download = filename;
    a.click();
    return;
  }
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const res = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ title: filename, url: res.uri, dialogTitle: "Envoyer le fichier" });
}

export function textToBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}
