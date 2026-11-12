import { printSegments } from "./native.js";
import { clientTicket, kitchenTicket } from "./tickets.js";

// Imprime le ticket cuisine (+ ticket client si configuré). Renvoie { ok, errors[] }
export async function printOrderTickets(order, settings, { kitchen = true, client = true } = {}) {
  const errors = [];
  const { kitchen: k, counter: c } = settings.printers;
  if (kitchen) {
    const r = await printSegments(kitchenTicket(order, settings), k, k.copies);
    if (!r.ok) errors.push(`Cuisine : ${r.error}`);
  }
  if (client) {
    if (c.enabled && c.type !== "none") {
      const r = await printSegments(clientTicket(order, settings, c.vat), c, c.copies);
      if (!r.ok) errors.push(`Caisse : ${r.error}`);
    } else if (settings.clientTicketOnKitchen || !kitchen) {
      // pas d'imprimante caisse : ticket client sur l'imprimante cuisine
      const r = await printSegments(clientTicket(order, settings, true), k, 1);
      if (!r.ok && (!kitchen || k.type !== "none")) errors.push(`Ticket client : ${r.error}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
