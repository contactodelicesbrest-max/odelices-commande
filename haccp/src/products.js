// Reconnaissance du type de produit à partir de son nom / du texte de l'étiquette,
// et conseil de conservation APRÈS OUVERTURE (réfrigérateur 0/+4 °C).
// Règle générale (GBPH restauration) : suivre en priorité l'indication du fabricant
// (« après ouverture, à consommer dans les X jours ») ; à défaut, appliquer une durée prudente.
// Jamais au-delà de la DLC d'origine.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Ordre important : du plus précis au plus général.
export const PRODUCT_TYPES = [
  { id: "hache", label: "Viande hachée", keys: ["hache", "steak hache", "egrene", "kefta", "boulette"], days: 1, cat: "Viandes", unit: "kg",
    advice: "Viande hachée crue : à utiliser le jour même de l'ouverture (J+1 maximum), conservation +2 °C." },
  { id: "kebab", label: "Viande kebab (broche / émincé cru)", keys: ["kebab", "doner", "broche", "gyros"], days: 2, cat: "Viandes", unit: "kg",
    advice: "Viande crue préparée : J+2 maximum après ouverture, à +4 °C. Broche entamée : suivre la fiche du fabricant." },
  { id: "pane", label: "Produit pané (nuggets, tenders, cordon bleu)", keys: ["nugget", "tender", "cordon bleu", "pane", "crispy", "wings"], days: 3, cat: "Surgelés", unit: "kg",
    advice: "Surgelé : reste au congélateur jusqu'à la DDM. Une fois cuit puis refroidi, ou décongelé : 3 jours maximum au frigo, ne jamais recongeler." },
  { id: "charcuterie", label: "Charcuterie cuite", keys: ["jambon", "bacon", "lardon", "chorizo", "pepperoni", "dinde fumee", "salami", "pastrami"], days: 3, cat: "Viandes", unit: "kg",
    advice: "Charcuterie entamée : 3 jours maximum (souvent indiqué sur l'emballage), à +4 °C." },
  { id: "volaille", label: "Volaille crue", keys: ["poulet", "dinde", "volaille", "aiguillette", "pilon", "escalope de poulet", "blanc de poulet", "filet de poulet", "cuisse"], days: 2, cat: "Volailles", unit: "kg",
    advice: "Volaille crue : J+2 maximum après ouverture, à +4 °C, dans un bac fermé en bas du frigo." },
  { id: "viande", label: "Viande crue", keys: ["boeuf", "veau", "agneau", "viande", "entrecote", "bavette", "merguez", "saucisse"], days: 2, cat: "Viandes", unit: "kg",
    advice: "Viande crue : J+2 maximum après ouverture, à +4 °C (merguez et saucisses fraîches : J+2)." },
  { id: "poisson", label: "Poisson / produits de la mer", keys: ["poisson", "saumon", "thon frais", "crevette", "cabillaud", "colin", "surimi"], days: 1, cat: "Autre", unit: "kg",
    advice: "Poisson frais : J+1 maximum, entre 0 et +2 °C. Surimi : suivre l'étiquette, sinon J+2." },
  { id: "creme", label: "Crème / lait", keys: ["creme", "lait ", "lait)", "cream", "chantilly"], days: 3, cat: "Crèmerie / fromages", unit: "L",
    advice: "Crème et lait entamés : 3 jours maximum au frigo (UHT compris une fois ouvert)." },
  { id: "laitier", label: "Yaourt / fromage blanc", keys: ["yaourt", "yogourt", "yogurt", "ayran", "fromage blanc", "faisselle", "skyr", "tzatziki"], days: 3, cat: "Crèmerie / fromages", unit: "kg",
    advice: "Produit laitier frais entamé : 3 jours maximum, à +4 °C." },
  { id: "fromage_frais", label: "Fromage frais / mozzarella", keys: ["mozzarella", "chevre", "feta", "ricotta", "mascarpone", "burrata", "boursin", "fromage frais", "kiri"], days: 3, cat: "Crèmerie / fromages", unit: "kg",
    advice: "Fromage frais entamé : 3 jours maximum (mozzarella en saumure : 2 à 3 jours)." },
  { id: "fromage", label: "Fromage (râpé, tranches, cheddar)", keys: ["cheddar", "emmental", "rape", "raclette", "gouda", "edam", "mimolette", "fromage", "tranche", "comte", "brie", "camembert"], days: 5, cat: "Crèmerie / fromages", unit: "kg",
    advice: "Fromage râpé / en tranches entamé : 5 jours maximum (suivre l'emballage s'il indique moins)." },
  { id: "oeuf", label: "Œufs / ovoproduits", keys: ["oeuf", "ovoproduit", "jaune d'oeuf", "blanc d'oeuf"], days: 1, cat: "Crèmerie / fromages", unit: "pièce",
    advice: "Ovoproduit liquide entamé : 24 h maximum. Œufs coquille : jusqu'à la date, au frais." },
  { id: "sauce_oeuf", label: "Sauce à base d'œuf (mayo, samouraï, algérienne…)", keys: ["mayonnaise", "mayo", "samourai", "algerienne", "andalouse", "biggy", "tartare", "aioli", "sauce burger", "sauce blanche", "bearnaise"], days: 7, cat: "Sauces", unit: "L",
    advice: "Sauce industrielle entamée : suivre l'étiquette (souvent « après ouverture, au frais »). À défaut : 7 jours au frigo, bouchon fermé, pas de couteau sale dedans." },
  { id: "sauce", label: "Sauce (ketchup, barbecue, moutarde, harissa…)", keys: ["ketchup", "barbecue", "bbq", "moutarde", "harissa", "sauce", "curry", "sriracha", "chili", "pesto"], days: 14, cat: "Sauces", unit: "L",
    advice: "Sauce entamée : suivre l'étiquette « après ouverture ». À défaut : 2 semaines au frigo (moutarde et ketchup se gardent souvent plus, voir l'emballage)." },
  { id: "conserve", label: "Conserve / bocal (tomate, maïs, olives…)", keys: ["conserve", "concentre", "pulpe", "tomate pelee", "tomates pelees", "coulis", "mais doux", "olive", "cornichon", "jalapeno", "pois chiche", "haricot", "thon"], days: 3, cat: "Épicerie", unit: "boîte",
    advice: "Conserve ouverte : transvaser dans un bac (jamais dans la boîte métal), 3 jours maximum au frigo. Bocaux avec liquide (cornichons, olives) : suivre l'étiquette." },
  { id: "salade", label: "Salade / crudités", keys: ["salade", "laitue", "iceberg", "roquette", "mesclun", "4e gamme", "carotte rapee", "chou"], days: 1, cat: "Fruits & légumes", unit: "kg",
    advice: "Salade en sachet (4e gamme) ouverte : 24 h maximum. Crudités préparées sur place : J+1 à J+2." },
  { id: "legume", label: "Légumes frais coupés", keys: ["oignon", "tomate", "poivron", "concombre", "champignon", "persil", "coriandre", "menthe", "citron"], days: 2, cat: "Fruits & légumes", unit: "kg",
    advice: "Légumes lavés et coupés : J+2 maximum dans un bac fermé à +4 °C." },
  { id: "frites", label: "Frites / pommes de terre surgelées", keys: ["frite", "potatoe", "pomme de terre", "rosti", "wedges"], days: null, cat: "Surgelés", unit: "kg",
    advice: "Surgelé : sachet entamé bien refermé au congélateur, jusqu'à la DDM. Ne pas recongeler ce qui a décongelé." },
  { id: "pain", label: "Pain / galettes / tortillas", keys: ["pain", "galette", "tortilla", "wrap", "bun", "baguette", "pita", "naan", "brioche"], days: null, cat: "Pains", unit: "pièce",
    advice: "Pain et galettes : suivre la DDM ; sachet entamé bien refermé (2 à 3 jours pour les galettes une fois ouvertes, sans moisissure)." },
  { id: "huile", label: "Huile", keys: ["huile", "oil"], days: null, cat: "Épicerie", unit: "L",
    advice: "Huile : produit stable, se garde jusqu'à la DDM, bouchon fermé, à l'abri de la lumière." },
  { id: "boisson", label: "Boisson", keys: ["coca", "soda", "jus ", "eau minerale", "eau gazeuse", "cristaline", "fanta", "sprite", "oasis", "ice tea", "boisson", "limonade"], days: 3, cat: "Boissons", unit: "bouteille",
    advice: "Boisson ouverte : 3 jours au frigo (jus frais : 24 à 48 h)." },
  { id: "sec", label: "Épicerie sèche", keys: ["farine", "sucre", "sel", "riz", "pates", "semoule", "epice", "chapelure", "boulgour", "lentille"], days: null, cat: "Épicerie", unit: "kg",
    advice: "Épicerie sèche : se garde jusqu'à la DDM dans un contenant fermé, à l'abri de l'humidité." },
];

