import { useEffect, useState } from "react";
import { contenuLecon, enregistrerContenu, enregistrerLecon, supprimerVideo, televerserVideo } from "../../lib/api.js";
import { formatDureeSaisie, parseDuree } from "../../lib/format.js";
import { VIDEO_TYPES, cheminVideo, extraireIdVimeo, extraireIdYoutube, validerUrlDirecte } from "../../lib/video.js";
import { Chargement, Erreur } from "../../components/Etat.jsx";
import { LecteurVideo } from "../../components/LecteurVideo.jsx";
import { BarreProgression } from "../../components/BarreProgression.jsx";
import { useToast } from "../../components/Toasts.jsx";

const EXTRACTEURS = { youtube: extraireIdYoutube, vimeo: extraireIdVimeo, url: validerUrlDirecte };
const PAR_LIEN = new Set(["youtube", "vimeo", "url"]);

// Lit la durée d'un fichier vidéo local pour pré-remplir le champ.
function dureeFichier(fichier) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(Math.round(v.duration) || null); };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(fichier);
  });
}

export function LeconEditor({ formation, lecon, onFermer }) {
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState(null);
  const [fichier, setFichier] = useState(null);
  const [etat, setEtat] = useState({ enCours: false, erreur: null, message: null });
  const [envoi, setEnvoi] = useState(null); // pourcentage d'upload, null hors envoi
  const toast = useToast();

  useEffect(() => {
    contenuLecon(lecon.id).then((c) => {
      setInitial({ video_type: c?.video_type || "aucune", video_ref: c?.video_ref || null });
      setForm({
      titre: lecon.titre,
      duree: lecon.duree_secondes ? formatDureeSaisie(lecon.duree_secondes) : "",
      apercu_gratuit: lecon.apercu_gratuit,
      video_type: c?.video_type || "aucune",
      video_ref: c?.video_ref || "",
      saisie_url: c && c.video_type !== "supabase" ? c.video_ref || "" : "",
      texte: c?.texte || "",
      });
    }, (e) => setEtat({ enCours: false, erreur: e, message: null }));
  }, [lecon]);

  if (!form) return etat.erreur ? <Erreur erreur={etat.erreur} /> : <Chargement />;

  const maj = (champ) => (e) => {
    const valeur = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [champ]: valeur }));
  };

  async function choisirFichier(e) {
    const f = e.target.files?.[0] || null;
    setFichier(f);
    if (f && !form.duree) {
      const d = await dureeFichier(f);
      if (d) setForm((x) => ({ ...x, duree: formatDureeSaisie(d) }));
    }
  }

  async function enregistrer(e) {
    e.preventDefault();
    const duree = parseDuree(form.duree);
    if (Number.isNaN(duree)) return setEtat({ enCours: false, erreur: new Error("Durée invalide (format mm:ss)"), message: null });

    let video_ref = null;
    if (PAR_LIEN.has(form.video_type)) {
      video_ref = EXTRACTEURS[form.video_type](form.saisie_url);
      if (!video_ref) {
        const aide = form.video_type === "url" ? " — il doit commencer par https:// et pointer vers un fichier MP4 ou WebM" : "";
        return setEtat({ enCours: false, erreur: new Error(`Lien vidéo non reconnu${aide}`), message: null });
      }
    }
    if (form.video_type === "supabase") {
      video_ref = form.video_ref;
      if (!fichier && !video_ref) return setEtat({ enCours: false, erreur: new Error("Choisissez un fichier vidéo"), message: null });
    }

    try {
      if (form.video_type === "supabase" && fichier) {
        setEtat({ enCours: true, erreur: null, message: `Envoi de la vidéo (${Math.round(fichier.size / 1e6)} Mo)…` });
        video_ref = cheminVideo(formation.id, lecon.id, fichier.name);
        setEnvoi(0);
        await televerserVideo(video_ref, fichier, setEnvoi);
        setEnvoi(null);
      }
      setEtat({ enCours: true, erreur: null, message: "Enregistrement…" });
      await enregistrerLecon({ id: lecon.id, titre: form.titre.trim(), duree_secondes: duree, apercu_gratuit: form.apercu_gratuit });
      await enregistrerContenu(lecon.id, {
        video_type: form.video_type,
        video_ref: form.video_type === "aucune" ? null : video_ref,
        texte: form.texte.trim() || null,
      });
      // Fichier hébergé remplacé (nouvel envoi, ou passage à YouTube/Vimeo) :
      // on libère le stockage une fois le nouveau contenu enregistré.
      if (initial.video_type === "supabase" && initial.video_ref && initial.video_ref !== video_ref) {
        await supprimerVideo(initial.video_ref);
      }
      toast("Leçon enregistrée", "ok");
      onFermer(true);
    } catch (err) {
      setEnvoi(null);
      setEtat({ enCours: false, erreur: err, message: null });
    }
  }

  return (
    <form className="formulaire carte carte-pleine" onSubmit={enregistrer}>
      <button type="button" className="retour btn btn-lien" onClick={() => onFermer(false)}>← Retour au programme</button>
      <h2>Modifier la leçon</h2>
      <label>Titre<input required value={form.titre} onChange={maj("titre")} /></label>
      <div className="ligne-champs">
        <label>Durée (mm:ss)<input value={form.duree} placeholder="12:30" onChange={maj("duree")} /></label>
        <label className="case">
          <input type="checkbox" checked={form.apercu_gratuit} onChange={maj("apercu_gratuit")} />
          Aperçu gratuit (visible sans achat)
        </label>
      </div>
      <label>
        Vidéo
        <select value={form.video_type} onChange={maj("video_type")}>
          {VIDEO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      {PAR_LIEN.has(form.video_type) && (
        <label>
          Lien de la vidéo
          <input value={form.saisie_url} onChange={maj("saisie_url")}
            placeholder={{ youtube: "https://youtu.be/…", vimeo: "https://vimeo.com/…", url: "https://videos.mondomaine.fr/lecon-01.mp4" }[form.video_type]} />
          {form.video_type === "url" && (
            <span className="muted petit">
              Le lien n'est pas protégé : toute personne qui l'obtient peut regarder la vidéo.
              Le serveur doit accepter les requêtes partielles (« Range ») pour que l'élève puisse avancer dans la vidéo.
            </span>
          )}
        </label>
      )}
      {form.video_type === "url" && validerUrlDirecte(form.saisie_url) && (
        <LecteurVideo type="url" reference={validerUrlDirecte(form.saisie_url)} />
      )}
      {form.video_type === "supabase" && (
        <label>
          Fichier vidéo (MP4 recommandé)
          {form.video_ref && !fichier && <span className="muted petit">Fichier actuel : {form.video_ref.split("/").pop()}</span>}
          <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={choisirFichier} />
        </label>
      )}
      {form.video_ref && !fichier && form.video_type === "supabase" && (
        <LecteurVideo type="supabase" reference={form.video_ref} />
      )}
      <label>
        Texte de la leçon (notes, liens, exercices)
        <textarea rows={8} value={form.texte} onChange={maj("texte")} />
      </label>
      {etat.erreur && <Erreur erreur={etat.erreur} />}
      {etat.message && <p className="alerte">{etat.message}</p>}
      {envoi !== null && <BarreProgression valeur={envoi} />}
      <div className="lecon-actions">
        <button type="button" className="btn btn-secondaire" onClick={() => onFermer(false)}>Annuler</button>
        <button className="btn" disabled={etat.enCours}>{etat.enCours ? "Patientez…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}
