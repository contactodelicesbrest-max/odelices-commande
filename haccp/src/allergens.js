// Les 14 allergènes à déclarer (règlement UE 1169/2011, annexe II ; décret 2015-447 pour la restauration).

export const ALLERGENS = [
  { id: "gluten", label: "Gluten", short: "Gluten", icon: "🌾", keys: ["gluten", "ble", "froment", "seigle", "orge", "avoine", "epeautre", "kamut", "farine"] },
  { id: "crustaces", label: "Crustacés", short: "Crust.", icon: "🦐", keys: ["crustace", "crevette", "crabe", "homard", "langoustine", "ecrevisse"] },
  { id: "oeufs", label: "Œufs", short: "Œufs", icon: "🥚", keys: ["oeuf", "œuf", "ovoproduit", "albumine"] },
  { id: "poissons", label: "Poissons", short: "Poiss.", icon: "🐟", keys: ["poisson", "anchois", "thon", "saumon", "cabillaud", "colin", "merlu", "surimi"] },
  { id: "arachides", label: "Arachides", short: "Arach.", icon: "🥜", keys: ["arachide", "cacahuete", "cacahouete"] },
  { id: "soja", label: "Soja", short: "Soja", icon: "🫘", keys: ["soja", "soya"] },
  { id: "lait", label: "Lait", short: "Lait", icon: "🥛", keys: ["lait", "creme", "beurre", "fromage", "lactose", "lactoserum", "caseine", "yaourt", "emmental", "cheddar", "mozzarella", "lactique"] },
  { id: "fruits_coque", label: "Fruits à coque", short: "Fr. coque", icon: "🌰", keys: ["amande", "noisette", "noix", "cajou", "pecan", "pistache", "macadamia", "fruits a coque"] },
  { id: "celeri", label: "Céleri", short: "Céleri", icon: "🥬", keys: ["celeri"] },
  { id: "moutarde", label: "Moutarde", short: "Mout.", icon: "🌭", keys: ["moutarde"] },
  { id: "sesame", label: "Sésame", short: "Sésame", icon: "⚪", keys: ["sesame", "tahini", "tahina"] },
  { id: "sulfites", label: "Sulfites", short: "Sulf.", icon: "🍷", keys: ["sulfite", "anhydride sulfureux", "disulfite", "metabisulfite", "e220", "e221", "e222", "e223", "e224", "e226", "e227", "e228"] },
  { id: "lupin", label: "Lupin", short: "Lupin", icon: "🌼", keys: ["lupin"] },
  { id: "mollusques", label: "Mollusques", short: "Moll.", icon: "🐚", keys: ["mollusque", "moule", "huitre", "calamar", "calmar", "encornet", "poulpe", "seiche", "escargot"] },
];
export const allergenById = Object.fromEntries(ALLERGENS.map((a) => [a.id, a]));

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe");

// Allergènes repérés dans le texte d'une étiquette (liste d'ingrédients).
// « peut contenir / traces de » est séparé : ce sont des traces possibles.
export function allergensFromText(text) {
  // Faux amis : ne sont PAS des allergènes réglementaires
  const t = norm(text).replace(/laitue|noix de (coco|muscade)|beurre de cacao|lait de coco|creme de coco|creme de (vinaigre|balsamique)/g, " ");
  if (!t.trim()) return { contains: [], traces: [] };
  const m = t.match(/(peut contenir|traces? (eventuelles? )?de|fabrique dans un atelier)(.{0,160})/);
  const tracesPart = m ? m[3] : "";
  const main = m ? t.replace(m[0], " ") : t;
  const find = (s) => ALLERGENS.filter((a) => a.keys.some((k) => new RegExp(`\\b${norm(k)}`).test(s))).map((a) => a.id);
  const contains = find(main);
  return { contains, traces: find(tracesPart).filter((x) => !contains.includes(x)) };
}

// Composants de la carte O'Délices, pré-remplis à partir des recettes habituelles.
// ⚠️ À VÉRIFIER avec les étiquettes de TES produits (chaque marque est différente).
export const DEFAULT_DISHES = [
  { group: "Pains & galettes", name: "Galette de tacos / wrap", allergens: ["gluten"] },
  { group: "Pains & galettes", name: "Pain burger", allergens: ["gluten", "sesame"] },
  { group: "Viandes", name: "Kebab (viande)", allergens: [] },
  { group: "Viandes", name: "Poulet mariné", allergens: [] },
  { group: "Viandes", name: "Poulet curry", allergens: [] },
  { group: "Viandes", name: "Poulet paprika", allergens: [] },
  { group: "Viandes", name: "Nuggets", allergens: ["gluten"] },
  { group: "Viandes", name: "Tenders", allergens: ["gluten"] },
  { group: "Viandes", name: "Cordon bleu", allergens: ["gluten", "lait"] },
  { group: "Viandes", name: "Steak haché / égrené de bœuf", allergens: [] },
  { group: "Viandes", name: "Falafels", allergens: ["sesame"] },
  { group: "Fromages & suppléments", name: "Sauce fromagère (tacos)", allergens: ["lait"] },
  { group: "Fromages & suppléments", name: "Cheddar", allergens: ["lait"] },
  { group: "Fromages & suppléments", name: "Chèvre", allergens: ["lait"] },
  { group: "Fromages & suppléments", name: "Œuf", allergens: ["oeufs"] },
  { group: "Fromages & suppléments", name: "Oignons frits", allergens: ["gluten"] },
  { group: "Sauces", name: "Ketchup", allergens: [] },
  { group: "Sauces", name: "Mayonnaise", allergens: ["oeufs", "moutarde"] },
  { group: "Sauces", name: "Barbecue", allergens: ["moutarde"] },
  { group: "Sauces", name: "Moutarde", allergens: ["moutarde", "sulfites"] },
  { group: "Sauces", name: "Sauce blanche (maison)", allergens: ["lait", "oeufs", "moutarde"] },
  { group: "Sauces", name: "Samouraï", allergens: ["oeufs", "moutarde"] },
  { group: "Sauces", name: "Harissa (maison)", allergens: [] },
  { group: "Sauces", name: "Algérienne", allergens: ["oeufs", "moutarde"] },
  { group: "Sauces", name: "Andalouse", allergens: ["oeufs", "moutarde"] },
  { group: "Sauces", name: "Biggy Burger", allergens: ["oeufs", "moutarde"] },
  { group: "Sauces", name: "Sauce piment tomate (maison)", allergens: [] },
  { group: "Accompagnements", name: "Frites", allergens: [] },
  { group: "Accompagnements", name: "Salade, tomates, oignons", allergens: [] },
  { group: "Desserts", name: "Tiramisu", allergens: ["gluten", "lait", "oeufs"] },
];
export const DISH_GROUPS = ["Pains & galettes", "Viandes", "Fromages & suppléments", "Sauces", "Accompagnements", "Desserts", "Boissons", "Autre"];
