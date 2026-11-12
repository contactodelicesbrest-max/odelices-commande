// Calcul des prix et validation des choix d'un produit.

export const money = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2).replace(".", ",") + " €";

export function productSizes(p) {
  return p.sizes && p.sizes.length ? p.sizes : [{ id: "_", label: "", price: Number(p.price) || 0 }];
}

export function fromPrice(p) {
  return Math.min(...productSizes(p).map((s) => Number(s.price) || 0));
}

export function linkLimits(link, sizeId) {
  const s = link.bySize && link.bySize[sizeId];
  const min = Number(s ? s.min : link.min) || 0;
  const max = Number(s ? s.max : link.max) || 0;
  // max=0 & min=0 dans une règle "par taille" → groupe masqué pour cette taille
  const hidden = !!s && min === 0 && max === 0;
  return { min, max, hidden };
}

export function linkLabel(link, group) {
  return link.label || group?.name || "Options";
}

// sel = { [linkId]: { [optionId]: qty } }
export function linkCount(sel, linkId) {
  return Object.values(sel[linkId] || {}).reduce((a, b) => a + b, 0);
}

export function computeLine(product, sizeId, sel, groupsById) {
  const sizes = productSizes(product);
  const size = sizes.find((s) => s.id === sizeId) || sizes[0];
  let unit = Number(size.price) || 0;
  const problems = [];
  const choices = [];

  for (const link of product.links || []) {
    const group = groupsById[link.groupId];
    if (!group) continue;
    const { min, max, hidden } = linkLimits(link, size.id);
    if (hidden) continue;
    const picked = sel[link.id] || {};
    const count = linkCount(sel, link.id);
    let optTotal = 0;
    const items = [];
    for (const o of group.options) {
      const q = picked[o.id] || 0;
      if (!q) continue;
      optTotal += (Number(o.price) || 0) * q;
      items.push({ name: o.name, qty: q });
    }
    const extra = (Number(link.extraPrice) || 0) * Math.max(0, count - (Number(link.free) || 0));
    unit += optTotal + extra;
    if (count < min)
      problems.push({
        linkId: link.id,
        message: min === 1 ? `${linkLabel(link, group)} : faites votre choix` : `${linkLabel(link, group)} : choisissez-en ${min} (${count}/${min})`,
      });
    if (max && count > max) problems.push({ linkId: link.id, message: `${linkLabel(link, group)} : ${max} maximum` });
    if (items.length) choices.push({ label: linkLabel(link, group), items });
  }
  return { size, unit, problems, choices };
}

export function vatBreakdown(items) {
  const groups = {};
  for (const it of items) {
    const r = Number(it.vatRate) || 10;
    groups[r] = (groups[r] || 0) + it.totalPrice;
  }
  return Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map((rate) => {
      const ttc = groups[rate];
      const ht = ttc / (1 + rate / 100);
      return { rate, ttc, ht, tva: ttc - ht };
    });
}
