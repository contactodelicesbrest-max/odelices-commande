import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Home, Thermometer, ClipboardCheck, Droplets, Package, Settings, ArrowLeft, Cloud, CloudOff } from "lucide-react";
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
  { id: "temps", label: "Températures", icon: Thermometer, C: Temperatures },
  { id: "trace", label: "Traçabilité", icon: ClipboardCheck, C: Tracabilite },
  { id: "oil", label: "Huile", icon: Droplets, C: Huile },
  { id: "stock", label: "Stock", icon: Package, C: Stock },
];
const SETTINGS = { id: "settings", label: "Réglages", C: Reglages };

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
  const current = tab === "settings" ? SETTINGS : TABS.find((t) => t.id === tab);

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

  const go = (t, i = null) => {
    setIntent(i);
    setTab(t);
  };
  const C = current.C;

  return (
    <div className="app">
      <header className="topbar">
        {tab === "settings" ? (
          <button className="icon-btn light" onClick={() => setTab("home")} aria-label="Retour">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <span className="brand-dot" />
        )}
        <div className="topbar-title">
          <span>{current.id === "home" ? data.settings.shopName || "O'Délices" : current.label}</span>
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
