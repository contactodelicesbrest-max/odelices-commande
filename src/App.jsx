import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Minus, ShoppingBag, X, Check, Clock, ArrowLeft, Bell } from "lucide-react";
import { loadOrders, saveOrders } from "./lib/orders.js";
import { sendOrderReadyEmail } from "./lib/email.js";

const LOGO = "data:image/jpeg;base64,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";

// ---------- Référentiels carte ----------
const SAUCES = ["Ketchup", "Mayonnaise", "Barbecue", "Moutarde", "Blanche (maison)", "Samouraï", "Harissa (maison)", "Algérienne", "Andalouse", "Biggy Burger"];

const SUPP_GENERAL = [
  { id: "cheddar", name: "Cheddar", price: 1.0 },
  { id: "chevre", name: "Chèvre", price: 1.5 },
  { id: "oeuf", name: "Œuf", price: 1.5 },
  { id: "oignons-frits", name: "Oignons frits", price: 1.0 },
];
const SUPP_BOISSON = { id: "boisson", name: "Boisson", price: 1.5 };

const MEATS = [
  { name: "Kebab", extra: 0 },
  { name: "Poulet", extra: 0 },
  { name: "Nuggets", extra: 0 },
  { name: "Cordon bleu", extra: 0 },
  { name: "Tenders", extra: 1.0 },
  { name: "Falafels", extra: 0 },
  { name: "Égrené de bœuf", extra: 0 },
];

