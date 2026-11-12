// Stockage local sur la tablette (pas besoin d'internet).
// Sur l'APK : Capacitor Preferences (stockage natif Android). Dans un navigateur : localStorage.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { defaultData, DEFAULT_SETTINGS, migrateMenu, migrateMenuV3 } from "./defaultData.js";

const DATA_KEY = "odelices.data.v1";
const ORDERS_KEY = "odelices.orders.v1";
const KEEP_DAYS = 120;

const native = Capacitor.isNativePlatform();

async function readKey(key) {
  try {
    if (native) return (await Preferences.get({ key })).value;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
async function writeKey(key, value) {
  try {
    if (native) await Preferences.set({ key, value });
    else localStorage.setItem(key, value);
  } catch (e) {
    console.error("Écriture impossible", e);
  }
}

// Fusion profonde des réglages pour que les nouvelles options aient une valeur par défaut
function mergeDefaults(def, val) {
  if (Array.isArray(def) || typeof def !== "object" || def === null) return val === undefined ? def : val;
  const out = { ...def };
  for (const k of Object.keys(val || {})) out[k] = k in def ? mergeDefaults(def[k], val[k]) : val[k];
  return out;
}

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const saveTimer = useRef(null);
  const latest = useRef(null);

  useEffect(() => {
    (async () => {
      const raw = await readKey(DATA_KEY);
      let d = defaultData();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          d = { ...d, ...parsed, menuVersion: parsed.menuVersion || 1, settings: mergeDefaults(DEFAULT_SETTINGS, parsed.settings) };
        } catch {}
        if (d.menuVersion < 3) {
          if (d.menuVersion < 2) migrateMenu(d.menu);
          migrateMenuV3(d.menu);
          // imprimante jamais configurée → réglages Sunmi NT311 (Bluetooth 80 mm)
          const k = d.settings.printers.kitchen;
          if (k.type === "none" && !k.address && !k.host) Object.assign(k, { type: "bluetooth", width: 48 });
          d.menuVersion = 3;
          writeKey(DATA_KEY, JSON.stringify(d));
        }
      }
      const rawOrders = await readKey(ORDERS_KEY);
      let o = [];
      try {
        o = rawOrders ? JSON.parse(rawOrders) : [];
      } catch {}
      const limit = Date.now() - KEEP_DAYS * 86400000;
      o = o.filter((x) => x.createdAt > limit);
      latest.current = d;
      setData(d);
      setOrders(o);
    })();
  }, []);

  const persist = useCallback((d) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => writeKey(DATA_KEY, JSON.stringify(d)), 250);
  }, []);

  // update(draft => { ...mutations... })
  const update = useCallback(
    (fn) => {
      const next = structuredClone(latest.current);
      const ret = fn(next);
      const d = ret || next;
      latest.current = d;
      setData(d);
      persist(d);
      return d;
    },
    [persist]
  );

  const replaceAll = useCallback(
    (d) => {
      const merged = { ...defaultData(), ...d, menuVersion: 3, settings: mergeDefaults(DEFAULT_SETTINGS, d.settings) };
      if ((d.menuVersion || 1) < 2) migrateMenu(merged.menu);
      if ((d.menuVersion || 1) < 3) migrateMenuV3(merged.menu);
      latest.current = merged;
      setData(merged);
      writeKey(DATA_KEY, JSON.stringify(merged));
    },
    []
  );

  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const saveOrders = useCallback((list) => {
    ordersRef.current = list;
    setOrders(list);
    writeKey(ORDERS_KEY, JSON.stringify(list));
  }, []);

  // Numéro de commande : repart à 1 chaque jour
  const nextTicketNumber = useCallback(() => {
    let n = 1;
    update((d) => {
      const today = dayKey();
      if (d.counter.day !== today) d.counter = { day: today, n: 0 };
      d.counter.n += 1;
      n = d.counter.n;
    });
    return n;
  }, [update]);

  const addOrder = useCallback((order) => saveOrders([...ordersRef.current, order]), [saveOrders]);
  const patchOrder = useCallback(
    (id, patch) => saveOrders(ordersRef.current.map((o) => (o.id === id ? { ...o, ...patch } : o))),
    [saveOrders]
  );

  if (!data) return <div className="boot">Chargement…</div>;
  return (
    <StoreCtx.Provider value={{ data, update, replaceAll, orders, addOrder, patchOrder, nextTicketNumber }}>
      {children}
    </StoreCtx.Provider>
  );
}

export const useStore = () => useContext(StoreCtx);
