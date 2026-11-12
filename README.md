# O'Délices — Borne de commande (APK Android)

Une seule application pour la tablette du restaurant :

- **Borne client** : le client choisit *Sur place* ou *À emporter*, compose sa commande (formats, viandes, sauces, suppléments, « sans oignons »…), valide, puis reçoit un **numéro de commande**. Il paie au comptoir.
- **Impression automatique en cuisine** : chaque commande validée sort sur l'imprimante thermique de la cuisine (Bluetooth ou Wi-Fi/Ethernet). Un ticket client avec les prix et la TVA peut aussi être imprimé.
- **Espace gérant** (protégé par un code PIN) : gestion complète du menu, des ruptures de stock, des imprimantes, et suivi du chiffre du jour.

L'application fonctionne **sans internet** : le menu et les commandes sont enregistrés sur la tablette.

---

## Installer l'APK sur la tablette

1. Copiez le fichier `ODelices-Borne-v2.0.2.apk` sur la tablette (câble USB, Google Drive, e-mail…).
2. Ouvrez-le depuis la tablette. Si Android le demande, autorisez « Installer des applications inconnues » pour l'application qui ouvre le fichier (Fichiers, Drive…).
3. Lancez **O'Délices Borne**.

## Ouvrir l'espace gérant

- Faites un **appui long de 2 secondes sur le logo** (écran d'accueil ou en haut du menu).
- Tapez le code PIN. **Code par défaut : `1234`**. Changez-le tout de suite dans *Réglages → Sécurité*.

## Configurer l'imprimante cuisine

*Espace gérant → Imprimantes → Imprimante cuisine* :

- **Bluetooth** (réglage par défaut, prévu pour la **Sunmi NT311** en 80 mm) : allumez l'imprimante et appairez-la dans *Paramètres Android → Bluetooth* (le code est souvent `0000` ou `1234`). Revenez dans l'appli, touchez « Rechercher », puis choisissez l'imprimante.
- **Wi-Fi / Ethernet** : saisissez l'adresse IP de l'imprimante (port 9100 par défaut). Pour connaître l'IP, imprimez la page de configuration de l'imprimante (en général, maintenez le bouton FEED appuyé à l'allumage).
- Choisissez la largeur de papier (58 mm ou 80 mm), puis touchez **« Imprimer un test »**.
- Si les accents s'impriment mal, désactivez « Imprimer les accents ».

Vous pouvez aussi ajouter une **imprimante caisse** (facultative) pour imprimer le ticket client au comptoir.

Compatible avec la grande majorité des imprimantes thermiques ESC/POS (Epson, Xprinter, Goojprt, Munbyn, Netum, etc.).

## Gérer le menu

- **Menu** : créez, modifiez, réordonnez ou masquez des catégories et des produits. Pour chaque produit, vous pouvez régler :
  - la photo, la description et la TVA (5,5 / 10 / 20 %) ;
  - le prix unique ou les formats (M / L / XL, avec ou sans boisson…) ;
  - les ingrédients que le client peut retirer ;
  - les choix proposés : viandes, sauces, suppléments, boisson… avec un minimum et un maximum, le nombre de choix offerts, le surcoût au-delà, et des règles par format (par exemple : 1 viande en M, 2 en L, 3 en XL ; boisson seulement « avec boisson »).
- Un interrupteur **En stock / Épuisé** sur chaque produit. Le produit apparaît alors grisé sur la borne.
- L'étoile ⭐ marque un produit comme **populaire** : il s'affiche dans l'onglet « Populaires » de la borne.
- **Options** : les listes partagées (sauces, viandes, suppléments, boissons…). Ajouter une sauce ici la rend disponible dans tous les produits qui utilisent cette liste. Chaque option peut aussi être mise en rupture (ex. : plus de Tenders).

## Commandes et chiffre du jour

*Espace gérant → Commandes* :

- chiffre d'affaires, nombre de commandes, panier moyen et meilleures ventes ;
- historique jour par jour, conservé 120 jours ;
- réimpression du ticket cuisine ou client ; commande marquée payée (espèces/carte) ou annulée ;
- rapport du jour imprimé, ou export **PDF** / **Excel (CSV)** à envoyer par e-mail ou sur Drive.

## Mode borne verrouillé

*Réglages → Sécurité → Mode borne verrouillé* : l'application est épinglée et les clients ne peuvent plus en sortir. Le bouton « retour » d'Android est déjà désactivé dans l'appli, et l'écran reste toujours allumé.

## Sauvegarde

*Réglages → Sauvegarde du menu* : exportez le menu et les réglages dans un fichier, pour les restaurer ou les copier sur une autre tablette.

---

## Pour les développeurs

- React + Vite, empaqueté pour Android avec Capacitor 7.
- Code natif (impression ESC/POS en Bluetooth SPP et TCP 9100, mode borne) : `android/app/src/main/java/fr/odelices/borne/`.
- Menu par défaut : `src/lib/defaultData.js`.

```bash
npm install
npm run dev                 # aperçu dans le navigateur (sans impression)
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```

**Signature de l'APK** : placez `odelices-release.keystore` et `keystore.properties` dans `android/`. Ces fichiers ne sont **jamais publiés sur GitHub**. Gardez toujours la même clé : sans elle, Android refuse d'installer les mises à jour par-dessus l'ancienne version. Sans ces fichiers, l'APK est signé avec une clé de débogage.

```properties
storeFile=odelices-release.keystore
storePassword=...
keyAlias=odelices
keyPassword=...
```
