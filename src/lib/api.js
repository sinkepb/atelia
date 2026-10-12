// Accès aux données du schéma `formations`. Chaque fonction lève une Error
// lisible en cas d'échec ; la RLS fait le filtrage (catalogue public, contenu
// réservé aux inscrits, écriture réservée aux admins).
import { supabase } from "./supabase.js";
import { construirePlan } from "./progression.js";

function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const COLONNES_FORMATION = "id, slug, titre, sous_titre, description, image_url, prix_centimes, devise, publiee, ordre";

// ── Catalogue ────────────────────────────────────────────────────────────────

// Avec le nombre de leçons de chaque formation (agrégat PostgREST embarqué).
export async function listerFormations() {
  const rows = ok(await supabase.from("formations").select(`${COLONNES_FORMATION}, lecons(count)`)
    .order("ordre").order("created_at"));
  return rows.map(({ lecons, ...f }) => ({ ...f, nb_lecons: lecons?.[0]?.count ?? 0 }));
}

export async function mesFormationsIds(userId) {
  const rows = ok(await supabase.from("inscriptions").select("formation_id").eq("user_id", userId));
  return new Set(rows.map((r) => r.formation_id));
}

async function chargerPlan(formationId) {
  const [modules, lecons] = await Promise.all([
    supabase.from("modules").select("id, titre, ordre, created_at").eq("formation_id", formationId).then(ok),
    supabase.from("lecons")
      .select("id, module_id, titre, ordre, duree_secondes, apercu_gratuit, created_at")
      .eq("formation_id", formationId).then(ok),
  ]);
  return construirePlan(modules, lecons);
}

export async function chargerFormationParSlug(slug) {
  const formation = ok(await supabase.from("formations").select(COLONNES_FORMATION).eq("slug", slug).maybeSingle());
  if (!formation) return null;
  return { ...formation, plan: await chargerPlan(formation.id) };
}

export async function chargerFormationParId(id) {
  const formation = ok(await supabase.from("formations").select(COLONNES_FORMATION).eq("id", id).maybeSingle());
  if (!formation) return null;
  return { ...formation, plan: await chargerPlan(formation.id) };
}

// ── Élève ────────────────────────────────────────────────────────────────────

export async function estInscrit(userId, formationId) {
  const row = ok(await supabase.from("inscriptions").select("id")
    .eq("user_id", userId).eq("formation_id", formationId).maybeSingle());
  return Boolean(row);
}

export async function mesInscriptions(userId) {
  return ok(await supabase.from("inscriptions")
    .select(`created_at, formation:formations(${COLONNES_FORMATION})`)
    .eq("user_id", userId).order("created_at", { ascending: false }));
}

export async function leconsTerminees(userId) {
  const rows = ok(await supabase.from("progression").select("lecon_id").eq("user_id", userId));
  return new Set(rows.map((r) => r.lecon_id));
}

export async function marquerTerminee(userId, leconId, terminee) {
  if (terminee) {
    const { error } = await supabase.from("progression").insert({ user_id: userId, lecon_id: leconId });
    if (error && error.code !== "23505") throw new Error(error.message); // déjà terminée : OK
  } else {
    ok(await supabase.from("progression").delete().eq("user_id", userId).eq("lecon_id", leconId));
  }
}

// null si la leçon n'est pas accessible (non inscrit, pas un aperçu).
export async function contenuLecon(leconId) {
  return ok(await supabase.from("lecons_contenu").select("video_type, video_ref, texte")
    .eq("lecon_id", leconId).maybeSingle());
}