export function detectType(text) {
  const t = ` ${norm(text)} `;
  for (const p of PRODUCT_TYPES) {
    if (p.keys.some((k) => t.includes(norm(k)))) return p;
  }
  return null;
}

// Durée « après ouverture » écrite sur l'étiquette, ex :
// « À consommer dans les 3 jours après ouverture », « après ouverture : 48 h », « 1 mois après ouverture »
export function daysAfterOpeningFromLabel(text) {
  const s = norm(text).replace(/\s+/g, " ");
  if (!/ouverture|entame|opening|opened/.test(s)) return null;
  const re = /(\d{1,3})\s*(jours?|j\b|heures?|h\b|semaines?|mois|days?|hours?|weeks?|months?)/g;
  let m, best = null;
  while ((m = re.exec(s))) {
    // garde le nombre le plus proche du mot « ouverture »
    const pos = s.indexOf("ouverture") >= 0 ? s.indexOf("ouverture") : s.indexOf("open");
    const dist = Math.abs(m.index - pos);
    if (dist > 80) continue;
    const n = Number(m[1]);
    const u = m[2];
    const days = /^h|hour/.test(u) ? Math.max(1, Math.round(n / 24)) : /sem|week/.test(u) ? n * 7 : /mois|month/.test(u) ? n * 30 : n;
    if (!best || dist < best.dist) best = { days, dist, text: `${n} ${u}` };
  }
  return best ? { days: best.days, text: best.text } : null;
}

