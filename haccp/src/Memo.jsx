import { EQUIP_TYPES } from "./db.js";
import { OIL_RULES } from "./Huile.jsx";
import { PROCESS } from "./Process.jsx";
import { TRACE_KINDS } from "./Tracabilite.jsx";
import { RECEPTION_TYPES } from "./Reception.jsx";

// Mémo des règles appliquées dans l'appli (à titre d'aide : le texte officiel fait foi).
export default function Memo() {
  return (
    <div className="page memo">
      <div className="alert info">
        Résumé des règles d'hygiène appliquées par l'appli. Il ne remplace pas le texte officiel ni ton Plan de Maîtrise Sanitaire (PMS). En cas de doute : DDPP de ton département.
      </div>

      <h3 className="section-title">🌡️ Températures de conservation</h3>
      <div className="card pad">
        <ul>
          {Object.values(EQUIP_TYPES).map((t) => (
            <li key={t.label}><strong>{t.label}</strong> : {t.rule}</li>
          ))}
        </ul>
        <p className="small muted">Relevé au moins 2 fois par jour (ouverture et fermeture). Toute anomalie = action corrective notée + recontrôle dans l'heure. Source : arrêté du 21 décembre 2009, annexe I.</p>
      </div>

      <h3 className="section-title">🍗 Tes viandes cuites à l'avance</h3>
      <div className="card pad">
        <ol>
          <li><strong>Cuisson</strong> : +63 °C minimum à cœur (+70 °C conseillé pour le poulet et la viande hachée).</li>
          <li><strong>Refroidissement rapide</strong> : de +63 °C à moins de +10 °C en moins de 2 h.</li>
          <li><strong>Stockage</strong> au frigo à +3 °C maximum, étiqueté avec la date de cuisson : <strong>3 jours maximum</strong> (J+3).</li>
          <li><strong>Service</strong> : sortir en saladette (+4 °C max) seulement ce qu'il faut pour le service ; en fin de service, retour au frigo immédiat (si la saladette est restée à +4 °C), sinon jeter.</li>
          <li><strong>Remise en température</strong> à la commande : +63 °C à cœur (plancha). Ce qui a été réchauffé et non servi est jeté.</li>
          <li><strong>Kebab</strong> : broche cuite au fur et à mesure, trancher la partie cuite (+70 °C conseillé), éviter de remettre au froid une broche entamée (sinon : refroidissement rapide en moins de 2 h).</li>
        </ol>
        <p className="small muted">Viandes concernées (modifiable dans Réglages) : poulet mariné/curry/paprika, nuggets, cordon bleu, tenders, égrené de bœuf. Dans l'appli : Accueil → « Cuisson viande » enchaîne automatiquement cuisson → refroidissement → lot en traçabilité (J+3) ; « Réchauffer un lot » clôture le lot.</p>
      </div>

      <h3 className="section-title">🔥 Cuisson, refroidissement, maintien chaud</h3>
      <div className="card pad">
        <ul>
          {Object.values(PROCESS).map((p) => (
            <li key={p.label}><strong>{p.label}</strong> : {p.rule}</li>
          ))}
        </ul>
        <p className="small muted">Source : arrêté du 21 décembre 2009 (annexe IV) et Guide de bonnes pratiques d'hygiène de la restauration.</p>
      </div>

      <h3 className="section-title">🏷️ Traçabilité et DLC</h3>
      <div className="card pad">
        <ul>
          {Object.values(TRACE_KINDS).map((k) => (
            <li key={k.label}><strong>{k.label}</strong> : {k.rule}</li>
          ))}
          <li><strong>DLC</strong> (« à consommer jusqu'au ») dépassée : produit interdit, à jeter.</li>
          <li><strong>DDM</strong> (« de préférence avant ») dépassée : consommable si emballage intact.</li>
          <li>Garder l'étiquette (ou sa photo) de chaque produit utilisé : nom, lot, DLC, fournisseur, estampille sanitaire.</li>
        </ul>
        <p className="small muted">Sources : règlement CE 178/2002 (traçabilité), règlement UE 1169/2011 (DLC/DDM). Conserve tes enregistrements (sauvegarde cloud) : ne supprime pas l'historique.</p>
      </div>

      <h3 className="section-title">🍟 Huile de friture</h3>
      <div className="card pad">
        <p>{OIL_RULES.text}</p>
        <p className="small muted">Sources : décret n° 2008-184 du 26 février 2008 ; règlement (UE) 2017/2158 (acrylamide).</p>
      </div>

      <h3 className="section-title">🚚 Réception des marchandises</h3>
      <div className="card pad">
        <ul>
          {Object.values(RECEPTION_TYPES).map((t) => (
            <li key={t.label}><strong>{t.label}</strong> : {t.rule}</li>
          ))}
          <li>Vérifier emballages, étiquettes, DLC et propreté du véhicule. Refuser les produits non conformes et le noter sur le bon de livraison.</li>
          <li>Ranger immédiatement : surgelés d'abord, puis frais. PEPS : premier entré, premier sorti.</li>
        </ul>
      </div>

      <h3 className="section-title">🧽 Nettoyage et hygiène</h3>
      <div className="card pad">
        <ul>
          <li>Plan de nettoyage écrit (quoi, quand, avec quel produit, qui) et enregistré.</li>
          <li>Produits désinfectants aptes au contact alimentaire, respecter dosage et temps d'action.</li>
          <li>Lavage des mains : à la prise de poste, après les toilettes, après manipulation de produits crus, déchets ou argent.</li>
          <li>Au moins une personne formée à l'hygiène alimentaire (formation HACCP 14 h) dans l'établissement.</li>
        </ul>
        <p className="small muted">Sources : règlement CE 852/2004 ; décret n° 2011-731 (formation hygiène en restauration commerciale).</p>
      </div>
    </div>
  );
}
