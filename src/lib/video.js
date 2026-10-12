// Sources vidéo des leçons — fonctions pures, testées dans video.test.js.
//
// url : lien https direct vers un fichier lu par la balise <video> du
// navigateur (MP4/WebM). Les playlists HLS (.m3u8) ne sont lues nativement
// que par Safari : on les refuse plutôt que d'afficher un lecteur vide ailleurs.
//
// youtube / vimeo : on stocke l'identifiant seul (pas l'URL), l'admin peut
// coller n'importe quelle forme d'URL. supabase : chemin dans le bucket privé
// formations-videos, toujours "<formation_id>/<lecon_id>/<fichier>" — c'est ce
// format que vérifie la policy SQL formations.peut_lire_video().

export const VIDEO_TYPES = [
  { value: "aucune", label: "Pas de vidéo" },
  { value: "supabase", label: "Fichier hébergé (Supabase Storage)" },
  { value: "youtube", label: "YouTube (non répertoriée)" },
  { value: "vimeo", label: "Vimeo" },
  { value: "url", label: "Lien direct (fichier MP4 hébergé ailleurs)" },
];

export function extraireIdYoutube(saisie) {
  const s = String(saisie ?? "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function extraireIdVimeo(saisie) {
  const s = String(saisie ?? "").trim();
  if (/^\d+(:[\da-f]+)?$/.test(s)) return s; // forme déjà stockée en base
  const m = s.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([\da-f]+))?/);
  if (!m) return null;
  // Vidéo Vimeo "non répertoriée" : l'URL porte un hash de confidentialité
  // (vimeo.com/123/abcdef) qu'il faut conserver pour l'intégration.
  return m[2] ? `${m[1]}:${m[2]}` : m[1];
}

export function urlIntegration(type, ref) {
  if (type === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ref)}?rel=0&modestbranding=1`;
  }
  if (type === "vimeo") {
    const [id, hash] = String(ref).split(":");
    return `https://player.vimeo.com/video/${encodeURIComponent(id)}${hash ? `?h=${encodeURIComponent(hash)}` : ""}`;
  }
  return null;
}

export function cheminVideo(formationId, leconId, nomFichier) {
  const ext = (String(nomFichier).match(/\.(mp4|webm|mov)$/i)?.[1] || "mp4").toLowerCase();
  return `${formationId}/${leconId}/video-${Date.now()}.${ext}`;
}

// Lien direct accepté : https uniquement (une page en https ne peut pas lire
// une vidéo http — contenu mixte bloqué). Renvoie l'URL normalisée ou null.
export function validerUrlDirecte(saisie) {
  let url;
  try { url = new URL(String(saisie ?? "").trim()); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (/\.m3u8$/i.test(url.pathname)) return null;
  return url.href;
}
