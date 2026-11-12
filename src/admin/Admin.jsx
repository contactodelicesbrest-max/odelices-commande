import { useState } from "react";
import { ChefHat, ClipboardList, ListChecks, LogOut, Printer, Settings } from "lucide-react";
import { useStore } from "../lib/store.jsx";
import MenuTab from "./MenuTab.jsx";
import OptionsTab from "./OptionsTab.jsx";
import OrdersTab from "./OrdersTab.jsx";
import PrintersTab from "./PrintersTab.jsx";
import SettingsTab from "./SettingsTab.jsx";
import { Toast, useToast } from "./ui.jsx";

const TABS = [
  { id: "orders", label: "Commandes", icon: ClipboardList, C: OrdersTab },
  { id: "menu", label: "Menu", icon: ChefHat, C: MenuTab },
  { id: "options", label: "Options", icon: ListChecks, C: OptionsTab },
  { id: "printers", label: "Imprimantes", icon: Printer, C: PrintersTab },
  { id: "settings", label: "Réglages", icon: Settings, C: SettingsTab },
];

export default function Admin({ onExit }) {
  const { data } = useStore();
  const [tab, setTab] = useState("orders");
  const [msg, toast] = useToast();
  const T = TABS.find((t) => t.id === tab);
  return (
    <div className="admin">
      <aside className="a-side">
        <div className="a-brand">
          <img src="./logo.jpg" alt="" />
          <div>
            <strong>{data.settings.restaurantName}</strong>
            <span>Espace gérant</span>
          </div>
        </div>
        <nav>
          {TABS.map(({ id, label, icon: I }) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              <I size={20} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="a-exit" onClick={onExit}>
          <LogOut size={20} /> <span>Retour à la borne</span>
        </button>
      </aside>
      <main className="a-main">
        <h1 className="a-title">{T.label}</h1>
        <T.C toast={toast} />
      </main>
      <Toast msg={msg} />
    </div>
  );
}
