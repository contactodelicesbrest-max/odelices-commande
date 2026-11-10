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
| **Accueil** | Ce qu'il reste à faire aujourd'hui + les non-conformités (températures hors limites, DLC dépassées, huile à changer, stock bas). |
| **Températures** | Relevé matin/soir de tous les frigos et congélateurs en une fois. Si une température est hors limites, l'appli **oblige** à noter une action corrective. Historique et mini-graphique par appareil. |
| **Traçabilité** | « Produit sorti / ouvert » : **photo de l'étiquette**, n° de lot, fournisseur, DLC, date d'ouverture → l'appli calcule la date limite après ouverture (J+1, J+3…) et prévient la veille. Peut déduire automatiquement la quantité du stock. |
| **Huile** | Pour chaque friteuse : contrôles (% de composés polaires, température, aspect) et changements d'huile. Alerte au-delà de 25 % ou après X jours sans changement. |
| **Stock** | Produits, quantités, seuil mini, emplacement, DLC. Boutons +/− rapides, livraisons, pertes, inventaire, historique des mouvements, **liste de courses** à partager (WhatsApp, SMS, mail). |
| **Réglages ⚙️** | Ajouter / renommer les frigos, congélateurs et friteuses (avec leurs seuils), initiales, **rapports PDF** pour le contrôle sanitaire (températures, traçabilité avec photos, huile, stock) et **sauvegarde / restauration**. |

Les données sont enregistrées **sur le téléphone** (fonctionne sans internet). ⚠️ Pense à faire **Réglages → Sauvegarder** régulièrement (et à envoyer le fichier sur ton Drive/mail) : si le téléphone est perdu, les données le sont aussi.

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
