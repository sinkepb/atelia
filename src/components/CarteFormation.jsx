import { formatPrix } from "../lib/format.js";
import { Lien } from "./Lien.jsx";

export function CarteFormation({ formation, pied, inscrit }) {
  return (
    <Lien to={`/formation/${formation.slug}`} className="carte carte-formation">
      <div className="carte-image" style={formation.image_url ? { backgroundImage: `url("${formation.image_url}")` } : undefined}>
        {!formation.publiee && <span className="badge">Brouillon</span>}
        {inscrit && <span className="badge badge-ok">Inscrit</span>}
      </div>
      <div className="carte-corps">
        <h3>{formation.titre}</h3>
        {formation.sous_titre && <p className="muted">{formation.sous_titre}</p>}
        {formation.nb_lecons > 0 && (
          <p className="muted petit">{formation.nb_lecons} leçon{formation.nb_lecons > 1 ? "s" : ""}</p>
        )}
        <div className="carte-pied">{pied ?? (
          <span className="carte-cta">
            <strong>{inscrit ? "Accéder" : formatPrix(formation.prix_centimes, formation.devise)}</strong>
            <span aria-hidden className="fleche">→</span>
          </span>
        )}</div>
      </div>
    </Lien>
  );
}
