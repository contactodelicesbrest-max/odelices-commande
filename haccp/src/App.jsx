import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Home, Thermometer, ClipboardCheck, Droplets, Package, Settings, ArrowLeft, Cloud, CloudOff, Sparkles } from "lucide-react";
import Nettoyage from "./Nettoyage.jsx";
import Memo from "./Memo.jsx";
import Registres from "./Registres.jsx";
import Allergenes from "./Allergenes.jsx";
import { askPermission, onReminderTap, scheduleRemindersSoon } from "./reminders.js";
import { finishAutoCooling } from "./Process.jsx";
import { onCloudStatus } from "./cloud.js";
import { DataProvider, useData } from "./store.jsx";
import Accueil from "./Accueil.jsx";
import Temperatures from "./Temperatures.jsx";
import Tracabilite from "./Tracabilite.jsx";
import Huile from "./Huile.jsx";
import Stock from "./Stock.jsx";
import Reglages from "./Reglages.jsx";

const TABS = [
  { id: "home", label: "Accueil", icon: Home, C: Accueil },
  { id: "temps", label: "Temp.", title: "Températures", icon: Thermometer, C: Temperatures },
  { id: "trace", label: "Traça.", title: "Traçabilité", icon: ClipboardCheck, C: Tracabilite },
  { id: "oil", label: "Huile", icon: Droplets, C: Huile },
  { id: "clean", label: "Nettoyage", icon: Sparkles, C: Nettoyage },
  { id: "stock", label: "Stock", icon: Package, C: Stock },
];
const EXTRA = {
  settings: { id: "settings", label: "Réglages", C: Reglages },
  memo: { id: "memo", label: "Mémo HACCP", C: Memo },
  registers: { id: "registers", label: "Registres & dossier contrôle", C: Registres },
  allergens: { id: "allergens", label: "Allergènes", C: Allergenes },
};

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { data } = useData();
  const [tab, setTab] = useState("home");
  const [intent, setIntent] = useState(null);
  const [cloud, setCloud] = useState(null);
  useEffect(() => onCloudStatus(setCloud), []);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const current = EXTRA[tab] || TABS.find((t) => t.id === tab);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  // Bouton "retour" Android : revient à l'accueil plutôt que de quitter l'appli.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener("backButton", () => {
      // Une fenêtre ouverte ? on la ferme d'abord (clic sur le fond).
      const backdrop = document.querySelector(".lightbox, .sheet-backdrop");
      if (backdrop) return backdrop.click();
      if (tabRef.current === "home") CapApp.exitApp();
      else setTab("home");
    });
    return () => {
      sub.then((h) => h.remove());
    };
  }, []);

  // Rappels : demande d'autorisation au premier lancement, puis replanification à chaque changement
  useEffect(() => {
    askPermission().catch(() => {});
    let off = () => {};
    onReminderTap((t) => t && setTab(t)).then((f) => (off = f));
    return () => off();
  }, []);
  useEffect(() => {
    scheduleRemindersSoon(data);
  }, [data]);
  // Refroidissements automatiques : vérifiés à l'ouverture et toutes les minutes
  const { save } = useData();
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    const run = () => finishAutoCooling(dataRef.current, save).catch((e) => console.warn(e));
    run();
    const t = setInterval(run, 60000);
    const onVis = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [save]);

  const go = (t, i = null) => {
    setIntent(i);
    setTab(t);
  };
  const C = current.C;

  return (
    <div className="app">
      <header className="topbar">
        {EXTRA[tab] ? (
          <button className="icon-btn light" onClick={() => setTab("home")} aria-label="Retour">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <span className="brand-dot" />
        )}
        <div className="topbar-title">
          <span>{current.id === "home" ? data.settings.shopName || "O'Délices" : current.title || current.label}</span>
          <small>HACCP</small>
        </div>
        {cloud && (
          <button className={"icon-btn cloud-" + cloud.state} onClick={() => setTab("settings")} aria-label="Sauvegarde">
            {cloud.state === "error" || cloud.state === "offline" ? <CloudOff size={20} /> : <Cloud size={20} />}
          </button>
        )}
        <button className="icon-btn light" onClick={() => setTab("settings")} aria-label="Réglages">
          <Settings size={22} />
        </button>
      </header>
      <main>
        <C go={go} intent={intent} clearIntent={() => setIntent(null)} key={tab} />
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={"tab" + (tab === t.id ? " active" : "")} onClick={() => go(t.id)}>
            <t.icon size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
