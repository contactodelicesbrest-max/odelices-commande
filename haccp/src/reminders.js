// Rappels (notifications du téléphone, même appli fermée).
// Toute la liste est recalculée à chaque ouverture de l'appli et à chaque modification.
import { Capacitor } from "@capacitor/core";
import { addDays, dayKey, todayKey } from "./utils.js";
import { effectiveDlc } from "./traceRules.js";
import { CLEAN_FREQ } from "./db.js";

const CHANNEL = "haccp";
const ID_MIN = 1000;
const ID_MAX = 9999;

export const reminderDefaults = { tempTimes: ["10:00", "18:00"], dlc: true, cooling: true, cleaning: true, thermo: true };
export const reminderSettings = (s) => ({ ...reminderDefaults, ...(s?.reminders || {}) });

let LN = null;
async function plugin() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!LN) {
    LN = (await import("@capacitor/local-notifications")).LocalNotifications;
    try {
      await LN.createChannel({ id: CHANNEL, name: "Rappels HACCP", description: "Relevés, refroidissements, dates limites", importance: 4, vibration: true });
    } catch {
      /* déjà créé */
    }
  }
  return LN;
}

export async function askPermission() {
  const ln = await plugin();
  if (!ln) return "unavailable";
  let p = await ln.checkPermissions();
  if (p.display !== "granted") p = await ln.requestPermissions();
  return p.display;
}

const at = (dateKey, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(dateKey + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
};

// Calcule la liste des notifications à programmer
export function buildReminders(data) {
  const r = reminderSettings(data.settings);
  const now = Date.now();
  const list = [];
  let id = ID_MIN;
  const add = (n) => list.push({ id: id++, channelId: CHANNEL, ...n });

  // 1) Relevés de températures : tous les jours aux heures choisies
  (r.tempTimes || []).filter(Boolean).forEach((t, i) => {
    const [hour, minute] = t.split(":").map(Number);
    add({
      title: "🌡️ Relevé des températures",
      body: i === 0 ? "C'est l'heure du relevé du matin (frigos, congélateurs, saladette)." : "C'est l'heure du relevé du soir (frigos, congélateurs, saladette).",
      schedule: { on: { hour, minute }, allowWhileIdle: true },
      extra: { tab: "temps" },
    });
  });

  // 2) Refroidissement / remise en température en cours
  if (r.cooling)
    for (const p of data.process.filter((x) => x.state === "running")) {
      const max = p.kind === "reheat" ? 60 : 120;
      const when = new Date(new Date(p.startAt).getTime() + (max - 15) * 60000);
      if (when.getTime() > now)
        add({
          title: p.kind === "reheat" ? "🔥 Remise en température à vérifier" : "❄️ Refroidissement à terminer",
          body: `${p.product} : plus que 15 min (max ${max === 60 ? "1 h" : "2 h"}). Mesure la température et termine le contrôle.`,
          schedule: { at: when, allowWhileIdle: true },
          extra: { tab: "temps" },
        });
    }

  // 3) Dates limites : la veille à 9 h 30 et le jour même à 9 h 30
  if (r.dlc) {
    const byDay = new Map();
    for (const t of data.trace.filter((x) => x.status === "open" && x.kind !== "frozen")) {
      const d = effectiveDlc(t);
      if (!d) continue;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(t.product);
    }
    for (const [d, products] of [...byDay.entries()].sort()) {
      const veille = dayKey(addDays(new Date(d + "T12:00:00"), -1));
      const names = [...new Set(products)].slice(0, 6).join(", ");
      let w1 = at(veille, "09:30");
      // Produit enregistré après 9 h 30 avec une date limite demain : rappel dans l'heure
      if (w1.getTime() <= now && veille === todayKey() && new Date().getHours() < 21) w1 = new Date(now + 60 * 60000);
      if (w1.getTime() > now) add({ title: "⏰ À consommer demain", body: names, schedule: { at: w1, allowWhileIdle: true }, extra: { tab: "trace" } });
      const w2 = at(d, "09:30");
      if (w2.getTime() > now) add({ title: "⚠️ Dernier jour aujourd'hui", body: `${names} — à utiliser aujourd'hui, sinon à jeter.`, schedule: { at: w2, allowWhileIdle: true }, extra: { tab: "trace" } });
      if (id > ID_MIN + 60) break;
    }
  }

  // 4) Hotte / tâches longues de nettoyage : le jour où c'est à refaire
  if (r.cleaning)
    for (const t of data.cleanTasks.filter((x) => x.hood || ["monthly", "quarterly", "biannual", "yearly"].includes(x.freq))) {
      const last = data.cleanLogs.filter((l) => l.taskId === t.id).sort((a, b) => b.at.localeCompare(a.at))[0];
      const due = last ? dayKey(addDays(new Date(last.at), Math.round(CLEAN_FREQ[t.freq]?.days || 30))) : todayKey();
      let w = at(due, "10:15");
      if (w.getTime() <= now) w = new Date(now + 60 * 60000); // déjà en retard : rappel dans 1 h
      add({ title: "🧽 Nettoyage à faire", body: `${t.name}${last ? "" : " — aucune date notée"}`, schedule: { at: w, allowWhileIdle: true }, extra: { tab: "clean" } });
    }

  // 5) Vérification mensuelle des thermomètres
  if (r.thermo) {
    const last = data.registers.filter((x) => x.type === "thermo").sort((a, b) => b.at.localeCompare(a.at))[0];
    const due = last ? dayKey(addDays(new Date(last.at), 30)) : todayKey();
    let w = at(due, "10:20");
    if (w.getTime() <= now) w = new Date(now + 2 * 60 * 60000);
    add({ title: "🌡️ Vérifier les thermomètres", body: "Contrôle mensuel : thermomètre dans de l'eau avec beaucoup de glace, il doit afficher 0 °C (±1 °C).", schedule: { at: w, allowWhileIdle: true }, extra: { tab: "registers" } });
  }
  return list.filter((n) => n.id <= ID_MAX);
}

let timer = null;
export function scheduleRemindersSoon(data) {
  clearTimeout(timer);
  timer = setTimeout(() => scheduleReminders(data).catch((e) => console.warn("Rappels :", e)), 1500);
}

export async function scheduleReminders(data) {
  const ln = await plugin();
  if (!ln) return;
  const perm = await ln.checkPermissions();
  const pending = await ln.getPending();
  const ours = pending.notifications.filter((n) => n.id >= ID_MIN && n.id <= ID_MAX).map((n) => ({ id: n.id }));
  if (ours.length) await ln.cancel({ notifications: ours });
  if (data.settings?.remindersOff || perm.display !== "granted") return;
  const list = buildReminders(data);
  if (list.length) await ln.schedule({ notifications: list });
}

export async function testReminder() {
  const ln = await plugin();
  if (!ln) throw new Error("Les rappels fonctionnent seulement dans l'appli Android (APK).");
  if ((await askPermission()) !== "granted") throw new Error("Notifications refusées : autorise-les dans les paramètres Android de l'appli.");
  await ln.schedule({
    notifications: [{ id: 999, channelId: CHANNEL, title: "✅ Test des rappels", body: "Les rappels O'Délices HACCP fonctionnent.", schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }],
  });
}

export async function onReminderTap(cb) {
  const ln = await plugin();
  if (!ln) return () => {};
  const h = await ln.addListener("localNotificationActionPerformed", (e) => cb(e.notification?.extra?.tab));
  return () => h.remove();
}