const MENU = [
  {
    cat: "Compose ton Tacos",
    note: "Tous nos tacos sont composés de frites et de sauce fromagère.",
    items: [
      {
        id: "tacos",
        name: "Tacos",
        desc: "1ère sauce offerte, 2e sauce à 0,50€.",
        sizes: [
          { label: "M · 1 viande", price: 10.5, meatMax: 1 },
          { label: "L · 2 viandes", price: 11.5, meatMax: 2 },
          { label: "XL · 3 viandes", price: 13.0, meatMax: 3 },
        ],
        meatOptions: MEATS,
        sauceIncluded: true,
        supplementsAllowed: [...SUPP_GENERAL, SUPP_BOISSON],
        baseIngredients: ["Frites", "Sauce fromagère"],
      },
    ],
  },
  {
cat: "Menu Hamburger",
    note: "Servis avec frites. 1ère sauce incluse, 2e à 0,50€.",
    items: [
      {
        id: "hamburger",
        name: "Hamburger",
        desc: "Steak 80g, salade, tomates, oignons.",
        sizes: [{ label: "Sans boisson", price: 7.5 }, { label: "Avec boisson", price: 9.0 }],
        sauceIncluded: true,
        supplementsAllowed: SUPP_GENERAL,
        baseIngredients: ["Salade", "Tomates", "Oignons"],
      },
      {
        id: "cheeseburger",
        name: "Cheeseburger",
        desc: "Steak 80g, tomates, oignons, cheddar.",
        sizes: [{ label: "Sans boisson", price: 8.0 }, { label: "Avec boisson", price: 9.5 }],
        sauceIncluded: true,
        supplementsAllowed: SUPP_GENERAL,
        baseIngredients: ["Tomates", "Oignons", "Cheddar"],
      },
      {
        id: "odelices",
        name: "O'Délices Burger",
        desc: "2 steaks, salade, tomates, oignons, cheddar + sauce au choix.",
        sizes: [{ label: "Sans boisson", price: 10.0 }, { label: "Avec boisson", price: 11.5 }],
        sauceIncluded: true,
        supplementsAllowed: SUPP_GENERAL,
        baseIngredients: ["Salade", "Tomates", "Oignons", "Cheddar"],
      },
    ],
  },
  {
    cat: "Menu Enfant",
    note: "1ère sauce incluse, 2e à 0,50€.",
    items: [
      {
        id: "menu-enfant",
        name: "Menu Enfant",
        desc: "1 viande au choix, frites ou nuggets (4 pièces), 1 sauce et une boisson inclus.",
        sizes: [{ label: "Standard", price: 7.0, meatMax: 1 }],
        meatOptions: MEATS,
        extraChoice: { label: "Accompagnement", options: ["Frites", "Nuggets (4 pièces)"] },
        sauceIncluded: true,
      },
    ],
  },
  {
    cat: "Sandwich",
    note: "1ère sauce incluse, 2e à 0,50€.",
    items: [
      {
        id: "doner",
        name: "Döner Kebab",
        desc: "Salade, tomates, oignons.",
        sizes: [{ label: "Sans boisson", price: 9.0 }, { label: "Avec boisson", price: 10.5 }],
        breadChoice: { label: "Pain ou galette", options: ["Pain", "Galette"] },
        sauceIncluded: true,
        supplementsAllowed: SUPP_GENERAL,
        baseIngredients: ["Salade", "Tomates", "Oignons"],
      },
      {
        id: "steak-poulet",
        name: "Formule Steak ou Poulet",
        desc: "Salade, tomates, oignons.",
        sizes: [{ label: "Sans boisson", price: 9.0 }, { label: "Avec boisson", price: 10.5 }],
        meatOptions: [{ name: "Steak", extra: 0 }, { name: "Poulet", extra: 0 }],
        meatMax: 1,
        breadChoice: { label: "Pain ou galette", options: ["Pain", "Galette"] },
        sauceIncluded: true,
        supplementsAllowed: SUPP_GENERAL,
        baseIngredients: ["Salade", "Tomates", "Oignons"],
      },
      {
        id: "panini",
        name: "Panini",
        desc: "Au choix parmi toutes nos viandes. Viande supplémentaire : +3,00€.",
        sizes: [{ label: "Sans boisson", price: 7.5 }, { label: "Avec boisson", price: 9.0 }],
        meatOptions: MEATS,
        meatMax: 1,
        extraMeatPrice: 3.0,
        sauceIncluded: true,
        supplementsAllowed: SUPP_GENERAL,
      },
        {
  id: "formule-assiette",
  name: "Formule Assiette",
  desc: "Au choix : kebab, nuggets, poulet, steak, tenders, cordon bleu ou falafels. Viande supplémentaire : +3,00€.",
  sizes: [{ label: "Sans boisson", price: 13.5 }, { label: "Avec boisson", price: 15.5 }],
  meatOptions: MEATS,
  meatMax: 1,
  extraMeatPrice: 3.0,
  breadChoice: { label: "Pain ou galette", options: ["Pain", "Galette"] },
  sauceIncluded: true,
  supplementsAllowed: SUPP_GENERAL,
},
      {
        id: "formule-nuggets",
        name: "Formule Nuggets",
        desc: "6 pièces.",
        sizes: [{ label: "Sans boisson", price: 7.0 }, { label: "Avec boisson", price: 8.0 }],
        sauceIncluded: true,
      },
    ],
  },
  {
    cat: "Petite faim",
    note: "1ère sauce offerte, 2e sauce à 0,50€.",
    items: [
     { id: "pf-hamburger", name: "Hamburger (steak 80g)", price: 5.5, baseIngredients: ["Salade", "Tomates", "Oignons"], sauceIncluded: true, supplementsAllowed: SUPP_GENERAL },
      { id: "pf-cheeseburger", name: "Cheeseburger (steak 80g)", price: 6.0, baseIngredients: ["Tomates", "Oignons", "Cheddar"], sauceIncluded: true, supplementsAllowed: SUPP_GENERAL },
      { id: "pf-croc", name: "Croc'délices", price: 4.0, sauceIncluded: true },
      { id: "pf-frites", name: "Frites", price: 4.5, sauceIncluded: true },
      { id: "pf-oignons", name: "Oignons rings", sizes: [{ label: "4 pièces", price: 3.0 }, { label: "6 pièces", price: 4.0 }], sauceIncluded: true },
      { id: "pf-viande", name: "Viande kebab", sizes: [{ label: "Petite portion", price: 8.0 }, { label: "Grande portion", price: 10.0 }], sauceIncluded: true },
      { id: "pf-tenders", name: "Tenders", sizes: [{ label: "2 pièces", price: 4.0 }, { label: "4 pièces", price: 6.0 }], sauceIncluded: true },
      { id: "pf-nuggets", name: "Nuggets", sizes: [{ label: "4 pièces", price: 4.0 }, { label: "6 pièces", price: 5.5 }], sauceIncluded: true },
    ],
  },
  {
    cat: "Boissons sans alcool",
    items: [
      { id: "coca", name: "Coca-Cola (33cl)", price: 2.0 },
      { id: "icetea", name: "Ice Tea (33cl)", price: 2.0 },
      { id: "sprite", name: "Sprite (33cl)", price: 2.0 },
      { id: "perrier", name: "Perrier (33cl)", price: 2.0 },
      { id: "redbull", name: "Red Bull (33cl)", price: 2.0 },
      { id: "ayran", name: "Ayran (33cl)", price: 2.0 },
      { id: "oasis", name: "Oasis (33cl)", price: 2.0 },
      { id: "fanta", name: "Fanta (33cl)", price: 2.0 },
      { id: "cristaline", name: "Cristaline (50cl)", price: 1.5 },
      { id: "cafe", name: "Café", price: 1.8 },
      { id: "infusion", name: "Infusion", price: 1.8 },
    ],
  },
  {
    cat: "Alcool",
    items: [
    { id: "efes", name: "Efes", sizes: [{ label: "33cl", price: 4.0 }, { label: "50cl", price: 6.0 }] },
{ id: "heineken", name: "Heineken", sizes: [{ label: "33cl", price: 4.0 }, { label: "50cl", price: 4.0 }] },
      { id: "86", name: "8.6 (50cl)", price: 4.0 },
      { id: "vin-rouge", name: "Vin rouge (75cl)", price: 13.0 },
      { id: "vin-rose", name: "Vin rosé (75cl)", price: 13.0 },
      { id: "pichet", name: "Pichet", sizes: [{ label: "25cl", price: 5.0 }, { label: "50cl", price: 8.0 }], extraChoice: { label: "Vin", options: ["Rosé", "Rouge"] } },
    ],
  },
  {
    cat: "Desserts",
    items: [
      { id: "baklava", name: "Baklava", sizes: [{ label: "1 pièce", price: 1.0 }, { label: "4 pièces", price: 2.5 }] },
      { id: "loukoum", name: "Loukoum (4 pièces)", price: 3.0 },
      { id: "brownies", name: "Brownies (1 pièce)", price: 3.0 },
      { id: "tiramisu", name: "Tiramisu", desc: "Choix des parfums à voir avec le personnel au retrait.", price: 4.0 },
    ],
  },
];

