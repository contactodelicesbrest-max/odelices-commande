# O'Délices — Appli de commande (tablette client + tablette cuisine)

Ce projet contient l'appli complète :
- **Tablette client** (`?vue=client`) : le client compose sa commande, paiement au comptoir.
- **Tablette cuisine** (`?vue=cuisine`) : suivi des commandes en direct, avec statuts.

Les deux tablettes se synchronisent via une base de données en ligne (Firebase), gratuite.

---

## Étape 1 — Créer la base de données (Firebase)

1. Va sur **console.firebase.google.com**, connecte-toi avec ton compte Google.
2. Clique **"Ajouter un projet"**, donne-lui un nom (ex : `odelices-brest`), continue jusqu'au bout (tu peux désactiver Google Analytics, pas nécessaire).
3. Une fois dans le projet, dans le menu de gauche : **Compilation → Realtime Database** → **"Créer une base de données"**.
   - Choisis une région proche (ex : `europe-west1`).
   - Choisis **"Démarrer en mode test"** (ça suffit pour ce projet, ça donne un accès simple pendant 30 jours — on pourra resserrer les règles plus tard si besoin).
4. Toujours dans la console, clique sur l'icône **⚙️ (Paramètres du projet)** en haut à gauche → **Paramètres du projet**.
5. Tout en bas de la page, section **"Vos applications"** → clique sur l'icône **`</>`** (Web) → donne un nom (ex : `odelices-web`) → **"Enregistrer l'application"**.
6. Un bloc de code `firebaseConfig` apparaît avec des valeurs (`apiKey`, `authDomain`, etc.). **Copie tout ce bloc.**
7. Ouvre le fichier `src/firebaseConfig.js` dans ce projet, et remplace le contenu par ce que tu viens de copier (adapte juste les noms de variables si besoin — la structure est la même).

---

## Étape 2 — Mettre le projet sur GitHub

