import { useState } from "react";
import {
  enregistrerLecon, enregistrerModule, permuterOrdre, supprimerLecon, supprimerModule,
} from "../../lib/api.js";
import { formatDuree } from "../../lib/format.js";
import { Erreur, Vide } from "../../components/Etat.jsx";
import { useDialogues } from "../../components/Dialogues.jsx";
import { useToast } from "../../components/Toasts.jsx";
import { LeconEditor } from "./LeconEditor.jsx";

const prochainOrdre = (liste) => (liste.length ? Math.max(...liste.map((x) => x.ordre)) + 1 : 1);

export function ProgrammeEditor({ formation, onChange }) {
  const [leconEditee, setLeconEditee] = useState(null);
  const [erreur, setErreur] = useState(null);
  const { confirmer, demander } = useDialogues();
  const toast = useToast();

  async function executer(action, message) {
    setErreur(null);
    try {
      await action();
      onChange();
      if (message) toast(message, "ok");
    } catch (e) { setErreur(e); }
  }

  async function ajouterModule() {
    const titre = await demander({ titre: "Nouveau module", libelle: "Titre du module", confirmer: "Ajouter" });
    if (titre) {
      executer(() => enregistrerModule({ formation_id: formation.id, titre, ordre: prochainOrdre(formation.plan) }), "Module ajouté");
    }
  }

  async function renommerModule(module) {
    const titre = await demander({ titre: "Renommer le module", libelle: "Titre du module", valeur: module.titre, confirmer: "Renommer" });
    if (titre && titre !== module.titre) executer(() => enregistrerModule({ id: module.id, titre }), "Module renommé");
  }

  async function effacerModule(module) {
    const ok = await confirmer({
      titre: "Supprimer ce module ?",
      message: `« ${module.titre} » et ses ${module.lecons.length} leçon(s) seront supprimés définitivement.`,
      confirmer: "Supprimer", danger: true,
    });
    if (ok) executer(() => supprimerModule(module.id), "Module supprimé");
  }

  async function ajouterLecon(module) {
    const titre = await demander({ titre: "Nouvelle leçon", libelle: "Titre de la leçon", confirmer: "Ajouter" });
    if (titre) {
      executer(async () => {
        const { id } = await enregistrerLecon({ module_id: module.id, titre, ordre: prochainOrdre(module.lecons) });
        // On ouvre directement l'éditeur : l'étape suivante est presque
        // toujours d'y ajouter la vidéo.
        setLeconEditee({ id, module_id: module.id, titre, ordre: prochainOrdre(module.lecons), duree_secondes: null, apercu_gratuit: false });
      });
    }
  }

  async function effacerLecon(lecon) {
    const ok = await confirmer({ titre: "Supprimer cette leçon ?", message: `« ${lecon.titre} » sera supprimée définitivement.`, confirmer: "Supprimer", danger: true });
    if (ok) executer(() => supprimerLecon(lecon.id), "Leçon supprimée");
  }

  if (leconEditee) {
    return (
      <LeconEditor formation={formation} lecon={leconEditee}
        onFermer={(modifie) => { setLeconEditee(null); if (modifie) onChange(); }} />
    );
  }

  return (
    <div className="programme">
      {erreur && <Erreur erreur={erreur} />}
      {!formation.plan.length && (
        <Vide>Commencez par créer un module (ex. « Introduction »), puis ajoutez-y vos leçons.</Vide>
      )}
      {formation.plan.map((module, i) => (
        <section key={module.id} className="carte carte-pleine module-admin">
          <div className="titre-actions">
            <h3>{module.titre}</h3>
            <div className="boutons">
              <button className="btn btn-icone" title="Monter" disabled={i === 0}
                onClick={() => executer(() => permuterOrdre("modules", module, formation.plan[i - 1]))}>↑</button>
              <button className="btn btn-icone" title="Descendre" disabled={i === formation.plan.length - 1}
                onClick={() => executer(() => permuterOrdre("modules", module, formation.plan[i + 1]))}>↓</button>
              <button className="btn btn-lien" onClick={() => renommerModule(module)}>Renommer</button>
              <button className="btn btn-lien danger" onClick={() => effacerModule(module)}>Supprimer</button>
            </div>
          </div>
          {!module.lecons.length && <p className="muted petit">Aucune leçon dans ce module.</p>}
          <ol className="lecons-admin">
            {module.lecons.map((lecon, j) => (
              <li key={lecon.id}>
                <button className="btn btn-lien lecon-titre" onClick={() => setLeconEditee(lecon)}>{lecon.titre}</button>
                {lecon.apercu_gratuit && <span className="badge badge-doux">Aperçu</span>}
                <span className="muted petit">{formatDuree(lecon.duree_secondes)}</span>
                <div className="boutons">
                  <button className="btn btn-icone" title="Monter" disabled={j === 0}
                    onClick={() => executer(() => permuterOrdre("lecons", lecon, module.lecons[j - 1]))}>↑</button>
                  <button className="btn btn-icone" title="Descendre" disabled={j === module.lecons.length - 1}
                    onClick={() => executer(() => permuterOrdre("lecons", lecon, module.lecons[j + 1]))}>↓</button>
                  <button className="btn btn-lien" onClick={() => setLeconEditee(lecon)}>Modifier</button>
                  <button className="btn btn-lien danger" onClick={() => effacerLecon(lecon)}>Supprimer</button>
                </div>
              </li>
            ))}
          </ol>
          <button className="btn btn-secondaire" onClick={() => ajouterLecon(module)}>+ Leçon</button>
        </section>
      ))}
      <button className="btn" onClick={ajouterModule}>+ Module</button>
    </div>
  );
}