const STATUS_FLOW = ["Nouvelle", "En préparation", "Prête", "Récupérée"];
const money = (n) => n.toFixed(2).replace(".", ",") + " €";
const genTicket = () => "B" + Math.floor(100 + Math.random() * 900);

function lineSubtitle(line) {
  const parts = [];
  if (line.removed?.length) parts.push("Sans " + line.removed.join(", "));
  if (line.meats?.length) parts.push(line.meats.join(", "));
  if (line.bread) parts.push(line.bread);
  if (line.extraChoice) parts.push(line.extraChoice);
  if (line.sauces?.length) parts.push("Sauce" + (line.sauces.length > 1 ? "s" : "") + " : " + line.sauces.join(", "));
  if (line.supplements?.length) parts.push("Suppl. : " + line.supplements.map((s) => (s.qty > 1 ? `${s.name} x${s.qty}` : s.name)).join(", "));
  return parts.join(" · ");
}

// ---------- Ticket ----------
function Ticket({ order, compact }) {
  return (
    <div className="ticket">
      <div className="ticket-head">
        <span className="ticket-num">#{order.ticket}</span>
        <span className="ticket-time">{order.time}</span>
      </div>
      <div className="ticket-line" />
      {order.items.map((it, i) => {
        const sub = lineSubtitle(it);
        return (
          <div key={i} className="ticket-item">
            <div className="ticket-item-top">
              <span>{it.qty}× {it.name}{it.sizeLabel ? ` (${it.sizeLabel})` : ""}</span>
              <span>{money(it.totalPrice)}</span>
            </div>
            {sub && !compact && <div className="ticket-item-sub">{sub}</div>}
          </div>
        );
      })}
      <div className="ticket-line" />
      <div className="ticket-total">
        <span>Total</span>
        <span>{money(order.total)}</span>
      </div>
      <div className="ticket-pay">À régler au comptoir</div>
    </div>
  );
}