// Conseil complet pour un produit : priorité à l'étiquette, sinon au type de produit.
export function openingAdvice(name, labelText = "") {
  if (/maison|fait sur place/i.test(name))
    return { days: 3, source: "type", type: null, text: "Préparation maison : 3 jours maximum après la fabrication (sans étude de durée de vie), à +3 °C." };
  const fromLabel = daysAfterOpeningFromLabel(labelText);
  const type = detectType(`${name} ${labelText}`);
  if (fromLabel)
    return { days: fromLabel.days, source: "label", type, text: `L'étiquette indique : ${fromLabel.text} après ouverture.` };
  if (type) return { days: type.days, source: "type", type, text: type.advice };
  return { days: 3, source: "default", type: null, text: "Produit non reconnu : sans indication du fabricant, 3 jours maximum après ouverture (règle prudente)." };
}

// Quantité lue sur l'étiquette : « Poids net 2,5 kg », « 5 L », « 6 x 1 L », « 1000 g », « 12 pièces »
export function quantityFromLabel(text) {
  const s = norm(text).replace(/,/g, ".");
  let m = s.match(/(\d{1,3})\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|l|cl|ml)\b/);
  if (m) {
    const total = Number(m[1]) * Number(m[2]);
    return toUnit(total, m[3], `${m[1]} x ${m[2]} ${m[3]}`);
  }
  m = s.match(/(?:poids net|net weight|contenance|net|poids|e)\s*:?\s*(\d+(?:\.\d+)?)\s*(kg|g|l|cl|ml)\b/) || s.match(/\b(\d+(?:\.\d+)?)\s*(kg|l)\b/);
  if (m) return toUnit(Number(m[1]), m[2]);
  m = s.match(/(?<![\d.])(\d+(?:\.\d+)?)\s*(g|cl|ml)\b/);
  if (m) return toUnit(Number(m[1]), m[2]);
  m = s.match(/\b(\d{1,4})\s*(pieces?|pcs|unites|portions)\b/);
  if (m) return { qty: Number(m[1]), unit: "pièce" };
  return null;
}
function toUnit(n, u, label) {
  if (u === "g") return { qty: +(n / 1000).toFixed(3), unit: "kg", label };
  if (u === "ml") return { qty: +(n / 1000).toFixed(3), unit: "L", label };
  if (u === "cl") return { qty: +(n / 100).toFixed(3), unit: "L", label };
  return { qty: n, unit: u === "l" ? "L" : u, label };
}

// ---------- DLC ou DDM ? ----------
// Si le type de date n'a pas été indiqué, les produits stables (surgelés, épicerie, boissons,
// huile, emballages…) ont une DDM : une fois passée, ils restent consommables (qualité moindre).
const DDM_CATEGORIES = ["Surgelés", "Épicerie", "Boissons", "Pains", "Emballages", "Hygiène"];
export function isDdm(item) {
  if (item.dlcType === "DDM") return true;
  if (item.dlcType === "DLC") return false;
  if (DDM_CATEGORIES.includes(item.category)) return true;
  const t = detectType(item.name || item.product || "");
  return !!t && (t.days === null || ["frites", "pane", "huile", "sec", "boisson", "pain", "sauce"].includes(t.id));
}
// Produit du stock dont la DLC (et pas la DDM) est dépassée : interdit, à jeter
export const stockExpired = (s) => !!s.dlc && (s.qty || 0) > 0 && !isDdm(s) && daysBefore(s.dlc) < 0;
export const stockDdmPassed = (s) => !!s.dlc && (s.qty || 0) > 0 && isDdm(s) && daysBefore(s.dlc) < 0;
function daysBefore(d) {
  const a = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const b = new Date(String(d).slice(0, 10) + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

// Durée « après décongélation » écrite sur l'étiquette (ex : « à consommer dans les 3 jours après décongélation »)
export function daysAfterThawFromLabel(text) {
  const s = norm(text).replace(/\s+/g, " ");
  const m = s.match(/(\d{1,2})\s*(jours?|j\b|heures?|h\b)\s*(apres|suivant)\s*(la\s*)?decongel/) || s.match(/decongel\w*\s*[:,]?\s*(?:a consommer\s*)?(?:dans|sous)\s*(?:les\s*)?(\d{1,2})\s*(jours?|heures?|h\b)/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2];
  return { days: /^h/.test(u) ? Math.max(1, Math.round(n / 24)) : n, text: `${n} ${u} après décongélation` };
}
