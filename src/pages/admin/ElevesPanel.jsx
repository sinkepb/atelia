import { useState } from "react";
import {
  ajouterInvitations, elevesFormation, listerInvitations, retirerAcces, supprimerInvitation,
} from "../../lib/api.js";
import { extraireEmails } from "../../lib/format.js";
import { useAsync } from "../../hooks/useAsync.js";
import { Chargement, Erreur, Vide } from "../../components/Etat.jsx";
import { useDialogues } from "../../components/Dialogues.jsx";
import { useToast } from "../../components/Toasts.jsx";

const SOURCES = { gratuit: "Inscription gratuite", stripe: "Achat Stripe", manuel: "Ajout manuel", invitation: "Import / invitation" };

async function charger(formationId) {
  const [eleves, invitations] = await Promise.all([elevesFormation(formationId), listerInvitations(formationId)]);
  return { eleves, invitations };
}

// Élèves inscrits + import des élèves de Podia : on colle leur liste
// d'emails (export CSV Podia → Audience → Export) ; chacun retrouve son accès
// en se connectant avec la même adresse (voir formations.reclamer_invitations).
export function ElevesPanel({ formation }) {
  const { data, chargement, erreur, recharger } = useAsync(() => charger(formation.id), [formation.id]);
  const [saisie, setSaisie] = useState("");
  const [etat, setEtat] = useState({ enCours: false, erreur: null });
  const { confirmer } = useDialogues();
  const toast = useToast();
  const emails = extraireEmails(saisie);

  async function importer(e) {
    e.preventDefault();
    setEtat({ enCours: true, erreur: null });
    try {
      await ajouterInvitations(formation.id, emails);
      setSaisie("");
      setEtat({ enCours: false, erreur: null });
      toast(`${emails.length} accès ajouté${emails.length > 1 ? "s" : ""}`, "ok");
      recharger();
    } catch (err) {
      setEtat({ enCours: false, erreur: err });
    }
  }

  async function executer(action, message) {
    try { await action(); recharger(); toast(message, "ok"); } catch (err) { setEtat({ enCours: false, erreur: err }); }
  }

  async function retirer(eleve) {
    const ok = await confirmer({
      titre: "Retirer l'accès ?",
      message: `${eleve.email} ne pourra plus suivre cette formation. Sa progression est conservée s'il est réinscrit.`,
      confirmer: "Retirer", danger: true,
    });
    if (ok) executer(() => retirerAcces(formation.id, eleve.user_id), "Accès retiré");
  }

  if (chargement && !data) return <Chargement />;
  if (erreur) return <Erreur erreur={erreur} />;

  return (
    <div className="programme">
      <form className="formulaire carte carte-pleine" onSubmit={importer}>
        <h3>Donner accès / importer depuis Podia</h3>
        <p className="muted">
          Collez des adresses email (une par ligne, ou le contenu brut d'un export CSV). Chaque
          personne obtient l'accès à cette formation dès sa première connexion avec cette adresse.
        </p>
        <textarea rows={5} value={saisie} onChange={(e) => setSaisie(e.target.value)}
          placeholder={"alice@exemple.fr\nbob@exemple.fr"} />
        {etat.erreur && <Erreur erreur={etat.erreur} />}
        <button className="btn" disabled={!emails.length || etat.enCours}>
          Donner accès à {emails.length} adresse{emails.length > 1 ? "s" : ""}
        </button>
      </form>

      <section className="carte carte-pleine">
        <h3>Élèves inscrits ({data.eleves.length})</h3>
        {!data.eleves.length ? <Vide>Aucun élève pour le moment.</Vide> : (
          <table className="tableau">
            <thead><tr><th>Email</th><th>Origine</th><th>Depuis le</th><th>Leçons terminées</th><th /></tr></thead>
            <tbody>
              {data.eleves.map((el) => (
                <tr key={el.user_id}>
                  <td>{el.email}</td>
                  <td>{SOURCES[el.source] || el.source}</td>
                  <td>{new Date(el.inscrit_le).toLocaleDateString("fr-FR")}</td>
                  <td>{el.lecons_terminees}</td>
                  <td className="droite">
                    <button className="btn btn-lien danger" onClick={() => retirer(el)}>Retirer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {data.invitations.length > 0 && (
        <section className="carte carte-pleine">
          <h3>En attente de première connexion ({data.invitations.length})</h3>
          <ul className="liste-simple">
            {data.invitations.map((inv) => (
              <li key={inv.email}>
                {inv.email}
                <button className="btn btn-lien danger" onClick={() => executer(() => supprimerInvitation(formation.id, inv.email), "Invitation annulée")}>
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