export async function urlVideoSignee(chemin) {
  const { data, error } = await supabase.storage.from("formations-videos").createSignedUrl(chemin, 4 * 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function inscriptionGratuite(formationId) {
  ok(await supabase.rpc("inscription_gratuite", { p_formation: formationId }));
}

export async function reclamerInvitations() {
  return ok(await supabase.rpc("reclamer_invitations"));
}

// Redirige vers Stripe Checkout, ou renvoie { dejaInscrit: true }.
export async function acheterFormation(formationId) {
  const { data, error } = await supabase.functions.invoke("formations-checkout", { body: { formationId } });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  if (data?.url) window.location.assign(data.url);
  return data;
}

export async function estAdmin(userId) {
  const row = ok(await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle());
  return Boolean(row);
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function enregistrerFormation(champs) {
  const { id, ...reste } = champs;
  const q = id
    ? supabase.from("formations").update(reste).eq("id", id)
    : supabase.from("formations").insert(reste);
  return ok(await q.select(COLONNES_FORMATION).single());
}

export async function supprimerFormation(id) {
  ok(await supabase.from("formations").delete().eq("id", id));
}

export async function enregistrerModule(module) {
  const { id, ...reste } = module;
  const q = id ? supabase.from("modules").update(reste).eq("id", id) : supabase.from("modules").insert(reste);
  return ok(await q.select("id").single());
}

export async function supprimerModule(id) {
  ok(await supabase.from("modules").delete().eq("id", id));
}

export async function enregistrerLecon(lecon) {
  const { id, ...reste } = lecon;
  // formation_id n'est pas envoyé : le trigger SQL lecons_sync_formation le
  // recopie depuis le module.
  const q = id ? supabase.from("lecons").update(reste).eq("id", id) : supabase.from("lecons").insert(reste);
  return ok(await q.select("id").single());
}

export async function supprimerLecon(id) {
  ok(await supabase.from("lecons").delete().eq("id", id));
}

// Échange l'ordre de deux éléments (modules ou leçons) voisins.
export async function permuterOrdre(table, a, b) {
  await Promise.all([
    supabase.from(table).update({ ordre: b.ordre }).eq("id", a.id).then(ok),
    supabase.from(table).update({ ordre: a.ordre }).eq("id", b.id).then(ok),
  ]);
}

export async function enregistrerContenu(leconId, contenu) {
  ok(await supabase.from("lecons_contenu").upsert({ lecon_id: leconId, ...contenu }));
}

// Envoi direct à l'API Storage en XMLHttpRequest plutôt que via
// supabase.storage.upload() : seul XHR expose la progression de l'envoi,
// indispensable pour une vidéo de plusieurs centaines de Mo. Même endpoint,
// même jeton de session : les policies du bucket s'appliquent à l'identique.
// onProgression(0..100) est appelé au fil de l'envoi.
export async function televerserVideo(chemin, fichier, onProgression) {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error("Session expirée, reconnectez-vous");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/formations-videos/${chemin}`;
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${jeton}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", fichier.type || "video/mp4");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgression?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Échec de l'envoi (${xhr.status})`;
      try { message = JSON.parse(xhr.responseText).message || message; } catch { /* réponse non JSON */ }
      if (xhr.status === 413) message = "Fichier trop volumineux pour la limite du projet Supabase (Storage → Settings)";
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Connexion interrompue pendant l'envoi"));
    xhr.send(fichier);
  });
}

export async function supprimerVideo(chemin) {
  await supabase.storage.from("formations-videos").remove([chemin]);
}

export async function televerserImage(formationId, fichier) {
  const ext = (fichier.name.match(/\.(jpe?g|png|webp)$/i)?.[1] || "jpg").toLowerCase();
  const chemin = `${formationId}/couverture-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("formations-medias")
    .upload(chemin, fichier, { contentType: fichier.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("formations-medias").getPublicUrl(chemin).data.publicUrl;
}

export async function elevesFormation(formationId) {
  return ok(await supabase.rpc("eleves_formation", { p_formation: formationId }));
}

export async function listerInvitations(formationId) {
  return ok(await supabase.from("invitations").select("email, created_at")
    .eq("formation_id", formationId).order("created_at", { ascending: false }));
}

export async function ajouterInvitations(formationId, emails) {
  if (!emails.length) return;
  ok(await supabase.from("invitations")
    .upsert(emails.map((email) => ({ email, formation_id: formationId })), { ignoreDuplicates: true }));
}

export async function supprimerInvitation(formationId, email) {
  ok(await supabase.from("invitations").delete().eq("formation_id", formationId).eq("email", email));
}

export async function retirerAcces(formationId, userId) {
  ok(await supabase.from("inscriptions").delete().eq("formation_id", formationId).eq("user_id", userId));
}

// Nombre de leçons par formation, pour les barres de progression de
// "Mes formations" sans charger chaque plan complet.
export async function leconsParFormation(formationIds) {
  if (!formationIds.length) return {};
  const rows = ok(await supabase.from("lecons").select("id, formation_id").in("formation_id", formationIds));
  const parFormation = {};
  for (const r of rows) (parFormation[r.formation_id] ||= []).push(r.id);
  return parFormation;
}
