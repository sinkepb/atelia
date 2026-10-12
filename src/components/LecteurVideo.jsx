import { useEffect, useState } from "react";
import { urlIntegration } from "../lib/video.js";
import { urlVideoSignee } from "../lib/api.js";
import { Erreur } from "./Etat.jsx";

// Position de lecture mémorisée par vidéo (dans ce navigateur seulement) :
// l'élève reprend là où il s'était arrêté. Sans stockage disponible, la vidéo
// repart simplement du début.
const cle = (reference) => `formations:position:${reference}`;
function lirePosition(reference) {
  try { return Number(localStorage.getItem(cle(reference))) || 0; } catch { return 0; }
}
function ecrirePosition(reference, secondes) {
  try {
    if (secondes > 5) localStorage.setItem(cle(reference), String(Math.floor(secondes)));
    else localStorage.removeItem(cle(reference));
  } catch { /* stockage indisponible : sans conséquence */ }
}

// YouTube / Vimeo : iframe. Supabase Storage : URL signée valable 4 h, créée
// seulement si la policy du bucket autorise l'élève (inscrit ou aperçu).
// Lien direct : lu tel quel par la balise <video>.
// `onTerminee` n'est appelé que pour les fichiers (Supabase ou lien direct) :
// les lecteurs YouTube/Vimeo intégrés ne signalent pas la fin à la page.
export function LecteurVideo({ type, reference, onTerminee }) {
  const [src, setSrc] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    setSrc(null); setErreur(null);
    if (type !== "supabase") return;
    let actif = true;
    urlVideoSignee(reference).then((u) => actif && setSrc(u), (e) => actif && setErreur(e));
    return () => { actif = false; };
  }, [type, reference]);

  if (!type || type === "aucune") return null;
  if (erreur) return <Erreur erreur={erreur} />;

  const embed = urlIntegration(type, reference);
  const fichier = type === "url" ? reference : src;
  return (
    <div className="video">
      {embed && (
        <iframe src={embed} title="Vidéo de la leçon" allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media" />
      )}
      {type === "supabase" && !src && <span className="spinner spinner-video" aria-label="Chargement de la vidéo" />}
      {(type === "supabase" || type === "url") && fichier && (
        <video key={fichier} src={fichier} controls controlsList="nodownload" preload="metadata" playsInline
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={(e) => {
            const pos = lirePosition(reference);
            if (pos && pos < e.currentTarget.duration - 10) e.currentTarget.currentTime = pos;
          }}
          onPause={(e) => ecrirePosition(reference, e.currentTarget.currentTime)}
          onEnded={() => { ecrirePosition(reference, 0); onTerminee?.(); }}
          onError={() => setErreur(new Error("Impossible de lire cette vidéo (lien invalide ou format non pris en charge)."))} />
      )}
    </div>
  );
}
