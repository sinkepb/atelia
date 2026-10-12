import { useEffect, useState } from "react";
import { acheterFormation, chargerFormationParSlug, estInscrit, inscriptionGratuite, leconsTerminees } from "../lib/api.js";
import { formatDuree, formatPrix } from "../lib/format.js";
import { leconAReprendre, leconsAplat, pourcentage } from "../lib/progression.js";
import { navigate, useLocation } from "../lib/router.js";
import { useAsync } from "../hooks/useAsync.js";
import { PlanCours } from "../components/PlanCours.jsx";
import { BarreProgression } from "../components/BarreProgression.jsx";
import { Chargement, Erreur, Vide } from "../components/Etat.jsx";

async function charger(slug, user) {
  const formation = await chargerFormationParSlug(slug);
  if (!formation) return null;
  const [acces, terminees] = user
    ? await Promise.all([estInscrit(user.id, formation.id), leconsTerminees(user.id)])
    : [false, new Set()];
  return { formation, acces, terminees };
}

export function FormationPage({ slug, session }) {
  const { query } = useLocation();
  const retourPaiement = query.get("paiement") === "ok";
  const { data, chargement, erreur, recharger } = useAsync(() => charger(slug, session.user), [slug, session.user?.id]);
  const [action, setAction] = useState({ enCours: false, erreur: null });
  const [attentes, setAttentes] = useState(0);

  // Retour de Stripe : l'accès est accordé par le webhook, qui peut arriver
  // quelques secondes après la redirection. On revérifie pendant ~30 s.
  const enAttenteWebhook = retourPaiement && data && !data.acces && attentes < 15;
  useEffect(() => {
    if (!enAttenteWebhook) return;
    const t = setTimeout(() => { setAttentes((n) => n + 1); recharger(); }, 2000);
    return () => clearTimeout(t);
  }, [enAttenteWebhook, attentes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (chargement && !data) return <main className="conteneur"><Chargement /></main>;
  if (erreur) return <main className="conteneur"><Erreur erreur={erreur} /></main>;
  if (!data) return <main className="conteneur"><Vide>Formation introuvable.</Vide></main>;

  const { formation, acces, terminees } = data;
  const lecons = leconsAplat(formation.plan);
  const dureeTotale = lecons.reduce((s, l) => s + (l.duree_secondes || 0), 0);
  const gratuite = formation.prix_centimes === 0;

  async function sInscrire() {
    if (!session.user) {
      navigate(`/connexion?retour=${encodeURIComponent(`/formation/${slug}`)}`);
      return;
    }
    setAction({ enCours: true, erreur: null });
    try {
      if (gratuite) await inscriptionGratuite(formation.id);
      else await acheterFormation(formation.id); // redirige vers Stripe
      recharger();
      setAction({ enCours: false, erreur: null });
    } catch (e) {
      setAction({ enCours: false, erreur: e });
    }
  }

  function commencer() {
    const lecon = leconAReprendre(formation.plan, terminees);
    if (lecon) navigate(`/formation/${slug}/lecon/${lecon.id}`);
  }

  return (
    <main className="conteneur">
      <section className="formation-entete">
        <div>
          <h1>{formation.titre}</h1>
          {formation.sous_titre && <p className="sous-titre">{formation.sous_titre}</p>}
          <p className="muted">
            {formation.plan.length} module{formation.plan.length > 1 ? "s" : ""} · {lecons.length} leçon{lecons.length > 1 ? "s" : ""}
            {dureeTotale > 0 && ` · ${formatDuree(dureeTotale)}`}
          </p>
        </div>
        <aside className="carte carte-achat">
          {formation.image_url && <img src={formation.image_url} alt="" />}
          {acces ? (
            <>
              <BarreProgression valeur={pourcentage(formation.plan, terminees)} />
              <button className="btn btn-large" onClick={commencer} disabled={!lecons.length}>
                {terminees.size ? "Continuer" : "Commencer"}
              </button>
            </>
          ) : (
            <>
              <div className="prix">{formatPrix(formation.prix_centimes, formation.devise)}</div>
              {enAttenteWebhook ? (
                <p className="alerte">Paiement reçu, activation de votre accès…</p>
              ) : (
                <button className="btn btn-large" onClick={sInscrire} disabled={action.enCours}>
                  {action.enCours ? "Un instant…" : gratuite ? "S'inscrire gratuitement" : "Acheter la formation"}
                </button>
              )}
              {retourPaiement && !enAttenteWebhook && (
                <p className="alerte alerte-erreur">
                  L'accès n'est pas encore activé. Rechargez la page dans un instant ou contactez-nous.
                </p>
              )}
              {action.erreur && <Erreur erreur={action.erreur} />}
              <p className="muted petit">Accès à vie · paiement sécurisé par Stripe</p>
            </>
          )}
        </aside>
      </section>

      {formation.description && <section className="description">{formation.description}</section>}

      <section>
        <h2>Programme</h2>
        <PlanCours formation={formation} acces={acces} terminees={terminees} />
      </section>
    </main>
  );
}
