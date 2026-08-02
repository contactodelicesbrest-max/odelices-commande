import { emailjsConfig } from "../emailjsConfig.js";

// Envoie un email au client pour le prévenir que sa commande est prête.
// Utilise l'API REST d'EmailJS directement (pas besoin d'installer leur SDK).
export async function sendOrderReadyEmail(order) {
  if (!order.email) return; // pas d'email fourni, on ne fait rien
  const { serviceId, templateId, publicKey } = emailjsConfig;
  if (!serviceId || serviceId.startsWith("COLLE_ICI")) {
    console.warn("EmailJS n'est pas configuré (src/emailjsConfig.js).");
    return;
  }
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: order.email,
          ticket: order.ticket,
        },
      }),
    });
  } catch (e) {
    console.error("Erreur d'envoi de l'email :", e);
  }
}
