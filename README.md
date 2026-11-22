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

# Appli « O'Délices Pointage » (signature des heures + export compta)

Appli séparée pour que chaque salarié **vérifie et signe ses heures une fois par mois**. Le gérant exporte ensuite le mois pour le comptable (fiches de paie).

## Utilisation

**Salarié (fin de mois)** : ouvrir l'appli → toucher son nom → vérifier les horaires du mois, semaine par semaine (pré-remplis avec le planning), corriger si besoin (heures en plus, CP, absence…) → signer avec le doigt → cocher « Je certifie » → **Signer mon mois**. Jusqu'au 10 du mois, l'appli propose de signer le mois précédent.

**Gérant** (bouton ⚙ Gérant, code par défaut **1234**, à changer dans l'onglet *Salariés*) :
- **Suivi** (par mois) : qui a signé ou non, détail des heures, signature. Bouton « Déverrouiller » si un salarié doit corriger.
- **Planning** : modifier les horaires prévus de chaque salarié.
  - **→ Semaine suivante** : recopie les horaires de la semaine affichée sur la semaine d'après.
  - **→ Tout le mois de …** : recopie les horaires de la semaine affichée sur **toutes les semaines du mois suivant** (mêmes horaires).
  - **Importer un planning Excel** : même modèle que « Planning nouveau model » (un onglet par semaine, année en A1, n° de semaine en B2).
- **Export compta** : choisir le mois →
  - **Excel** : récap des heures par salarié et par semaine + total du mois (jour par jour, les semaines à cheval sur 2 mois sont coupées), détail de chaque jour, état des signatures.
  - **PDF** : feuille d'heures du mois par salarié, avec sa signature en bas (preuve en cas de contrôle).
  - Sur le téléphone, le menu de partage s'ouvre (Gmail, WhatsApp, Drive…) pour l'envoyer directement au comptable.
- **Salariés** : ajouter / modifier / supprimer, code personnel facultatif (pour qu'un salarié ne puisse pas signer à la place d'un autre).
- **Sauvegarde** : état de la sauvegarde automatique, copie manuelle, restauration.

### Variables de paie et coûts
- **Export Excel → onglet « Variables de paie »** (une ligne par salarié, ce que le comptable saisit) : base mensualisée, heures travaillées, **heures sup HCR** (+10 % de la 36e à la 39e h, +20 % de la 40e à la 43e, +50 % au-delà) ou **heures complémentaires** pour un temps partiel (+10 % / +25 %), jours CP / maladie / absence / férié, **nombre de repas** (avantage en nature), net / brut / coût employeur estimés, alertes. Les heures sup sont calculées par semaine (lundi → dimanche) et rattachées au mois où la semaine se termine.
- Onglets « Semaines » (détail des heures sup par semaine) et « Paramètres » (taux utilisés).
- **Gérant → Coûts** : pour chaque salarié, coût par jour et par semaine (net et coût employeur), coût moyen par jour travaillé et par heure, total de la masse salariale de la semaine.
- Calcul : heures × taux horaire net × majorations → brut (net ÷ (1 − charges salariales)) → coût employeur (brut × (1 + charges patronales)). Les taux se règlent dans *Coûts → Paramètres de calcul* ; le taux net de chaque salarié dans *Salariés*. **Ce sont des estimations : demander au comptable le taux de charges patronales réel** (avec la réduction générale sur les bas salaires).
- **Alertes** droit du travail : plus de 48 h dans la semaine, journée de plus de 11 h 30, moins de 2 jours de repos, taux net sous le SMIC.
- Un salarié coché **« Hors paie »** (gérant / associé) peut signer ses heures mais n'apparaît ni dans l'export compta ni dans les coûts.

### Congés payés / absences
Sur chaque jour, un menu permet de choisir **Travail / CP / Maladie / Absent / Férié** (le gérant dans le Planning, ou le salarié au moment de signer). Le jour n'est alors pas compté en heures travaillées ; les heures qui étaient prévues ce jour-là sont indiquées comme « heures non travaillées ». L'export Excel donne, pour chaque salarié, le nombre de **jours** et d'**heures** de CP, maladie, absence et férié du mois, et le détail jour par jour.

### Sauvegarde automatique sur le téléphone
Dans l'APK, à chaque ouverture (au plus toutes les 3 h) et après chaque signature, l'appli enregistre dans la mémoire du téléphone, dossier **Documents/ODelices-Pointage** (appli « Fichiers ») :
- `sauvegarde-AAAA-MM-JJ.json` : copie complète (salariés, plannings, heures, signatures) — 60 derniers jours gardés ;
- `derniere-sauvegarde.json` : la plus récente ;
- `Pointage_<Mois>_<Année>.xlsx` : l'export comptable du mois en cours et du mois précédent, toujours à jour.

Pour restaurer : Gérant → Sauvegarde → « Choisir une sauvegarde ».

Les données sont dans la même base Firebase que l'appli de commande (dossier `pointage`). Le planning de novembre 2026 (fichier Excel) est chargé automatiquement à la première ouverture.

> ⚠️ Si la base Firebase a été créée en « mode test », les règles expirent au bout de 30 jours : pense à les prolonger dans la console Firebase (Realtime Database → Règles), sinon l'appli ne pourra plus lire/écrire.

## Installer l'APK

1. Copier `ODelices-Pointage.apk` sur le téléphone / la tablette (ou le télécharger : GitHub → onglet **Actions** → « APK Pointage » → dernier run → *Artifacts*).
2. L'ouvrir ; Android demande d'autoriser « l'installation d'applis inconnues » pour cette source → autoriser → Installer.

Sans APK : l'appli marche aussi dans le navigateur avec `https://odelices-commande.vercel.app/?vue=pointage`.

## Reconstruire l'APK après une modification

Automatique : à chaque modification poussée sur GitHub, le workflow « APK Pointage » reconstruit l'APK (onglet Actions).

En local (Node + Java 17 + Android SDK) : `npm install` puis `npm run apk` → `android/app/build/outputs/apk/debug/app-debug.apk`.