1. Va sur **github.com**, connecte-toi (ou crée un compte avec ton Gmail).
2. Clique **"New repository"**, nomme-le `odelices-commande`, laisse le reste par défaut, clique **"Create repository"**.
3. Sur la page qui s'affiche, clique **"uploading an existing file"** (ou glisse-dépose).
4. Glisse **tous les fichiers et dossiers de ce projet** dans la zone (sauf le dossier `node_modules` s'il existe — il ne devrait pas être présent).
5. Clique **"Commit changes"**.

---

## Étape 3 — Déployer sur Vercel

1. Va sur **vercel.com**, connecte-toi avec ton compte Google (celui déjà utilisé).
2. Clique **"Add New..." → "Project"**.
3. Choisis le dépôt GitHub `odelices-commande` → **"Import"**.
4. Vercel détecte automatiquement que c'est un projet Vite — laisse les réglages par défaut → clique **"Deploy"**.
5. Après 1-2 minutes, tu obtiens une adresse du type `https://odelices-commande.vercel.app`. C'est ton site en ligne !

---

## Étape 4 — Installer sur les tablettes

**Tablette client (comptoir) :**
1. Ouvre Chrome sur la tablette.
2. Va sur `https://odelices-commande.vercel.app?vue=client`
3. Menu ⋮ (en haut à droite) → **"Ajouter à l'écran d'accueil"**.
4. Une icône apparaît sur la tablette — en l'ouvrant, l'appli se lance en plein écran, comme une vraie appli installée.

**Tablette cuisine :**
1. Même chose avec l'adresse `https://odelices-commande.vercel.app?vue=cuisine`

---

## Pour aller plus loin

- **Verrouiller la tablette client en libre-service** (empêcher de quitter l'appli ou d'accéder aux réglages Android) : l'appli gratuite **Fully Kiosk Browser** (sur le Play Store) permet de transformer la tablette en vraie borne figée sur une seule adresse.
- **Générer un .apk** à partir du site en ligne : le site **pwabuilder.com** permet de générer un fichier `.apk` installable directement à partir de l'adresse Vercel, sans avoir besoin d'Android Studio.
- **Modifier la carte, les prix ou les personnalisations** : tout se trouve dans `src/App.jsx`, dans le tableau `MENU` en haut du fichier.

---

## Développement local (optionnel)

Si tu veux tester le site sur ton ordinateur avant de le déployer :

```bash
npm install
npm run dev
```

Puis ouvre l'adresse affichée dans le terminal (généralement `http://localhost:5173`).

---

# 📋 Appli HACCP (APK Android)

Une deuxième appli, séparée de la prise de commande, pour l'hygiène en cuisine :

| Onglet | Ce qu'on y fait |
|---|---|
| **Accueil** | Ce qu'il reste à faire aujourd'hui + les non-conformités (températures, recontrôles, refroidissements en cours, livraisons refusées, DLC dépassées, huile interdite, nettoyage, stock bas). |
| **Températures** | Relevé matin/soir de tous les équipements, avec les seuils réglementaires par type (viande hachée +2 °C, préparations +3 °C, frais +4 °C, surgelés -18 °C, maintien chaud +63 °C). Hors limites : action corrective obligatoire puis **recontrôle dans l'heure**. Contrôles de **cuisson à cœur, refroidissement rapide (63→10 °C en < 2 h), remise en température (+63 °C en < 1 h) et maintien au chaud**. |
| **Traçabilité** | Produit ouvert, **préparation maison** ou **décongélation** : photo de l'étiquette, lot, fournisseur, DLC/DDM. Durée de conservation calculée (J+3 par défaut), jamais au-delà de la DLC d'origine. **DLC dépassée = produit bloqué / enregistré comme jeté.** |
| **Huile** | Contrôles (% composés polaires, température, aspect), filtrage et changements. 20-25 % = dégradée ; **25 % ou plus = huile interdite** (décret 2008-184) ; alerte au-dessus de **175 °C** (acrylamide). |
| **Nettoyage** | Plan de nettoyage et de désinfection (quoi, quand, avec quel produit) avec un bouton « Fait » et l'historique. Liste de départ modifiable. |
| **Stock** | **Contrôle à réception des livraisons** (T° des produits, emballages, étiquettes, DLC, photo du bon de livraison, acceptation/refus) qui alimente le stock. Quantités, seuils, PEPS, retrait des produits périmés, liste de courses. |
| **Réglages ⚙️** | Équipements et friteuses, **rapports PDF** (températures, cuisson/refroidissement, traçabilité avec photos, huile, réceptions, nettoyage, stock), sauvegarde. **Mémo HACCP** : résumé des règles appliquées et leurs sources. |

> Les seuils et durées appliqués viennent de l'arrêté du 21 décembre 2009, du décret 2008-184 (huiles), du règlement UE 2017/2158 (acrylamide) et du Guide de bonnes pratiques d'hygiène de la restauration. C'est une aide : ton Plan de Maîtrise Sanitaire et les textes officiels font foi.

Les données sont enregistrées **sur le téléphone** (fonctionne sans internet) **et sauvegardées automatiquement dans le cloud** (la même base Firebase que l'appli de commande, dossier `haccp_v1`), photos comprises. Chaque modification part quelques secondes après ; sans réseau, l'envoi se fait dès que la connexion revient. L'icône ☁️ en haut de l'écran montre l'état (vert = sauvegardé, rouge = problème).

Nouveau téléphone / réinstallation : installer l'appli → **Réglages → Récupérer**.

### Si la sauvegarde affiche « Accès refusé »
Dans **console.firebase.google.com** → projet `odelices-brest` → **Realtime Database → Règles**, vérifie que les règles autorisent la lecture/écriture (le mode test expire au bout de 30 jours), par exemple :

```json
{
  "rules": {
    "orders_v2": { ".read": true, ".write": true },
    "haccp_v1": { ".read": true, ".write": true }
  }
}
```

Puis **Publier**. (Ces règles sont ouvertes : n'importe qui ayant l'adresse de la base pourrait lire les données. On pourra ajouter une connexion par mot de passe plus tard si besoin.)

## Récupérer l'APK

L'APK est fabriqué automatiquement par GitHub à chaque modification (onglet **Actions**, ~5 min).

1. Sur le téléphone, va sur la page GitHub du projet → **Releases** → « O'Délices HACCP (dernière version) ».
2. Télécharge **`odelices-haccp.apk`**, ouvre-le, et autorise « Installer des applis inconnues » quand Android le demande.
3. Pour mettre à jour : même chose, le nouvel APK s'installe par-dessus **sans effacer les données**.

(Si besoin, l'APK est aussi dans **Actions** → dernier « APK Android HACCP » → *Artifacts*.)

Version web de la même appli (pour tester sur ordinateur) : `https://odelices-commande.vercel.app/haccp/`.

## Développement

```bash
npm run dev:haccp     # appli HACCP dans le navigateur
npm run apk:sync      # build + copie dans le projet Android (android/)
```
