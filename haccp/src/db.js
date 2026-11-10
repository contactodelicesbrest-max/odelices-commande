// Stockage local (IndexedDB) : les données restent sur le téléphone/tablette,
// fonctionnent sans connexion internet, et peuvent être sauvegardées en JSON.

const DB_NAME = "odelices-haccp";
const DB_VERSION = 2;
export const STORES = [
  "equipments", "temps", "trace", "fryers", "oil", "stock", "moves", "photos", "settings",
  "process", "receptions", "cleanTasks", "cleanLogs",
];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const os = t.objectStore(store);
        let result;
        const r = fn(os);
        if (r) r.onsuccess = () => (result = r.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const getAll = (store) => tx(store, "readonly", (os) => os.getAll()).then((r) => r || []);
export const getOne = (store, id) => tx(store, "readonly", (os) => os.get(id));
export const put = (store, obj) => tx(store, "readwrite", (os) => os.put(obj)).then(() => obj);
export const del = (store, id) => tx(store, "readwrite", (os) => os.delete(id));
export const clearStore = (store) => tx(store, "readwrite", (os) => os.clear());

export function putMany(store, list) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        const os = t.objectStore(store);
        for (const o of list) os.put(o);
        t.oncomplete = () => resolve(list);
        t.onerror = () => reject(t.error);
      })
  );
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------- Sauvegarde / restauration ----------
export async function exportAll() {
  const out = { app: "odelices-haccp", version: 1, exportedAt: new Date().toISOString(), data: {} };
  for (const s of STORES) out.data[s] = await getAll(s);
  return out;
}

export async function importAll(json, { replace = true } = {}) {
  if (!json || json.app !== "odelices-haccp" || !json.data) throw new Error("Fichier de sauvegarde invalide.");
  for (const s of STORES) {
    const list = json.data[s];
    if (!Array.isArray(list)) continue;
    if (replace) await clearStore(s);
    await putMany(s, list);
  }
}

// ---------- Données de départ ----------
// Températures maximales de conservation : arrêté du 21 décembre 2009 (annexe I)
// et Guide de bonnes pratiques d'hygiène (GBPH) de la restauration.
export const EQUIP_TYPES = {
  frigo: {
    label: "Réfrigérateur produits frais",
    min: 0, max: 4,
    rule: "Denrées très périssables (produits laitiers, volailles, crudités, sauces…) : +4 °C maximum.",
  },
  prepa: {
    label: "Préparations cuisinées à l'avance",
    min: 0, max: 3,
    rule: "Préparations culinaires élaborées à l'avance : +3 °C maximum (arrêté du 21/12/2009).",
  },
  hache: {
    label: "Viande hachée / poisson frais",
    min: 0, max: 2,
    rule: "Viandes hachées : +2 °C ; produits de la pêche frais : 0 à +2 °C (glace fondante).",
  },
  chambre: { label: "Chambre froide positive", min: 0, max: 3, rule: "Chambre froide positive : 0 à +3 °C conseillé (+4 °C maximum pour les produits frais)." },
  vitrine: { label: "Vitrine / saladette réfrigérée", min: 0, max: 4, rule: "Produits exposés réfrigérés : +4 °C maximum." },
  saladette: { label: "Saladette / tour réfrigéré", min: 0, max: 4, rule: "Produits exposés réfrigérés : +4 °C maximum." },
  boissons: { label: "Frigo boissons (sans denrées)", min: 0, max: 8, rule: "Boissons uniquement : pas d'exigence réglementaire, +8 °C conseillé." },
  congel: {
    label: "Congélateur / surgelés",
    min: -30, max: -18,
    rule: "Surgelés et glaces : -18 °C ou moins. Une remontée brève jusqu'à -15 °C est tolérée (dégivrage, chargement).",
    tolerance: -15,
  },
  chaud: {
    label: "Maintien au chaud (bain-marie, vitrine chaude)",
    min: 63, max: 100,
    hot: true,
    rule: "Plats servis chauds : +63 °C minimum à cœur jusqu'au service.",
  },
};

// Actions correctives proposées selon le type d'équipement et l'écart constaté.
export function correctiveActions(eq, value) {
  const t = EQUIP_TYPES[eq?.type] || {};
  if (t.hot)
    return [
      "Produits réchauffés à +63 °C en moins d'1 h",
      "Produits jetés (plus de 2 h sous +63 °C)",
      "Réglage de l'appareil",
      "Technicien appelé",
    ];
  if (eq?.type === "congel")
    return value <= (t.tolerance ?? -15)
      ? ["Dégivrage / chargement en cours — recontrôle prévu", "Porte mal fermée — refermée", "Réglage du thermostat"]
      : [
          "Produits décongelés : transférés au frigo et à consommer sous 24 h",
          "Produits transférés dans un autre congélateur",
          "Produits jetés",
          "Technicien appelé",
        ];
  return [
    "Porte mal fermée — refermée, recontrôle prévu",
    "Réglage du thermostat, recontrôle prévu",
    "Produits transférés dans un autre frigo",
    "Produits jetés (température trop élevée trop longtemps)",
    "Technicien appelé",
  ];
}

