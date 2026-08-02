import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";
import { firebaseConfig } from "../firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ORDERS_PATH = "orders_v2";

// Les deux tablettes (client + cuisine) lisent/écrivent ce même chemin,
// ce qui permet à la commande envoyée sur la tablette client d'apparaître
// quasi instantanément sur la tablette cuisine (et inversement pour les statuts).

export async function loadOrders() {
  try {
    const snap = await get(ref(db, ORDERS_PATH));
    return snap.exists() ? snap.val() : [];
  } catch (e) {
    console.error("Erreur de lecture des commandes :", e);
    return [];
  }
}

export async function saveOrders(orders) {
  try {
    await set(ref(db, ORDERS_PATH), orders);
  } catch (e) {
    console.error("Erreur d'écriture des commandes :", e);
  }
}
