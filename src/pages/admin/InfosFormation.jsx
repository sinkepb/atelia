import { useState } from "react";
import { enregistrerFormation, supprimerFormation, televerserImage } from "../../lib/api.js";
import { parsePrix, slugify } from "../../lib/format.js";
import { navigate } from "../../lib/router.js";
import { Erreur } from "../../components/Etat.jsx";
import { useDialogues } from "../../components/Dialogues.jsx";
import { useToast } from "../../components/Toasts.jsx";

function versFormulaire(f) {
  return {
    titre: f?.titre || "",
    slug: f?.slug || "",
    sous_titre: f?.sous_titre || "",
    description: f?.description || "",
    prix: f ? String((f.prix_centimes / 100).toFixed(2)).replace(".", ",") : "0",
    publiee: f?.publiee || false,
    ordre: f?.ordre ?? 0,
    image_url: f?.image_url || "",
  };
}

export function InfosFormation({ formation, onEnregistre }) {
  const [form, setForm] = useState(() => versFormulaire(formation));
  const [slugManuel, setSlugManuel] = useState(Boolean(formation));
  const [etat, setEtat] = useState({ enCours: false, erreur: null, ok: false });
  const { confirmer } = useDialogues();
  const toast = useToast();

  const maj = (champ) => (e) => {
    const valeur = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({
      ...f,
      [champ]: valeur,
      ...(champ === "titre" && !slugManuel ? { slug: slugify(valeur) } : {}),
    }));
  };

  async function enregistrer(e) {
    e.preventDefault();
    const prix_centimes = parsePrix(form.prix);
    if (prix_centimes === null) return setEtat({ enCours: false, erreur: new Error("Prix invalide"), ok: false });
    if (prix_centimes > 0 && prix_centimes < 50) {
      return setEtat({ enCours: false, erreur: new Error("Stripe exige un prix d'au moins 0,50 €"), ok: false });
    }
    setEtat({ enCours: true, erreur: null, ok: false });
    try {
      const enregistree = await enregistrerFormation({
        ...(formation ? { id: formation.id } : {}),
        titre: form.titre.trim(),
        slug: slugify(form.slug),
        sous_titre: form.sous_titre.trim() || null,
        description: form.description.trim() || null,
        prix_centimes,
        publiee: form.publiee,
        ordre: Number(form.ordre) || 0,
        image_url: form.image_url || null,
      });
      setEtat({ enCours: false, erreur: null, ok: false });
      toast(formation ? "Modifications enregistrées" : "Formation créée — ajoutez maintenant son programme", "ok");
      if (!formation) navigate(`/admin/formation/${enregistree.id}`, { replace: true });
      else onEnregistre();
    } catch (err) {
      const message = /duplicate key|unique/i.test(err.message) ? "Cette adresse (slug) est déjà utilisée" : err.message;
      setEtat({ enCours: false, erreur: new Error(message), ok: false });
    }
  }

  async function changerImage(e) {
    const fichier = e.target.files?.[0];
    if (!fichier || !formation) return;
    setEtat({ enCours: true, erreur: null, ok: false });
    try {
      const url = await televerserImage(formation.id, fichier);
      setForm((f) => ({ ...f, image_url: url }));
      setEtat({ enCours: false, erreur: null, ok: false });
      toast("Image chargée — pensez à enregistrer", "info");
    } catch (err) {
      setEtat({ enCours: false, erreur: err, ok: false });
    }
  }

  async function supprimer() {
    const ok = await confirmer({
      titre: "Supprimer cette formation ?",
      message: `« ${formation.titre} », son programme et les accès de ses élèves seront supprimés définitivement.`,
      confirmer: "Supprimer", danger: true,
    });
    if (!ok) return;
    try {
      await supprimerFormation(formation.id);
      toast("Formation supprimée", "ok");
      navigate("/admin", { replace: true });
    } catch (err) {
      setEtat({ enCours: false, erreur: err, ok: false });
    }
  }

  return (
    <form className="formulaire carte carte-pleine" onSubmit={enregistrer}>
      <label>Titre<input required value={form.titre} onChange={maj("titre")} /></label>
      <label>
        Adresse de la page
        <div className="champ-prefixe">
          <span>/formation/</span>
          <input required value={form.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Minuscules, chiffres et tirets uniquement"
            onChange={(e) => { setSlugManuel(true); maj("slug")(e); }} />
        </div>
      </label>
      <label>Sous-titre<input value={form.sous_titre} onChange={maj("sous_titre")} /></label>
      <label>Description<textarea rows={8} value={form.description} onChange={maj("description")} /></label>
      <div className="ligne-champs">
        <label>Prix (€, 0 = gratuite)<input inputMode="decimal" value={form.prix} onChange={maj("prix")} /></label>
        <label>Ordre dans le catalogue<input type="number" value={form.ordre} onChange={maj("ordre")} /></label>
      </div>
      {formation && (
        <label>
          Image de couverture (JPG/PNG/WebP, 10 Mo max)
          {form.image_url && <img className="apercu-image" src={form.image_url} alt="" />}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changerImage} />
        </label>
      )}
      <label className="case">
        <input type="checkbox" checked={form.publiee} onChange={maj("publiee")} />
        Publiée (visible dans le catalogue)
      </label>
      {etat.erreur && <Erreur erreur={etat.erreur} />}
      <div className="lecon-actions">
        {formation ? <button type="button" className="btn btn-danger" onClick={supprimer}>Supprimer</button> : <span />}
        <button className="btn" disabled={etat.enCours}>{etat.enCours ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}
