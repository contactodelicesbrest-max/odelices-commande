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
const BOISSON_FORMULE = () => link("boissons", { label: "Boisson", min: 1, max: 1, bySize: { sans: { min: 0, max: 0 } } });
const MEAT_1 = (g = "viandes") => link(g, { label: "Viande", min: 1, max: 1 });
const MEAT_SUPP = (g = "viandes") => link(g, { label: "Viande supplémentaire (+3,00 €)", extraPrice: 3, repeat: true });
const AVEC_SANS = (sans, avec) => [
  { id: "sans", label: "Sans boisson", price: sans },
  { id: "avec", label: "Avec boisson", price: avec },
];
const sz = (label, price) => ({ id: slug(label), label, price });

const CATEGORIES = [
  { id: "tacos", icon: "🌮", name: "Tacos", note: "Tous nos tacos sont composés de frites et de sauce fromagère." },
  { id: "burgers", icon: "🍔", name: "Burgers", note: "Servis avec frites. 1ère sauce incluse, 2e à 0,50 €." },
  { id: "sandwichs", icon: "🥙", name: "Sandwichs & Assiettes", note: "1ère sauce incluse, 2e à 0,50 €." },
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
      link("boissons", { label: "Ajouter une boisson (+1,50 €)", max: 1, extraPrice: 1.5 }),
    ],
  }),

  P("burgers", "Hamburger", {
    description: "Steak 80g, salade, tomates, oignons. Servi avec frites.",
    sizes: AVEC_SANS(7.5, 9),
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),
  P("burgers", "Cheeseburger", {
    description: "Steak 80g, tomates, oignons, cheddar. Servi avec frites.",
    sizes: AVEC_SANS(8, 9.5),
    ingredients: ["Tomates", "Oignons", "Cheddar"],
    links: [SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),
  P("burgers", "O'Délices Burger", {
    id: "odelices-burger",
    description: "2 steaks, salade, tomates, oignons, cheddar + sauce au choix. Servi avec frites.",
    popular: true,
    sizes: AVEC_SANS(10, 11.5),
    ingredients: ["Salade", "Tomates", "Oignons", "Cheddar"],
    links: [SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),

  P("sandwichs", "Döner Kebab", {
    id: "doner",
    description: "Salade, tomates, oignons. Viande supplémentaire : +3,00 €.",
    popular: true,
    sizes: AVEC_SANS(9, 10.5),
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [MEAT_1(), MEAT_SUPP(), PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),
  P("sandwichs", "Menu Falafel", {
    description: "Falafels, salade, tomates, oignons.",
    sizes: AVEC_SANS(9, 10.5),
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),
  P("sandwichs", "Formule Steak ou Poulet", {
    id: "steak-poulet",
    description: "Salade, tomates, oignons. Viande supplémentaire : +3,00 €.",
    sizes: AVEC_SANS(9, 10.5),
    ingredients: ["Salade", "Tomates", "Oignons"],
    links: [MEAT_1("viandes-steak-poulet"), MEAT_SUPP("viandes-supp-steak"), PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),
  P("sandwichs", "Panini", {
    description: "Au choix parmi toutes nos viandes. Viande supplémentaire : +3,00 €.",
    sizes: AVEC_SANS(7.5, 9),
    links: [MEAT_1(), MEAT_SUPP(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),
  P("sandwichs", "Formule Assiette", {
    id: "assiette",
    description: "Kebab, nuggets, poulet, steak, tenders, cordon bleu ou falafels. Viande supplémentaire : +3,00 €.",
    sizes: AVEC_SANS(13.5, 15.5),
    links: [MEAT_1("viandes-assiette"), MEAT_SUPP("viandes-assiette"), PAIN(), SAUCE_1_OFFERTE(), SUPPS(), BOISSON_FORMULE()],
  }),
  P("sandwichs", "Formule Nuggets", {
    description: "6 nuggets et frites.",
    sizes: AVEC_SANS(7, 8),
    links: [SAUCE_1_OFFERTE(), BOISSON_FORMULE()],
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
    kitchen: { type: "none", name: "", address: "", host: "", port: 9100, width: 32, copies: 1, accents: false, cut: true },
    counter: { enabled: false, type: "none", name: "", address: "", host: "", port: 9100, width: 32, copies: 1, accents: false, cut: true, vat: true },
  },
  // Si pas d'imprimante caisse : imprimer aussi un ticket client (avec prix) sur l'imprimante cuisine
  clientTicketOnKitchen: true,
};

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
    menu: defaultMenu(),
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    counter: { day: "", n: 0 },
  };
}
