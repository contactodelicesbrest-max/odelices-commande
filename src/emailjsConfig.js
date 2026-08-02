// ⚠️ À COMPLÉTER : configuration EmailJS (service gratuit d'envoi d'email
// directement depuis le navigateur, sans serveur).
//
// Comment obtenir ces valeurs :
// 1. Va sur https://www.emailjs.com → crée un compte gratuit.
// 2. "Email Services" → "Add New Service" → connecte ta boîte email
//    (Gmail, Outlook...) → note le "Service ID".
// 3. "Email Templates" → "Create New Template" → crée un modèle avec :
//      - Objet : Votre commande {{ticket}} est prête !
//      - Corps : Bonjour, votre commande O'Délices (numéro {{ticket}})
//                est prête à être récupérée au comptoir. À tout de suite !
//    Assure-toi que le champ "To email" du template contient {{to_email}}.
//    Note le "Template ID".
// 4. "Account" → "General" → copie ta "Public Key".
//
// C'est expliqué pas à pas dans le README.md à la racine du projet.

export const emailjsConfig = {
  serviceId: "COLLE_ICI_TON_SERVICE_ID",
  templateId: "COLLE_ICI_TON_TEMPLATE_ID",
  publicKey: "COLLE_ICI_TA_PUBLIC_KEY",
};
