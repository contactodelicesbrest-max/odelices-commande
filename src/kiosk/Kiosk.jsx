import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Minus, Pencil, Plus, ShoppingBag, Trash2, Utensils, X, Check, Printer, Star } from "lucide-react";
import { useStore } from "../lib/store.jsx";
import { fromPrice, money, productSizes } from "../lib/pricing.js";
import { printOrderTickets } from "../lib/orderService.js";
import ProductSheet from "./ProductSheet.jsx";
import { ProductImage } from "./ProductImage.jsx";

const LOGO = "./logo.jpg";

// Appui long (2 s) → ouverture de l'espace gérant
function useLongPress(cb, ms = 2000) {
  const t = useRef(null);
  const start = () => {
    clearTimeout(t.current);
    t.current = setTimeout(cb, ms);
  };
  const stop = () => clearTimeout(t.current);
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop, onContextMenu: (e) => e.preventDefault() };
}

export default function Kiosk({ onAdmin }) {
  const { data, addOrder, patchOrder, nextTicketNumber } = useStore();
  const { menu, settings } = data;
  const [step, setStep] = useState("welcome"); // welcome | menu | done
  const [orderType, setOrderType] = useState("Sur place");
  const [cart, setCart] = useState([]);
  const [catId, setCatId] = useState(null);
  const [sheet, setSheet] = useState(null); // { product, editIndex }
  const [checkout, setCheckout] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [done, setDone] = useState(null);
  const [idleWarn, setIdleWarn] = useState(false);
  const adminPress = useLongPress(onAdmin);

  const groupsById = useMemo(() => Object.fromEntries(menu.groups.map((g) => [g.id, g])), [menu.groups]);
  const categories = useMemo(
    () =>
      menu.categories.filter(
        (c) => !c.hidden && menu.products.some((p) => p.categoryId === c.id && !p.hidden && (p.available || !settings.hideUnavailable))
      ),
    [menu, settings.hideUnavailable]
  );
  const popular = menu.products.filter((p) => p.popular && p.available && !p.hidden && categories.some((c) => c.id === p.categoryId));
  const allCats = popular.length ? [{ id: "_pop", name: "Populaires", icon: "⭐", note: "Les préférés de nos clients" }, ...categories] : categories;
  const currentCat = allCats.find((c) => c.id === catId) || allCats[0];
  const catIcon = (p) => categories.find((c) => c.id === p.categoryId)?.icon;
  const products =
    currentCat?.id === "_pop"
      ? popular
      : menu.products.filter((p) => currentCat && p.categoryId === currentCat.id && !p.hidden && (p.available || !settings.hideUnavailable));

  const total = cart.reduce((s, l) => s + l.totalPrice, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const reset = useCallback(() => {
    setCart([]);
    setSheet(null);
    setCheckout(false);
    setCartOpen(false);
    setIdleWarn(false);
    setCatId(null);
    setDone(null);
    setStep("welcome");
  }, []);

  // ----- Inactivité -----
  const lastTouch = useRef(Date.now());
  useEffect(() => {
    const touch = () => (lastTouch.current = Date.now());
    window.addEventListener("pointerdown", touch, true);
    return () => window.removeEventListener("pointerdown", touch, true);
  }, []);
  useEffect(() => {
    if (step !== "menu") return;
    const limit = (Number(settings.idleSeconds) || 90) * 1000;
    const iv = setInterval(() => {
      if (!idleWarn && Date.now() - lastTouch.current > limit) setIdleWarn(true);
    }, 1000);
    return () => clearInterval(iv);
  }, [step, idleWarn, settings.idleSeconds]);

  const start = (type) => {
    setOrderType(type);
    setStep("menu");
    lastTouch.current = Date.now();
  };

  const addLine = (line) => {
    if (sheet?.editIndex != null) setCart(cart.map((l, i) => (i === sheet.editIndex ? line : l)));
    else setCart([...cart, line]);
    setSheet(null);
  };

  const setLineQty = (idx, q) => {
    if (q <= 0) return setCart(cart.filter((_, i) => i !== idx));
    setCart(cart.map((l, i) => (i === idx ? { ...l, qty: q, totalPrice: l.unitPrice * q } : l)));
  };

  const placeOrder = async (clientName) => {
    const number = nextTicketNumber();
    const order = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number,
      createdAt: Date.now(),
      orderType,
      clientName: clientName.trim(),
      items: cart.map(({ sel, ...rest }) => rest),
      total,
      paid: false,
      cancelled: false,
      printed: null,
    };
    addOrder(order);
    setCheckout(false);
    setCartOpen(false);
    setDone({ order, printing: true, errors: [] });
    setStep("done");
    const r = await printOrderTickets(order, settings);
    patchOrder(order.id, { printed: r.ok, printErrors: r.errors });
    setDone({ order, printing: false, errors: r.errors });
  };

  // ======= Écran d'accueil =======
  if (step === "welcome") {
    const types = [
      settings.orderTypes.surPlace && { label: "Sur place", icon: <Utensils size={64} strokeWidth={1.6} />, sub: "Je mange ici" },
      settings.orderTypes.emporter && { label: "À emporter", icon: <ShoppingBag size={64} strokeWidth={1.6} />, sub: "Je repars avec" },
    ].filter(Boolean);
    return (
      <div className="welcome">
        <div className="welcome-glow" />
        <img className="welcome-logo" src={LOGO} alt="" {...adminPress} draggable={false} />
        <h1 className="welcome-title">{settings.restaurantName}</h1>
        {settings.tagline && <p className="welcome-tag">{settings.tagline}</p>}
        <p className="welcome-cta">Commandez ici, réglez au comptoir</p>
        <div className="welcome-types">
          {types.map((t) => (
            <button key={t.label} className="type-card" onClick={() => start(t.label)}>
              {t.icon}
              <span className="type-label">{t.label}</span>
              <span className="type-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ======= Confirmation =======
  if (step === "done" && done) {
    return <Confirmation done={done} settings={settings} onNew={reset} />;
  }

  // ======= Menu =======
  const cartPanel = (
    <CartPanel
      cart={cart}
      total={total}
      orderType={orderType}
      onQty={setLineQty}
      onEdit={(i) => {
        const l = cart[i];
        const p = menu.products.find((x) => x.id === l.productId);
        if (p) setSheet({ product: p, editIndex: i, initial: l });
      }}
      onCheckout={() => setCheckout(true)}
      onClose={() => setCartOpen(false)}
    />
  );

  return (
    <div className="kiosk">
      <header className="k-header">
        <button className="k-back" onClick={() => (cart.length ? setIdleWarn("confirm") : reset())}>
          <ChevronLeft size={22} /> Accueil
        </button>
        <div className="k-brand">
          <img src={LOGO} alt="" {...adminPress} draggable={false} />
          <span>{settings.restaurantName}</span>
        </div>
        <div className="k-type">
          {[settings.orderTypes.surPlace && "Sur place", settings.orderTypes.emporter && "À emporter"].filter(Boolean).map((t) => (
            <button key={t} className={orderType === t ? "on" : ""} onClick={() => setOrderType(t)}>
              {t}
            </button>
          ))}
        </div>
      </header>

      <nav className="k-cats">
        {allCats.map((c) => (
          <button key={c.id} className={`k-cat ${currentCat?.id === c.id ? "on" : ""}`} onClick={() => setCatId(c.id)}>
            <span className="k-cat-icon">{c.icon || "🍽️"}</span>
            <span className="k-cat-name">{c.name}</span>
          </button>
        ))}
      </nav>

      <main className="k-main">
        {currentCat && (
          <>
            <div className="k-cat-head">
              <h2>{currentCat.name}</h2>
              {currentCat.note && <p>{currentCat.note}</p>}
            </div>
            <div className="p-grid">
              {products.map((p) => {
                const out = !p.available;
                const multi = productSizes(p).length > 1;
                return (
                  <button key={p.id} className={`p-card ${out ? "out" : ""}`} disabled={out} onClick={() => setSheet({ product: p })}>
                    <div className="p-img-wrap">
                      <ProductImage product={p} className="p-img" icon={catIcon(p)} />
                      {p.popular && !out && (
                        <span className="badge badge-pop">
                          <Star size={13} fill="currentColor" /> Populaire
                        </span>
                      )}
                      {out && <span className="badge badge-out">Épuisé</span>}
                    </div>
                    <div className="p-info">
                      <span className="p-name">{p.name}</span>
                      {p.description && <span className="p-desc">{p.description}</span>}
                      <span className="p-price">
                        {multi && <small>dès </small>}
                        {money(fromPrice(p))}
                      </span>
                    </div>
                    {!out && (
                      <span className="p-plus">
                        <Plus size={22} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      <aside className="k-cart-side">{cartPanel}</aside>

      <div className="k-cart-bar">
        <button className="k-cart-bar-btn" onClick={() => setCartOpen(true)} disabled={!count}>
          <span className="k-cart-count">{count}</span>
          <span>Voir ma commande</span>
          <strong>{money(total)}</strong>
        </button>
      </div>
      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            {cartPanel}
          </div>
        </div>
      )}

      {sheet && <ProductSheet icon={catIcon(sheet.product)} product={sheet.product} initial={sheet.initial} groupsById={groupsById} onClose={() => setSheet(null)} onAdd={addLine} />}

      {checkout && (
        <Checkout
          cart={cart}
          total={total}
          orderType={orderType}
          askName={settings.askName}
          onBack={() => setCheckout(false)}
          onConfirm={placeOrder}
        />
      )}

      {idleWarn && (
        <IdleModal
          confirmMode={idleWarn === "confirm"}
          onStay={() => {
            lastTouch.current = Date.now();
            setIdleWarn(false);
          }}
          onReset={reset}
        />
      )}
    </div>
  );
}

function lineDetails(l) {
  const parts = [];
  if (l.removed?.length) parts.push("Sans " + l.removed.join(", ").toLowerCase());
  for (const c of l.choices || []) parts.push(c.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", "));
  return parts.join(" · ");
}

function CartPanel({ cart, total, orderType, onQty, onEdit, onCheckout, onClose }) {
  return (
    <div className="cart">
      <div className="cart-head">
        <h3>Ma commande</h3>
        <span className="cart-type">{orderType}</span>
        <button className="cart-close" onClick={onClose} aria-label="Fermer">
          <X size={22} />
        </button>
      </div>
      {cart.length === 0 ? (
        <div className="cart-empty">
          <ShoppingBag size={44} strokeWidth={1.4} />
          <p>Votre commande est vide</p>
          <span>Choisissez un produit pour commencer</span>
        </div>
      ) : (
        <ul className="cart-list">
          {cart.map((l, i) => (
            <li key={i} className="cart-line">
              <div className="cart-line-top">
                <button className="cart-line-name" onClick={() => onEdit(i)}>
                  {l.name}
                  {l.sizeLabel && <small> · {l.sizeLabel}</small>}
                  <Pencil size={13} className="cart-edit" />
                </button>
                <span className="cart-line-price">{money(l.totalPrice)}</span>
              </div>
              {lineDetails(l) && <p className="cart-line-sub">{lineDetails(l)}</p>}
              <div className="qty qty-sm">
                <button onClick={() => onQty(i, l.qty - 1)}>{l.qty === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button>
                <span>{l.qty}</span>
                <button onClick={() => onQty(i, l.qty + 1)}>
                  <Plus size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="cart-foot">
        <div className="cart-total">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <button className="btn-primary btn-xl" disabled={!cart.length} onClick={onCheckout}>
          Valider ma commande
        </button>
      </div>
    </div>
  );
}

function Checkout({ cart, total, orderType, askName, onBack, onConfirm }) {
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <div className="sheet-backdrop" onClick={onBack}>
      <div className="sheet sheet-narrow" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onBack} aria-label="Fermer">
          <X size={26} />
        </button>
        <div className="checkout">
          <h2>Récapitulatif</h2>
          <p className="checkout-type">{orderType}</p>
          <ul className="checkout-list">
            {cart.map((l, i) => (
              <li key={i}>
                <div>
                  <strong>
                    {l.qty} × {l.name}
                  </strong>
                  {l.sizeLabel && <span> · {l.sizeLabel}</span>}
                  {lineDetails(l) && <p>{lineDetails(l)}</p>}
                </div>
                <span>{money(l.totalPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="checkout-total">
            <span>Total à régler au comptoir</span>
            <strong>{money(total)}</strong>
          </div>
          {askName && (
            <label className="checkout-name">
              <span>Votre prénom (facultatif)</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Pour vous appeler quand c'est prêt" autoComplete="off" />
            </label>
          )}
          <div className="checkout-actions">
            <button className="btn-ghost btn-xl" onClick={onBack}>
              Modifier
            </button>
            <button
              className="btn-primary btn-xl"
              disabled={sending}
              onClick={() => {
                setSending(true);
                onConfirm(name);
              }}
            >
              <Check size={22} /> Confirmer la commande
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Confirmation({ done, settings, onNew }) {
  const [left, setLeft] = useState(25);
  useEffect(() => {
    const iv = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (left <= 0) onNew();
  }, [left, onNew]);
  const { order, printing, errors } = done;
  return (
    <div className="done">
      <div className="welcome-glow" />
      <div className="done-check">
        <Check size={56} strokeWidth={3} />
      </div>
      <h1>Merci{order.clientName ? ` ${order.clientName}` : ""} !</h1>
      <p className="done-sub">Votre numéro de commande</p>
      <div className="done-number">{order.number}</div>
      <p className="done-pay">
        Rendez-vous au comptoir pour régler <strong>{money(order.total)}</strong>
      </p>
      <p className="done-type">{order.orderType}</p>
      <div className={`done-print ${errors.length ? "err" : ""}`}>
        <Printer size={18} />
        {printing ? "Envoi en cuisine…" : errors.length ? "Commande enregistrée — signalez votre numéro au comptoir" : "Votre commande est partie en cuisine"}
      </div>
      <button className="btn-primary btn-xl" onClick={onNew}>
        Nouvelle commande ({left})
      </button>
      {settings.ticketFooter && <p className="done-footer">{settings.ticketFooter}</p>}
    </div>
  );
}

function IdleModal({ confirmMode, onStay, onReset }) {
  const [left, setLeft] = useState(20);
  useEffect(() => {
    if (confirmMode) return;
    const iv = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(iv);
  }, [confirmMode]);
  useEffect(() => {
    if (!confirmMode && left <= 0) onReset();
  }, [left, confirmMode, onReset]);
  return (
    <div className="sheet-backdrop">
      <div className="dialog">
        <h2>{confirmMode ? "Annuler la commande ?" : "Vous êtes toujours là ?"}</h2>
        <p>{confirmMode ? "Votre panier sera vidé." : `Votre commande sera annulée dans ${left} s.`}</p>
        <div className="dialog-actions">
          <button className="btn-ghost btn-xl" onClick={onReset}>
            {confirmMode ? "Oui, annuler" : "Recommencer"}
          </button>
          <button className="btn-primary btn-xl" onClick={onStay}>
            {confirmMode ? "Continuer ma commande" : "Je continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
