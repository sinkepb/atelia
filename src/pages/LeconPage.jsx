import { useEffect, useState } from "react";
import { chargerFormationParSlug, contenuLecon, estInscrit, leconsTerminees, marquerTerminee } from "../lib/api.js";
import { formationTerminee, leconsAplat, moduleDeLecon, pourcentage, voisines } from "../lib/progression.js";
import { navigate } from "../lib/router.js";
import { useAsync } from "../hooks/useAsync.js";
import { Lien } from "../components/Lien.jsx";
import { PlanCours } from "../components/PlanCours.jsx";
import { LecteurVideo } from "../components/LecteurVideo.jsx";
import { BarreProgression } from "../components/BarreProgression.jsx";
import { Felicitations } from "../components/Felicitations.jsx";
import { Chargement, Erreur, Vide } from "../components/Etat.jsx";
import { useToast } from "../components/Toasts.jsx";

async function charger(slug, leconId, user) {
  const formation = await chargerFormationParSlug(slug);
  if (!formation) return null;
  const [contenu, acces, terminees] = await Promise.all([
    contenuLecon(leconId),
    user ? estInscrit(user.id, formation.id) : false,
    user ? leconsTerminees(user.id) : new Set(),
  ]);
  return { formation, contenu, acces, terminees, leconId };
}

// Flèches ← → du clavier : leçon précédente / suivante, sauf pendant une
// saisie ou quand le lecteur vidéo a le focus (il s'en sert pour avancer).
function useNavigationClavier(precedente, suivante, lien) {
  useEffect(() => {
    function surTouche(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest?.("input, textarea, select, video, [contenteditable]")) return;
      const cible = e.key === "ArrowLeft" ? precedente : e.key === "ArrowRight" ? suivante : null;
      if (cible) navigate(lien(cible));
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [precedente, suivante, lien]);
}

export function LeconPage({ slug, leconId, session }) {
  const { data, chargement, erreur } = useAsync(
    () => charger(slug, leconId, session.user), [slug, leconId, session.user?.id]);
  const toast = useToast();
  const [terminees, setTerminees] = useState(null);
  const [bravo, setBravo] = useState(false);
  const [sommaireOuvert, setSommaireOuvert] = useState(false);

  const plan = data?.formation.plan || [];
  const { precedente, suivante } = voisines(plan, leconId);
  const accessible = (l) => l && (data?.acces || l.apercu_gratuit) ? l : null;
  const lienLecon = (l) => `/formation/${slug}/lecon/${l.id}`;
  useNavigationClavier(accessible(precedente), accessible(suivante), lienLecon);
  useEffect(() => { setSommaireOuvert(false); setBravo(false); }, [leconId]);

  if (!data && chargement) return <main className="conteneur"><Chargement /></main>;
  if (erreur) return <main className="conteneur"><Erreur erreur={erreur} /></main>;
  const lecon = data && leconsAplat(plan).find((l) => l.id === leconId);
  if (!data || !lecon) return <main className="conteneur"><Vide>Leçon introuvable.</Vide></main>;

  const { formation, acces } = data;
  const contenuPret = !chargement && data.leconId === leconId;
  const faites = terminees ?? data.terminees;
  const toutes = leconsAplat(plan);
  const module = moduleDeLecon(plan, leconId);
  const numero = toutes.findIndex((l) => l.id === leconId) + 1;

  async function marquer(fait, { avancer }) {
    try {
      await marquerTerminee(session.user.id, leconId, fait);
      const suivantes = new Set(faites);
      if (fait) suivantes.add(leconId); else suivantes.delete(leconId);
      setTerminees(suivantes);
      if (fait && formationTerminee(plan, suivantes)) { setBravo(true); return; }
      toast(fait ? "Leçon terminée" : "Leçon marquée comme non terminée", fait ? "ok" : "info");
      if (fait && avancer && suivante) navigate(lienLecon(suivante));
    } catch (e) {
      toast(e.message, "erreur");
    }
  }

  return (
    <div className={`lecon-layout ${sommaireOuvert ? "sommaire-ouvert" : ""}`}>
      <aside className="lecon-sommaire" id="sommaire">
        <Lien to={`/formation/${slug}`} className="retour">← {formation.titre}</Lien>
        {acces && <BarreProgression valeur={pourcentage(plan, faites)} />}
        <PlanCours formation={formation} acces={acces} terminees={faites} leconCourante={leconId} />
      </aside>
      <main className="lecon-contenu">
        <button className="btn btn-secondaire bouton-sommaire" aria-controls="sommaire"
          aria-expanded={sommaireOuvert} onClick={() => setSommaireOuvert((o) => !o)}>
          ☰ Programme {acces && `· ${pourcentage(plan, faites)} %`}
        </button>
        <p className="muted petit fil">
          {module?.titre} · Leçon {numero} sur {toutes.length}
        </p>
        <h1>{lecon.titre}</h1>

        {bravo ? <Felicitations formation={formation} onFermer={() => setBravo(false)} /> : !contenuPret ? (
          <div className="video video-attente"><span className="spinner spinner-video" /></div>
        ) : !data.contenu ? (
          <div className="carte carte-pleine verrou">
            <div className="verrou-icone">🔒</div>
            <p>Cette leçon est réservée aux élèves inscrits.</p>
            <Lien to={`/formation/${slug}`} className="btn">Débloquer la formation</Lien>
          </div>
        ) : (
          <div className="apparition" key={leconId}>
            <LecteurVideo type={data.contenu.video_type} reference={data.contenu.video_ref}
              onTerminee={acces && !faites.has(leconId) ? () => marquer(true, { avancer: false }) : undefined} />
            {data.contenu.texte && <div className="texte-lecon">{data.contenu.texte}</div>}
          </div>
        )}

        <div className="lecon-actions">
          {accessible(precedente)
            ? <Lien to={lienLecon(precedente)} className="btn btn-secondaire" title="Flèche gauche">← Précédente</Lien>
            : <span />}
          {acces && (
            <button className={`btn ${faites.has(leconId) ? "btn-ok" : ""}`}
              onClick={() => marquer(!faites.has(leconId), { avancer: true })}>
              {faites.has(leconId) ? "✓ Terminée" : suivante ? "Terminer et continuer →" : "Marquer comme terminée"}
            </button>
          )}
          {accessible(suivante) && !(acces && !faites.has(leconId))
            ? <Lien to={lienLecon(suivante)} className="btn btn-secondaire" title="Flèche droite">Suivante →</Lien>
            : <span />}
        </div>
        <p className="muted petit astuce">Astuce : utilisez les flèches ← → du clavier pour changer de leçon.</p>
      </main>
    </div>
  );
}
