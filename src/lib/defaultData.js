// Menu et réglages par défaut (repris de l'ancienne appli).
// Tout est modifiable ensuite depuis l'espace gérant.

const opt = (name, price = 0) => ({ id: slug(name), name, price, available: true });

export function slug(s) {
  return (
    String(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "x"
  );
}

const MEATS = [
  opt("Kebab"),
  opt("Poulet Mariné"),
  opt("Poulet Curry"),
  opt("Poulet Paprika"),
  opt("Nuggets"),
  opt("Cordon bleu"),
  opt("Tenders", 1),
  opt("Falafels"),
  opt("Égrené de bœuf"),
];

const GROUPS = [
  {
    id: "sauces",
    name: "Sauces",
    options: ["Ketchup", "Mayonnaise", "Barbecue", "Moutarde", "Blanche (maison)", "Samouraï", "Harissa (maison)", "Algérienne", "Andalouse", "Biggy Burger"].map((n) => opt(n)),
  },
  { id: "viandes", name: "Viandes", options: MEATS },
  {
    id: "viandes-assiette",
    name: "Viandes (assiette)",
    options: MEATS.map((m) => (m.name === "Égrené de bœuf" ? opt("Steak") : { ...m })),
  },
  {
    id: "viandes-steak-poulet",
    name: "Steak ou poulet",
    options: [opt("Steak"), opt("Poulet Mariné"), opt("Poulet Curry"), opt("Poulet Paprika")],
  },
  { id: "viandes-supp-steak", name: "Viandes + steak", options: [opt("Steak"), ...MEATS.map((m) => ({ ...m }))] },
  {
    id: "supplements",
    name: "Suppléments",
    options: [opt("Cheddar", 1), opt("Chèvre", 1.5), opt("Œuf", 1.5), opt("Oignons frits", 1)],
  },
  { id: "pain", name: "Pain ou galette", options: [opt("Pain"), opt("Galette")] },
  {
    id: "boissons",
    name: "Boissons (canettes)",
    options: ["Coca-Cola", "Ice Tea", "Sprite", "Perrier", "Oasis", "Fanta", "Cristaline"].map((n) => opt(n)),
  },
  { id: "vin", name: "Vin", options: [opt("Rosé"), opt("Rouge")] },
];

let linkSeq = 0;
const link = (groupId, rules = {}) => ({
  id: `l${++linkSeq}`,
  groupId,
  label: "",
  min: 0,
  max: 0, // 0 = illimité
  free: 0, // nombre de choix sans le surcoût "extraPrice"
  extraPrice: 0, // surcoût par choix au-delà des choix offerts
  repeat: false, // possibilité de prendre plusieurs fois la même option
  bySize: {},
  ...rules,
});

// Règles réutilisées
const SAUCE_1_OFFERTE = () => link("sauces", { label: "Sauces", free: 1, extraPrice: 0.5 });
const SAUCES_GRATUITES = () => link("sauces", { label: "Sauces (gratuites)" });
const SUPPS = () => link("supplements", { label: "Suppléments", repeat: true });
const PAIN = () => link("pain", { label: "Pain ou galette", min: 1, max: 1 });
// Boisson facultative : le client l'ajoute seulement s'il le souhaite (supplément = écart de l'ancien prix "avec boisson")
const BOISSON_OPT = (extra) => link("boissons", { label: "Ajouter une boisson", max: 1, extraPrice: extra });
const MEAT_1 = (g = "viandes") => link(g, { label: "Viande", min: 1, max: 1 });
const MEAT_SUPP = (g = "viandes") => link(g, { label: "Viande supplémentaire (+3,00 €)", extraPrice: 3, repeat: true });
const sz = (label, price) => ({ id: slug(label), label, price });

const CATEGORIES = [
  { id: "tacos", icon: "🌮", name: "Tacos", note: "Tous nos tacos sont composés de frites et de sauce fromagère." },
  { id: "sandwichs", icon: "🥙", name: "Sandwichs & Assiettes", note: "1ère sauce incluse, 2e à 0,50 €." },
  { id: "burgers", icon: "🍔", name: "Burgers", note: "Servis avec frites. 1ère sauce incluse, 2e à 0,50 €." },
  { id: "enfant", icon: "🧒", name: "Menu Enfant", note: "2 sauces au choix incluses." },
  { id: "petite-faim", icon: "🍟", name: "Petite faim", note: "Sauces au choix incluses, sans supplément." },
  { id: "boissons", icon: "🥤", name: "Boissons", note: "" },
  { id: "alcool", icon: "🍺", name: "Alcool", note: "Consommation sur place uniquement. Vente interdite aux mineurs." },
  { id: "desserts", icon: "🍰", name: "Desserts", note: "" },
];

const P = (categoryId, name, fields = {}) => ({
  id: fields.id || slug(name),
  categoryId,
  name,
  description: "",
  image: "",
  sizes: [],
  price: 0,
  ingredients: [],
  links: [],
  vatRate: 10,
  available: true,
  hidden: false,
  popular: false,
  ...fields,
});

// Produits ajoutés dans l'appli Comptoir (absents de l'ancien GitHub)
const ROSTIBURGER = () =>
  P("burgers", "Rostiburger", {
    description: "Servi avec frites, salade, tomates, oignons.",
    price: 11.5,
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  });
const PIZZA_TURC = () =>
  P("sandwichs", "Pizza Turc", {
    description: "Base galette, salade, tomates, oignons. Viande supplémentaire : +3,00 €.",
    price: 9.5,
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [MEAT_SUPP(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  });
const MOZZA_STICKS = () =>
  P("petite-faim", "Mozzarella sticks", {
    id: "pf-mozza",
    sizes: [sz("4 pièces", 3.9), sz("5 pièces", 4.9), sz("8 pièces", 7.9), sz("10 pièces", 9.9)],
    links: [SAUCES_GRATUITES()],
  });
const ADDED = [
  { make: ROSTIBURGER, after: "odelices-burger" },
  { make: PIZZA_TURC, after: "doner" },
  { make: MOZZA_STICKS, after: "pf-nuggets" },
];

const PRODUCTS = [
  P("tacos", "Tacos", {
    description: "Frites et sauce fromagère maison. 1ère sauce offerte, 2e à 0,50 €.",
    popular: true,
    sizes: [
      { id: "m", label: "M · 1 viande", price: 10.5 },
      { id: "l", label: "L · 2 viandes", price: 11.5 },
      { id: "xl", label: "XL · 3 viandes", price: 13 },
    ],
    ingredients: ["Frites", "Sauce fromagère"],
    links: [
      link("viandes", { label: "Viandes", min: 1, max: 1, repeat: true, bySize: { m: { min: 1, max: 1 }, l: { min: 2, max: 2 }, xl: { min: 3, max: 3 } } }),
      SAUCE_1_OFFERTE(),
      SUPPS(),
      BOISSON_OPT(1.5),
    ],
  }),

  P("burgers", "Hamburger", {
    description: "Steak 80g, salade, tomates, oignons. Servi avec frites.",
    price: 7.5,
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  P("burgers", "Cheeseburger", {
    description: "Steak 80g, tomates, oignons, cheddar. Servi avec frites.",
    price: 8,
    ingredients: ["Tomates", "Oignons", "Cheddar"],
    links: [SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  P("burgers", "O'Délices Burger", {
    id: "odelices-burger",
    description: "2 steaks, salade, tomates, oignons, cheddar + sauce au choix. Servi avec frites.",
    popular: true,
    price: 10,
    ingredients: ["Salade", "Tomates", "Oignons", "Cheddar"],
    links: [SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  ROSTIBURGER(),

  P("sandwichs", "Döner Kebab", {
    id: "doner",
    description: "Salade, tomates, oignons. Viande supplémentaire : +3,00 €.",
    popular: true,
    price: 9,
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [MEAT_SUPP(), PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  PIZZA_TURC(),
  P("sandwichs", "Menu Falafel", {
    description: "Falafels, salade, tomates, oignons.",
    price: 9,
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  P("sandwichs", "Formule Steak ou Poulet", {
    id: "steak-poulet",
    description: "Salade, tomates, oignons. Viande supplémentaire : +3,00 €.",
    price: 9,
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [MEAT_1("viandes-steak-poulet"), MEAT_SUPP("viandes-supp-steak"), PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  P("sandwichs", "Panini", {
    description: "Au choix parmi toutes nos viandes. Viande supplémentaire : +3,00 €.",
    price: 7.5,
    links: [MEAT_1(), MEAT_SUPP(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  P("sandwichs", "Formule Assiette", {
    id: "assiette",
    description: "Kebab, nuggets, poulet, steak, tenders, cordon bleu ou falafels. Viande supplémentaire : +3,00 €.",
    price: 13.5,
    links: [MEAT_1("viandes-assiette"), MEAT_SUPP("viandes-assiette"), PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_OPT(1.5)],
  }),
  P("sandwichs", "Formule Nuggets", {
    description: "6 nuggets et frites.",
    price: 7,
    links: [SAUCE_1_OFFERTE(), BOISSON_OPT(1)],
  }),

  ...[
    ["Menu Enfant Nuggets", "5 nuggets, frites, 2 sauces au choix incluses.", []],
    ["Menu Enfant Kebab", "Viande kebab, frites, 2 sauces au choix incluses.", []],
    ["Menu Enfant Hamburger", "Hamburger, frites, 2 sauces au choix incluses.", ["Salade", "Tomates", "Oignons"]],
  ].map(([name, description, ingredients]) =>
    P("enfant", name, { description, price: 7.5, ingredients, links: [link("sauces", { label: "Sauces (2 au choix)", max: 2 })] })
  ),

  P("petite-faim", "Hamburger (steak 80g)", { id: "pf-hamburger", price: 5.5, ingredients: ["Salade", "Tomates", "Oignons"], links: [SAUCES_GRATUITES(), SUPPS()] }),
  P("petite-faim", "Cheeseburger (steak 80g)", { id: "pf-cheeseburger", price: 6, ingredients: ["Tomates", "Oignons", "Cheddar"], links: [SAUCES_GRATUITES(), SUPPS()] }),
  P("petite-faim", "Croc'délices", { id: "pf-croc", price: 4, links: [SAUCES_GRATUITES()] }),
  P("petite-faim", "Frites", { id: "pf-frites", sizes: [sz("Petite", 2.5), sz("Grande", 4.5)], links: [SAUCES_GRATUITES()] }),
  P("petite-faim", "Oignons rings", { id: "pf-oignons", sizes: [sz("4 pièces", 3), sz("6 pièces", 4)], links: [SAUCES_GRATUITES()] }),
  P("petite-faim", "Viande kebab", { id: "pf-viande", sizes: [sz("Petite portion", 8), sz("Grande portion", 10)], links: [SAUCES_GRATUITES()] }),
  P("petite-faim", "Tenders", { id: "pf-tenders", sizes: [sz("2 pièces", 4), sz("4 pièces", 6)], links: [SAUCES_GRATUITES()] }),
  P("petite-faim", "Nuggets", { id: "pf-nuggets", sizes: [sz("4 pièces", 4), sz("6 pièces", 5.5)], links: [SAUCES_GRATUITES()] }),
  MOZZA_STICKS(),

  P("boissons", "Coca-Cola", { sizes: [sz("33cl", 2), sz("Bouteille", 4.5)] }),
  ...["Ice Tea", "Sprite", "Perrier", "Red Bull", "Ayran", "Oasis", "Fanta"].map((n) => P("boissons", n, { price: 2, description: "33cl" })),
  P("boissons", "Cristaline", { price: 1.5, description: "50cl" }),
  P("boissons", "Café", { price: 1.8 }),
  P("boissons", "Infusion", { price: 1.8 }),

  P("alcool", "Efes", { sizes: [sz("33cl", 4), sz("50cl", 6)], vatRate: 20 }),
  P("alcool", "Heineken", { sizes: [sz("33cl", 4), sz("50cl", 4)], vatRate: 20 }),
  P("alcool", "8.6", { id: "86", price: 4, description: "33cl", vatRate: 20 }),
  P("alcool", "Vin rouge", { price: 13, description: "Bouteille 75cl", vatRate: 20 }),
  P("alcool", "Vin rosé", { price: 13, description: "Bouteille 75cl", vatRate: 20 }),
  P("alcool", "Pichet de vin", { id: "pichet", sizes: [sz("25cl", 5), sz("50cl", 8)], vatRate: 20, links: [link("vin", { label: "Vin", min: 1, max: 1 })] }),

  P("desserts", "Baklava", { sizes: [sz("1 pièce", 1), sz("4 pièces", 2.5)] }),
  P("desserts", "Loukoum", { price: 3, description: "4 pièces" }),
  P("desserts", "Brownie", { price: 3, description: "1 pièce" }),
  P("desserts", "Tiramisu", { price: 4, description: "Parfum à choisir avec le personnel au retrait." }),
];

export const DEFAULT_SETTINGS = {
  restaurantName: "O'Délices",
  tagline: "Tacos · Burgers · Kebab — Brest",
  siret: "840 224 380 00013",
  address: "",
  phone: "",
  ticketFooter: "Merci et à bientôt !",
  adminPin: "1234",
  orderTypes: { surPlace: true, emporter: true },
  askName: true,
  idleSeconds: 90,
  hideUnavailable: false,
  showPrices: true,
  printers: {
    kitchen: { type: "bluetooth", name: "", address: "", host: "", port: 9100, width: 48, copies: 1, accents: false, cut: true },
    counter: { enabled: false, type: "bluetooth", name: "", address: "", host: "", port: 9100, width: 48, copies: 1, accents: false, cut: true, vat: true },
  },
  // Si pas d'imprimante caisse : imprimer aussi un ticket client (avec prix) sur l'imprimante cuisine
  clientTicketOnKitchen: true,
};

// Mise à jour des menus déjà enregistrés sur la tablette (version 1 → 2) :
// formules "Sans / Avec boisson" → prix sans boisson + boisson facultative.
export function migrateMenu(menu) {
  for (const p of menu.products) {
    const ids = (p.sizes || []).map((s) => s.id).join();
    if (ids === "sans,avec") {
      const sans = Number(p.sizes[0].price) || 0;
      const avec = Number(p.sizes[1].price) || 0;
      p.price = sans;
      p.sizes = [];
      p.links = (p.links || []).filter((l) => !(l.groupId === "boissons" && l.bySize && l.bySize.sans));
      if (avec > sans) p.links.push({ ...BOISSON_OPT(Math.round((avec - sans) * 100) / 100), id: "l-boisson-" + p.id });
    }
    for (const l of p.links || []) if (l.label === "Ajouter une boisson (+1,50 €)") l.label = "Ajouter une boisson";
    if (p.id === "doner") p.links = p.links.filter((l) => !(l.groupId === "viandes" && l.label === "Viande" && l.min === 1));
  }
  return menu;
}

// Version 2 → 3 : prix et produits de l'appli Comptoir
export function migrateMenuV3(menu) {
  const assiette = menu.products.find((p) => p.id === "assiette");
  const drink = assiette?.links.find((l) => l.groupId === "boissons");
  if (drink && Number(drink.extraPrice) === 2) drink.extraPrice = 1.5;
  for (const { make, after } of ADDED) {
    const p = make();
    if (menu.products.some((x) => x.id === p.id || x.name.toLowerCase() === p.name.toLowerCase())) continue;
    if (!menu.categories.some((c) => c.id === p.categoryId)) continue;
    const i = menu.products.findIndex((x) => x.id === after);
    menu.products.splice(i >= 0 ? i + 1 : menu.products.length, 0, p);
  }
  // ordre Tacos, Sandwichs, Burgers (seulement si l'ordre d'origine n'a pas été modifié)
  const ids = menu.categories.map((c) => c.id);
  const bi = ids.indexOf("burgers"), si = ids.indexOf("sandwichs");
  if (bi === 1 && si === 2) [menu.categories[1], menu.categories[2]] = [menu.categories[2], menu.categories[1]];
  return menu;
}

export function defaultMenu() {
  return {
    categories: CATEGORIES.map((c) => ({ ...c, hidden: false })),
    products: JSON.parse(JSON.stringify(PRODUCTS)),
    groups: JSON.parse(JSON.stringify(GROUPS)),
  };
}

export function defaultData() {
  return {
    version: 1,
    menuVersion: 3,
    menu: defaultMenu(),
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    counter: { day: "", n: 0 },
  };
}