// "warn" = écart toléré (congélateur entre -18 et -15 °C).
export function tempStatus(eq, v) {
  if (!Number.isFinite(v)) return null;
  if (v >= eq.min && v <= eq.max) return "ok";
  const t = EQUIP_TYPES[eq.type];
  if (t?.tolerance !== undefined && v > eq.max && v <= t.tolerance) return "warn";
  return "ko";
}

let seedPromise = null;
export function seedIfEmpty() {
  if (!seedPromise) seedPromise = doSeed();
  return seedPromise;
}

async function doSeed() {
  // Plan de nettoyage par défaut : créé une seule fois (même pour une appli déjà installée).
  if (!(await getOne("settings", "seed-clean"))) {
    const now = new Date().toISOString();
    if (!(await getAll("cleanTasks")).length)
      await putMany("cleanTasks", DEFAULT_CLEAN_TASKS.map((t, i) => ({ id: uid(), ...t, order: i, createdAt: now, updatedAt: now })));
    await put("settings", { id: "seed-clean", createdAt: now, updatedAt: now });
  }
  // Planning hotte (ajouté pour les applis déjà installées)
  if (!(await getOne("settings", "seed-hood"))) {
    const now = new Date().toISOString();
    const tasks = await getAll("cleanTasks");
    const old = tasks.find((t) => /hotte/i.test(t.name));
    if (old) await put("cleanTasks", { ...old, name: "Hotte : filtres", hood: true, updatedAt: now });
    else await put("cleanTasks", { id: uid(), name: "Hotte : filtres", freq: "monthly", product: "Dégraissant (trempage ou lave-vaisselle)", hood: true, order: 99, createdAt: now, updatedAt: now });
    if (!tasks.some((t) => /conduit/i.test(t.name)))
      await put("cleanTasks", { id: uid(), name: "Hotte + conduit : nettoyage complet (société)", freq: "yearly", product: "Société spécialisée — garder l'attestation", hood: true, order: 100, createdAt: now, updatedAt: now });
    await put("settings", { id: "seed-hood", createdAt: now, updatedAt: now });
  }
  const eq = await getAll("equipments");
  const settings = await getOne("settings", "main");
  if (!settings) {
    await put("settings", {
      id: "main",
      shopName: "O'Délices",
      operator: "",
      oilMaxDays: 7,
      oilTpmMax: 25,
      seeded: true,
    });
    if (eq.length === 0) {
      const now = new Date().toISOString();
      await putMany("equipments", [
        { id: uid(), name: "Frigo 1", type: "frigo", min: 0, max: 4, order: 1, createdAt: now },
        { id: uid(), name: "Frigo 2", type: "frigo", min: 0, max: 4, order: 2, createdAt: now },
        { id: uid(), name: "Congélateur 1", type: "congel", min: -30, max: -18, order: 3, createdAt: now },
      ]);
      await putMany("fryers", [{ id: uid(), name: "Friteuse 1", capacity: 10, order: 1, createdAt: now }]);
    }
  }
}

// Plan de nettoyage et de désinfection de départ (modifiable dans l'onglet Nettoyage).
export const CLEAN_FREQ = {
  service: { label: "Après chaque service", days: 0.5 },
  daily: { label: "Tous les jours", days: 1 },
  weekly: { label: "Toutes les semaines", days: 7 },
  monthly: { label: "Tous les mois", days: 30 },
  quarterly: { label: "Tous les 3 mois", days: 91 },
  biannual: { label: "Tous les 6 mois", days: 182 },
  yearly: { label: "Tous les ans", days: 365 },
};
export const DEFAULT_CLEAN_TASKS = [
  { name: "Plans de travail et planches", freq: "service", product: "Dégraissant + désinfectant alimentaire" },
  { name: "Broche kebab, trancheuse, couteaux", freq: "service", product: "Dégraissant + désinfectant alimentaire" },
  { name: "Plaque / grill / plancha", freq: "daily", product: "Dégraissant" },
  { name: "Sols cuisine", freq: "daily", product: "Détergent désinfectant sols" },
  { name: "Poubelles et zone déchets", freq: "daily", product: "Désinfectant" },
  { name: "Lave-mains, savon, essuie-mains", freq: "daily", product: "Désinfectant" },
  { name: "Poignées de portes et de frigos", freq: "daily", product: "Désinfectant" },
  { name: "Saladette / vitrine réfrigérée", freq: "daily", product: "Désinfectant alimentaire" },
  { name: "Intérieur des frigos", freq: "weekly", product: "Désinfectant alimentaire" },
  { name: "Friteuses (cuve) — à chaque vidange", freq: "weekly", product: "Dégraissant friteuse" },
  { name: "Murs et carrelage cuisine", freq: "weekly", product: "Dégraissant" },
  { name: "Hotte : filtres", freq: "monthly", product: "Dégraissant (trempage ou lave-vaisselle)", hood: true },
  { name: "Hotte + conduit : nettoyage complet (société)", freq: "yearly", product: "Société spécialisée — garder l'attestation", hood: true },
  { name: "Congélateurs (dégivrage + nettoyage)", freq: "monthly", product: "Désinfectant alimentaire" },
  { name: "Réserve sèche / étagères", freq: "monthly", product: "Désinfectant" },
];