// ---------- Modale de personnalisation produit (générique) ----------
function ProductModal({ item, onClose, onAdd }) {
  const sizes = item.sizes && item.sizes.length ? item.sizes : [{ label: "", price: item.price }];
  const [sizeIdx, setSizeIdx] = useState(0);
  const size = sizes[sizeIdx];
  const meatOptions = item.meatOptions || [];
  const meatRequired = size.meatMax ?? item.meatMax ?? 0;
  const extraMeatPrice = item.extraMeatPrice || 0;
  const meatCap = extraMeatPrice > 0 ? meatOptions.length : meatRequired;
  const [meats, setMeats] = useState([]);
  const [bread, setBread] = useState(item.breadChoice ? item.breadChoice.options[0] : null);
  const [choiceSel, setChoiceSel] = useState(item.extraChoice ? item.extraChoice.options[0] : null);
  const [sauces, setSauces] = useState([]);
  const [supplements, setSupplements] = useState({});
  const [removed, setRemoved] = useState([]);
  const [qty, setQty] = useState(1);

  useEffect(() => { setMeats([]); }, [sizeIdx]);

  const toggleIngredient = (name) => {
    if (removed.includes(name)) setRemoved(removed.filter((x) => x !== name));
    else setRemoved([...removed, name]);
  };

  const meatSurcharge =
    meats.reduce((s, m) => s + (meatOptions.find((o) => o.name === m)?.extra || 0), 0) +
    extraMeatPrice * Math.max(0, meats.length - meatRequired);
  const includedSauces = item.sauceIncluded ? 1 : 0;
  const extraSauceCount = Math.max(0, sauces.length - includedSauces);
  const extraSaucePrice = extraSauceCount * 0.5;
  const supplementsTotal = Object.entries(supplements).reduce(
    (s, [id, q]) => s + item.supplementsAllowed.find((x) => x.id === id).price * q,
    0
  );
  const unit = size.price + meatSurcharge + extraSaucePrice + supplementsTotal;
  const total = unit * qty;
const canAdd = meatRequired === 0 || meats.length >= meatRequired;

  const meatCount = (name) => meats.filter((m) => m === name).length;
  const incrMeat = (name) => {
    if (meats.length < meatCap) setMeats([...meats, name]);
  };
  const decrMeat = (name) => {
    const idx = meats.lastIndexOf(name);
    if (idx === -1) return;
    const next = [...meats];
    next.splice(idx, 1);
    setMeats(next);
  };
  const toggleSauce = (s) => {
    if (sauces.includes(s)) setSauces(sauces.filter((x) => x !== s));
    else setSauces([...sauces, s]);
  };
  const incrSupp = (id) => setSupplements({ ...supplements, [id]: (supplements[id] || 0) + 1 });
  const decrSupp = (id) => {
    const next = { ...supplements };
    if ((next[id] || 0) <= 1) delete next[id];
    else next[id] = next[id] - 1;
    setSupplements(next);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        <h3 className="modal-title">{item.name}</h3>
        {item.desc && <p className="modal-desc">{item.desc}</p>}

        {item.baseIngredients && (
          <div className="modal-section">
            <span className="modal-label">Ingrédients inclus — clique pour retirer</span>
            <div className="chip-row">
              {item.baseIngredients.map((ing) => (
                <button
                  key={ing}
                  className={`chip ${removed.includes(ing) ? "chip-removed" : "chip-active"}`}
                  onClick={() => toggleIngredient(ing)}
                >
                  {removed.includes(ing) ? `Sans ${ing}` : ing}
                </button>
              ))}
            </div>
          </div>
        )}

        {sizes.length > 1 && (
          <div className="modal-section">
            <span className="modal-label">Format</span>
            <div className="chip-row">
              {sizes.map((s, i) => (
                <button key={s.label} className={`chip ${sizeIdx === i ? "chip-active" : ""}`} onClick={() => setSizeIdx(i)}>
                  {s.label} · {money(s.price)}
                </button>
              ))}
            </div>
          </div>
        )}

        {meatRequired > 0 && (
          <div className="modal-section">
            <span className="modal-label">
              {extraMeatPrice > 0
                ? `Viande (1 incluse, +${money(extraMeatPrice)} par viande en plus) — ${meats.length} sélectionnée${meats.length > 1 ? "s" : ""}`
                : `Viande${meatRequired > 1 ? `s (choisis ${meatRequired})` : ""} — ${meats.length}/${meatRequired}`}
            </span>
            <div className="chip-row">
              {meatOptions.map((m) => (
                <button key={m.name} className={`chip ${meats.includes(m.name) ? "chip-active" : ""}`} onClick={() => toggleMeat(m.name)}>
                  {m.name}{m.extra > 0 ? ` (+${money(m.extra)})` : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {item.breadChoice && (
          <div className="modal-section">
            <span className="modal-label">{item.breadChoice.label}</span>
            <div className="chip-row">
              {item.breadChoice.options.map((o) => (
                <button key={o} className={`chip ${bread === o ? "chip-active" : ""}`} onClick={() => setBread(o)}>{o}</button>
              ))}
            </div>
          </div>
        )}

        {item.extraChoice && (
          <div className="modal-section">
            <span className="modal-label">{item.extraChoice.label}</span>
            <div className="chip-row">
              {item.extraChoice.options.map((o) => (
                <button key={o} className={`chip ${choiceSel === o ? "chip-active" : ""}`} onClick={() => setChoiceSel(o)}>{o}</button>
              ))}
            </div>
          </div>
        )}

        {item.sauceIncluded && (
          <div className="modal-section">
            <span className="modal-label">Sauces (1ère offerte, 2e +0,50€)</span>
            <div className="chip-row">
              {SAUCES.map((s) => (
                <button key={s} className={`chip ${sauces.includes(s) ? "chip-active" : ""}`} onClick={() => toggleSauce(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {item.supplementsAllowed && (
          <div className="modal-section">
            <span className="modal-label">Suppléments</span>
            <div className="supp-list">
              {item.supplementsAllowed.map((s) => (
                <div key={s.id} className="supp-row">
                  <span className="supp-name">{s.name} (+{money(s.price)})</span>
                  <div className="qty-control qty-control-sm">
                    <button onClick={() => decrSupp(s.id)} disabled={!supplements[s.id]}><Minus size={14} /></button>
                    <span>{supplements[s.id] || 0}</span>
                    <button onClick={() => incrSupp(s.id)}><Plus size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <div className="qty-control">
            <button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16} /></button>
            <span>{qty}</span>
            <button onClick={() => setQty(qty + 1)}><Plus size={16} /></button>
          </div>
          <button
            className="btn-primary"
            disabled={!canAdd}
            style={!canAdd ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            onClick={() =>
              onAdd({
                name: item.name,
                sizeLabel: size.label || null,
                meats,
                bread,
                extraChoice: choiceSel,
                sauces,
                removed,
                supplements: Object.entries(supplements).map(([id, q]) => ({
                  ...item.supplementsAllowed.find((x) => x.id === id),
                  qty: q,
                })),
                qty,
                unitPrice: unit,
                totalPrice: total,
              })
            }
          >
            {canAdd ? `Ajouter · ${money(total)}` : `Choisis ${meatRequired > 1 || extraMeatPrice > 0 ? "au moins " : ""}${meatRequired} viande${meatRequired > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Vue client ----------
function ClientView() {
  const [activeItem, setActiveItem] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [step, setStep] = useState("menu");
  const payment = "comptoir";
  const [email, setEmail] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [trackNum, setTrackNum] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackError, setTrackError] = useState("");

  const total = cart.reduce((s, i) => s + i.totalPrice, 0);

  const addToCart = (line) => {
    setCart([...cart, line]);
    setActiveItem(null);
    setCartOpen(true);
  };
  const removeLine = (idx) => setCart(cart.filter((_, i) => i !== idx));

  const placeOrder = async () => {
    const order = {
      ticket: genTicket(),
      items: cart,
      total,
      payment,
      email: email.trim() || null,
      status: "Nouvelle",
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      createdAt: Date.now(),
    };
    const current = await loadOrders();
    await saveOrders([...current, order]);
    setConfirmedOrder(order);
    setCart([]);
    setStep("confirmed");
  };

  const doTrack = async () => {
    setTrackError("");
    const orders = await loadOrders();
    const found = orders.find((o) => o.ticket.toLowerCase() === trackNum.trim().toLowerCase());
    if (found) setTrackedOrder(found);
    else setTrackError("Aucune commande trouvée avec ce numéro.");
  };

  useEffect(() => {
    if (step !== "confirmed") return;
    const t = setTimeout(() => { setStep("menu"); setConfirmedOrder(null); }, 20000);
    return () => clearTimeout(t);
  }, [step]);

  if (step === "confirmed" && confirmedOrder) {
    return (
      <div className="screen center">
        <img src={LOGO} alt="O'Délices" className="brand-logo-lg" />
        <div className="confirm-badge"><Check size={28} /></div>
        <h2 className="confirm-title">Commande envoyée en cuisine</h2>
        <p className="confirm-sub">Présente ce numéro au comptoir pour le retrait.</p>
        <Ticket order={confirmedOrder} />
        <button className="btn-ghost" onClick={() => { setStep("menu"); setConfirmedOrder(null); }}>
          Nouvelle commande
        </button>
      </div>
    );
  }

  if (step === "track") {
    return (
      <div className="screen">
        <button className="back-link" onClick={() => setStep("menu")}><ArrowLeft size={16} /> Retour à la carte</button>
        <h2 className="section-title">État de la commande</h2>
        <div className="track-row">
          <input className="input" placeholder="Ex. B482" value={trackNum} onChange={(e) => setTrackNum(e.target.value)} />
          <button className="btn-primary" onClick={doTrack}>Chercher</button>
        </div>
        {trackError && <p className="track-error">{trackError}</p>}
        {trackedOrder && (
          <div className="track-result">
            <div className="status-row">
              {STATUS_FLOW.map((s) => (
                <div key={s} className={`status-step ${STATUS_FLOW.indexOf(trackedOrder.status) >= STATUS_FLOW.indexOf(s) ? "status-done" : ""}`}>
                  {s}
                </div>
              ))}
            </div>
            <Ticket order={trackedOrder} compact />
          </div>
        )}
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="screen">
        <button className="back-link" onClick={() => setStep("menu")}><ArrowLeft size={16} /> Retour à la carte</button>
        <h2 className="section-title">Récapitulatif</h2>
        <p className="section-note">À régler au comptoir au retrait de la commande.</p>

        <div className="modal-section">
          <span className="modal-label">Email (facultatif) — pour être prévenu quand c'est prêt</span>
          <input
            className="input"
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="pay-summary">
          <span>Total à régler</span>
          <span>{money(total)}</span>
        </div>
        <button className="btn-primary btn-full" onClick={placeOrder}>
          Envoyer la commande en cuisine
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="menu-header">
        <div className="brand-block">
          <img src={LOGO} alt="O'Délices" className="brand-logo" />
          <div>
            <p className="eyebrow">Click & collect</p>
            <h1 className="brand-title">O'Délices</h1>
          </div>
        </div>
        <button className="track-btn" onClick={() => setStep("track")}><Clock size={16} /> État de la commande</button>
      </header>

      {MENU.map((section) => (
        <div key={section.cat} className="menu-section">
          <h2 className="section-title">{section.cat}</h2>
          {section.note && <p className="section-note">{section.note}</p>}
          <div className="item-grid">
            {section.items.map((item) => {
              const displayPrice = item.price ?? item.sizes[0].price;
              return (
                <button key={item.id} className="item-card" onClick={() => setActiveItem(item)}>
                  <div className="item-card-top">
                    <span className="item-name">{item.name}</span>
                    <span className="item-price">{item.sizes?.length > 1 ? `dès ${money(displayPrice)}` : money(displayPrice)}</span>
                  </div>
                  {item.desc && <p className="item-desc">{item.desc}</p>}
                  <span className="item-cta"><Plus size={14} /> {item.sizes?.length > 1 || item.meatOptions || item.sauceIncluded || item.supplementsAllowed ? "Personnaliser" : "Ajouter"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {activeItem && (
        <ProductModal item={activeItem} onClose={() => setActiveItem(null)} onAdd={addToCart} />
      )}

      {cart.length > 0 && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          <ShoppingBag size={18} />
          <span>{cart.length} article{cart.length > 1 ? "s" : ""}</span>
          <span>{money(total)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="modal-backdrop" onClick={() => setCartOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCartOpen(false)} aria-label="Fermer"><X size={20} /></button>
            <h3 className="modal-title">Ton panier</h3>
            {cart.length === 0 && <p className="modal-desc">Le panier est vide.</p>}
            {cart.map((line, idx) => (
              <div key={idx} className="cart-line">
                <div>
                  <p className="cart-line-name">{line.qty}× {line.name}{line.sizeLabel ? ` (${line.sizeLabel})` : ""}</p>
                  {lineSubtitle(line) && <p className="cart-line-sub">{lineSubtitle(line)}</p>}
                </div>
                <div className="cart-line-right">
                  <span>{money(line.totalPrice)}</span>
                  <button onClick={() => removeLine(idx)} aria-label="Retirer"><X size={14} /></button>
                </div>
              </div>
            ))}
            {cart.length > 0 && (
              <>
                <div className="pay-summary">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
                <button className="btn-primary btn-full" onClick={() => { setCartOpen(false); setStep("payment"); }}>
                  Passer au règlement
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Vue cuisine ----------
function KitchenView() {
  const [orders, setOrders] = useState([]);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    const o = await loadOrders();
    setOrders(o.slice().reverse());
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, 4000);
    return () => clearInterval(timer.current);
  }, [refresh]);

  const advance = async (ticket) => {
    const all = await loadOrders();
    let justReady = null;
    const updated = all.map((o) => {
      if (o.ticket !== ticket) return o;
      const idx = STATUS_FLOW.indexOf(o.status);
      const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
      if (next === "Prête" && o.status !== "Prête") justReady = { ...o, status: next };
      return { ...o, status: next };
    });
    await saveOrders(updated);
    if (justReady) sendOrderReadyEmail(justReady);
    refresh();
  };

  const active = orders.filter((o) => o.status !== "Récupérée");

  return (
    <div className="screen kitchen">
      <header className="menu-header">
        <div className="brand-block">
          <img src={LOGO} alt="O'Délices" className="brand-logo" />
          <div>
            <p className="eyebrow">Mode cuisine</p>
            <h1 className="brand-title">Commandes en cours</h1>
          </div>
        </div>
        <span className="kitchen-count"><Bell size={14} /> {active.length}</span>
      </header>

      {active.length === 0 && <p className="empty-state">Aucune commande en attente pour le moment.</p>}

      <div className="kitchen-grid">
        {active.map((o) => (
          <div key={o.ticket} className={`kitchen-card status-${o.status.replace(" ", "-")}`}>
            <Ticket order={o} />
            <div className="kitchen-status-bar">
              <span className="kitchen-status-label">{o.status}</span>
              <button className="btn-primary" onClick={() => advance(o.ticket)}>
                {o.status === "Nouvelle" && "Démarrer la préparation"}
                {o.status === "En préparation" && "Marquer prête"}
                {o.status === "Prête" && "Marquer récupérée"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("vue"); // "client" ou "cuisine" — pour figer la tablette sur un seul mode
  const [mode, setMode] = useState(forced === "cuisine" ? "kitchen" : "client");
  const locked = forced === "client" || forced === "cuisine";

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');

        :root {
          --bg: #1c1917;
          --panel: #262220;
          --panel-raised: #2f2a27;
          --fire: #e8452c;
          --gold: #e8a230;
          --sea: #3d8a9c;
          --text: #f5f0e8;
          --muted: #b8aca0;
          --border: #3a342f;
        }
        * { box-sizing: border-box; }
        .app-root { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
        .screen { max-width: 640px; margin: 0 auto; padding: 20px 16px 100px; position: relative; }
        .screen.center { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 60px; }

        .mode-switch { position: sticky; top: 0; z-index: 40; display: flex; justify-content: center; gap: 6px; padding: 10px; background: var(--bg); border-bottom: 1px solid var(--border); }
        .mode-btn { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; letter-spacing: 0.03em; cursor: pointer; }
        .mode-btn.mode-active { background: var(--fire); border-color: var(--fire); color: #fff; }

        .menu-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 22px; }
        .brand-block { display: flex; align-items: center; gap: 10px; }
        .brand-logo { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; }
        .brand-logo-lg { width: 88px; height: 88px; border-radius: 18px; object-fit: cover; margin-bottom: 14px; }
        .eyebrow { text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; color: var(--gold); font-weight: 700; margin: 0 0 4px; }
        .brand-title { font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: 0.02em; margin: 0; display: flex; align-items: center; gap: 8px; }
        .brand-flame { color: var(--fire); }
        .track-btn { display: flex; align-items: center; gap: 6px; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .back-link { display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--muted); font-size: 13px; margin-bottom: 16px; cursor: pointer; padding: 0; }

        .menu-section { margin-bottom: 26px; }
        .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.03em; color: var(--gold); margin: 0 0 4px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
        .section-note { color: var(--muted); font-size: 11.5px; margin: 6px 0 10px; }
        .item-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .item-card { text-align: left; background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 14px; cursor: pointer; color: var(--text); transition: border-color .15s ease; }
        .item-card:hover { border-color: var(--fire); }
        .item-card-top { display: flex; justify-content: space-between; font-weight: 700; font-size: 15px; gap: 8px; }
        .item-price { color: var(--gold); white-space: nowrap; }
        .item-desc { color: var(--muted); font-size: 12.5px; margin: 4px 0 10px; }
        .item-cta { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--fire); }

        .cart-fab { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 608px; background: var(--fire); color: #fff; border: none; border-radius: 14px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 8px 24px rgba(232,69,44,0.35); z-index: 30; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 50; }
        .modal { background: var(--panel-raised); width: 100%; max-width: 640px; border-radius: 20px 20px 0 0; padding: 22px 18px 18px; max-height: 88vh; overflow-y: auto; position: relative; }
        .modal-close { position: absolute; top: 14px; right: 14px; background: var(--panel); border: none; color: var(--text); border-radius: 8px; padding: 6px; cursor: pointer; }
        .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; margin: 0 0 4px; letter-spacing: 0.02em; }
        .modal-desc { color: var(--muted); font-size: 13px; margin: 0 0 16px; }
        .modal-section { margin-bottom: 16px; }
        .modal-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); font-weight: 700; margin-bottom: 8px; }
        .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip { background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 7px 12px; border-radius: 999px; font-size: 12.5px; cursor: pointer; }
        .chip-active { background: var(--sea); border-color: var(--sea); color: #fff; font-weight: 600; }
        .chip-removed { background: transparent; border-color: var(--border); color: var(--muted); text-decoration: line-through; }
        .modal-footer { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
        .qty-control { display: flex; align-items: center; gap: 10px; background: var(--panel); border-radius: 10px; padding: 6px 10px; }
        .qty-control button { background: none; border: none; color: var(--text); cursor: pointer; }
        .qty-control button:disabled { opacity: 0.3; cursor: not-allowed; }
        .supp-list { display: flex; flex-direction: column; gap: 8px; }
        .supp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .supp-name { font-size: 14px; }
        .qty-control-sm { padding: 4px 8px; gap: 6px; }
        .btn-primary { background: var(--fire); color: #fff; border: none; padding: 12px 18px; border-radius: 12px; font-weight: 700; font-size: 13.5px; cursor: pointer; flex: 1; }
        .btn-full { width: 100%; }
        .btn-ghost { background: none; border: 1px solid var(--border); color: var(--text); padding: 10px 18px; border-radius: 12px; font-weight: 600; margin-top: 18px; cursor: pointer; }

        .cart-line { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--border); gap: 10px; }
        .cart-line-name { margin: 0; font-size: 13.5px; font-weight: 600; }
        .cart-line-sub { margin: 3px 0 0; font-size: 11.5px; color: var(--muted); }
        .cart-line-right { display: flex; align-items: center; gap: 10px; font-size: 13px; white-space: nowrap; }
        .cart-line-right button { background: none; border: none; color: var(--muted); cursor: pointer; }
        .pay-summary { display: flex; justify-content: space-between; font-family: 'Bebas Neue', sans-serif; font-size: 20px; margin: 14px 0; letter-spacing: 0.02em; }

        .pay-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
        .pay-card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--text); cursor: pointer; }
        .pay-card span { font-weight: 700; font-size: 13px; }
        .pay-card small { color: var(--muted); font-size: 11px; text-align: center; }
        .pay-card-active { border-color: var(--fire); background: rgba(232,69,44,0.12); }
        .cb-form { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 14px; margin-bottom: 18px; }
        .cb-demo-note { font-size: 11.5px; color: var(--muted); margin: 0 0 10px; line-height: 1.5; }
        .input { width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 8px; }
        .cb-row { display: flex; gap: 8px; }

        .track-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .track-error { color: var(--fire); font-size: 12.5px; }
        .track-result { margin-top: 18px; }
        .status-row { display: flex; gap: 6px; margin-bottom: 14px; }
        .status-step { flex: 1; text-align: center; font-size: 10.5px; padding: 6px 2px; border-radius: 8px; background: var(--panel); color: var(--muted); border: 1px solid var(--border); font-weight: 700; }
        .status-done { background: var(--sea); color: #fff; border-color: var(--sea); }

        .ticket { background: #f5f0e8; color: #2a2420; border-radius: 4px; padding: 16px 14px; font-family: 'Inter', monospace; width: 100%; max-width: 320px; margin: 14px auto; position: relative; }
        .ticket-head { display: flex; justify-content: space-between; font-weight: 800; font-size: 15px; }
        .ticket-num { letter-spacing: 0.04em; }
        .ticket-time { color: #6b5f52; font-weight: 500; }
        .ticket-line { border-top: 1px dashed #b8aca0; margin: 8px 0; }
        .ticket-item { margin-bottom: 6px; }
        .ticket-item-top { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; gap: 8px; }
        .ticket-item-sub { font-size: 10.5px; color: #6b5f52; margin-top: 2px; }
        .ticket-total { display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; }
        .ticket-pay { text-align: center; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b5f52; margin-top: 6px; }

        .confirm-badge { width: 56px; height: 56px; border-radius: 50%; background: var(--sea); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .confirm-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; margin: 0 0 6px; letter-spacing: 0.02em; }
        .confirm-sub { color: var(--muted); font-size: 13px; margin: 0 0 6px; }

        .kitchen-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .kitchen-card { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 6px; }
        .kitchen-status-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px 4px; }
        .kitchen-status-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold); }
        .kitchen-count { display: flex; align-items: center; gap: 5px; background: var(--fire); padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .empty-state { color: var(--muted); font-size: 13px; text-align: center; margin-top: 60px; }

        @media (min-width: 520px) {
          .item-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {!locked && (
        <div className="mode-switch">
          <button className={`mode-btn ${mode === "client" ? "mode-active" : ""}`} onClick={() => setMode("client")}>Vue client</button>
          <button className={`mode-btn ${mode === "kitchen" ? "mode-active" : ""}`} onClick={() => setMode("kitchen")}>Vue cuisine</button>
        </div>
      )}

      {mode === "client" ? <ClientView /> : <KitchenView />}
    </div>
  );
}
