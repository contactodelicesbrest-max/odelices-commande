import { Thermometer, ClipboardCheck, Droplets, Package, AlertTriangle, CheckCircle2, Camera } from "lucide-react";
import { useData } from "./store.jsx";
import { dayKey, todayKey, momentOfDay, fmtNum, daysSince, fmtDate } from "./utils.js";
import { fryerStatus } from "./Huile.jsx";
import { effectiveDlc, dlcLabel } from "./Tracabilite.jsx";
import { isLow } from "./Stock.jsx";
import { daysUntil } from "./utils.js";

export default function Accueil({ go }) {
  const { data } = useData();
  const today = todayKey();
  const moment = momentOfDay();
  const tempsToday = data.temps.filter((t) => dayKey(t.at) === today);
  const eqs = [...data.equipments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const tasks = [];
  const alerts = [];

  for (const m of ["Matin", "Soir"]) {
    if (m === "Soir" && moment === "Matin") continue;
    const missing = eqs.filter((eq) => !tempsToday.some((t) => t.equipmentId === eq.id && t.moment === m));
    if (missing.length) tasks.push({ tab: "temps", icon: Thermometer, text: `Relevé du ${m.toLowerCase()} : ${missing.map((e) => e.name).join(", ")}` });
  }
  for (const t of tempsToday.filter((t) => !t.ok))
    alerts.push({ tab: "temps", icon: Thermometer, text: `${t.equipmentName} à ${fmtNum(t.value)} °C (${t.moment.toLowerCase()})${t.action ? ` — ${t.action}` : ""}` });

  for (const fr of data.fryers) {
    const st = fryerStatus(fr, data.oil, data.settings);
    for (const a of st.alerts) (a.tone === "ko" ? alerts : tasks).push({ tab: "oil", icon: Droplets, text: `${fr.name} : ${a.text}` });
  }

  for (const t of data.trace) {
    const d = effectiveDlc(t);
    if (t.status === "open" && d && daysUntil(d) <= 1)
      (daysUntil(d) < 0 ? alerts : tasks).push({ tab: "trace", icon: ClipboardCheck, text: `${t.product}${t.lot ? ` (lot ${t.lot})` : ""} : ${dlcLabel(d)}` });
  }

  const low = data.stock.filter(isLow);
  if (low.length) tasks.push({ tab: "stock", icon: Package, text: `${low.length} produit(s) en stock bas : ${low.map((s) => s.name).slice(0, 5).join(", ")}${low.length > 5 ? "…" : ""}` });
  for (const s of data.stock) if (s.dlc && (s.qty || 0) > 0 && daysUntil(s.dlc) < 0) alerts.push({ tab: "stock", icon: Package, text: `Stock : ${s.name} — DLC dépassée (${fmtDate(s.dlc)})` });

  if (!data.settings.lastBackup ? data.temps.length + data.trace.length > 20 : daysSince(data.settings.lastBackup) >= 7)
    tasks.push({ tab: "settings", icon: AlertTriangle, text: "Pense à faire une sauvegarde des données (Réglages)" });

  const traceToday = data.trace.filter((t) => dayKey(t.at) === today).length;

  return (
    <div className="page">
      <div className="today">
        <div className="today-date">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <div className="today-hello">Bonjour{data.settings.operator ? ` ${data.settings.operator}` : ""} 👋</div>
      </div>

      <div className="quick">
        <button className="quick-btn q-temp" onClick={() => go("temps", "new")}>
          <Thermometer size={28} />
          <span>Relever les T°</span>
        </button>
        <button className="quick-btn q-trace" onClick={() => go("trace", "new")}>
          <Camera size={28} />
          <span>Produit sorti</span>
        </button>
        <button className="quick-btn q-oil" onClick={() => go("oil")}>
          <Droplets size={28} />
          <span>Huile</span>
        </button>
        <button className="quick-btn q-stock" onClick={() => go("stock")}>
          <Package size={28} />
          <span>Stock</span>
        </button>
      </div>

      <div className="stats">
        <div className="stat"><b>{tempsToday.length}</b><span>relevés T° aujourd'hui</span></div>
        <div className="stat"><b>{traceToday}</b><span>produits tracés aujourd'hui</span></div>
      </div>

      {alerts.length > 0 && (
        <>
          <h3 className="section-title ko-text">Non-conformités</h3>
          <div className="card list">
            {alerts.map((a, i) => (
              <button key={i} className="list-row alert-row ko" onClick={() => go(a.tab)}>
                <a.icon size={20} />
                <span className="list-main">{a.text}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">À faire</h3>
      <div className="card list">
        {tasks.length === 0 && (
          <div className="list-row ok-text">
            <CheckCircle2 size={20} /> <span className="list-main">Tout est à jour 👍</span>
          </div>
        )}
        {tasks.map((a, i) => (
          <button key={i} className="list-row alert-row warn" onClick={() => go(a.tab)}>
            <a.icon size={20} />
            <span className="list-main">{a.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
