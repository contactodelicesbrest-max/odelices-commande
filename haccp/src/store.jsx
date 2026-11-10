import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as db from "./db.js";

const DATA_STORES = db.STORES.filter((s) => s !== "photos" && s !== "settings");
const Ctx = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);

  const reload = useCallback(async () => {
    await db.seedIfEmpty();
    const next = {};
    for (const s of DATA_STORES) next[s] = await db.getAll(s);
    next.settings = (await db.getOne("settings", "main")) || { id: "main" };
    setData(next);
  }, []);

  useEffect(() => {
    reload().catch((e) => {
      console.error(e);
      alert("Erreur d'ouverture de la base de données : " + e.message);
    });
  }, [reload]);

  const save = useCallback(async (store, obj) => {
    const o = { ...obj, id: obj.id || db.uid(), updatedAt: new Date().toISOString() };
    if (!o.createdAt) o.createdAt = o.updatedAt;
    await db.put(store, o);
    setData((d) => {
      if (store === "settings") return { ...d, settings: o };
      const list = d[store].filter((x) => x.id !== o.id);
      return { ...d, [store]: [...list, o] };
    });
    return o;
  }, []);

  const saveMany = useCallback(async (store, objs) => {
    const now = new Date().toISOString();
    const list = objs.map((obj) => ({ ...obj, id: obj.id || db.uid(), createdAt: obj.createdAt || now, updatedAt: now }));
    await db.putMany(store, list);
    const ids = new Set(list.map((o) => o.id));
    setData((d) => ({ ...d, [store]: [...d[store].filter((x) => !ids.has(x.id)), ...list] }));
    return list;
  }, []);

  const remove = useCallback(async (store, id) => {
    await db.del(store, id);
    setData((d) => ({ ...d, [store]: d[store].filter((x) => x.id !== id) }));
  }, []);

  const savePhoto = useCallback(async (dataUrl) => {
    const p = { id: db.uid(), dataUrl, createdAt: new Date().toISOString() };
    await db.put("photos", p);
    return p.id;
  }, []);

  const updateSettings = useCallback(
    (patch) => save("settings", { ...(data?.settings || {}), ...patch, id: "main" }),
    [data, save]
  );

  if (!data) return <div className="loading">Chargement…</div>;
  return (
    <Ctx.Provider value={{ data, save, saveMany, remove, savePhoto, reload, updateSettings }}>{children}</Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);

const photoCache = new Map();
export async function loadPhoto(id) {
  if (!id) return null;
  if (photoCache.has(id)) return photoCache.get(id);
  const p = await db.getOne("photos", id);
  const url = p ? p.dataUrl : null;
  if (url) photoCache.set(id, url);
  return url;
}
