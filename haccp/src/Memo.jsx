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
