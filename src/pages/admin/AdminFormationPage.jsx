import { useState } from "react";
import { chargerFormationParId } from "../../lib/api.js";
import { useAsync } from "../../hooks/useAsync.js";
import { Lien } from "../../components/Lien.jsx";
import { Chargement, Erreur, Vide } from "../../components/Etat.jsx";
import { InfosFormation } from "./InfosFormation.jsx";
import { ProgrammeEditor } from "./ProgrammeEditor.jsx";
import { ElevesPanel } from "./ElevesPanel.jsx";

const ONGLETS = [["infos", "Informations"], ["programme", "Programme"], ["eleves", "Élèves & accès"]];

export function AdminFormationPage({ id }) {
  const nouvelle = id === "nouvelle";
  const [onglet, setOnglet] = useState("infos");
  const { data: formation, chargement, erreur, recharger } = useAsync(
    () => (nouvelle ? Promise.resolve(null) : chargerFormationParId(id)), [id]);

  if (chargement && !formation) return <main className="conteneur"><Chargement /></main>;
  if (erreur) return <main className="conteneur"><Erreur erreur={erreur} /></main>;
  if (!nouvelle && !formation) return <main className="conteneur"><Vide>Formation introuvable.</Vide></main>;

  return (
    <main className="conteneur">
      <Lien to="/admin" className="retour">← Toutes les formations</Lien>
      <div className="titre-actions">
        <h1>{nouvelle ? "Nouvelle formation" : formation.titre}</h1>
        {formation?.publiee && <Lien to={`/formation/${formation.slug}`} className="btn btn-secondaire">Voir la page</Lien>}
      </div>
      {!nouvelle && (
        <div className="onglets" role="tablist">
          {ONGLETS.map(([cle, libelle]) => (
            <button key={cle} role="tab" aria-selected={onglet === cle}
              className={onglet === cle ? "actif" : ""} onClick={() => setOnglet(cle)}>{libelle}</button>
          ))}
        </div>
      )}
      {(nouvelle || onglet === "infos") && <InfosFormation key={formation?.id || "nouvelle"} formation={formation} onEnregistre={recharger} />}
      {!nouvelle && onglet === "programme" && <ProgrammeEditor formation={formation} onChange={recharger} />}
      {!nouvelle && onglet === "eleves" && <ElevesPanel formation={formation} />}
    </main>
  );
}
