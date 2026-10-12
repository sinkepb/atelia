import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useLocation } from "../lib/router.js";
import { Erreur } from "../components/Etat.jsx";

// Connexion sans mot de passe (lien magique), comme sur Podia : le compte est
// créé au premier lien cliqué. `?retour=/formation/...` ramène l'élève là où
// il était.
export function ConnexionPage() {
  const { query } = useLocation();
  const retour = query.get("retour")?.startsWith("/") ? query.get("retour") : "/mes-formations";
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true); setErreur(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + retour },
    });
    setEnvoi(false);
    if (error) setErreur(error); else setEnvoye(true);
  }

  return (
    <main className="conteneur conteneur-etroit">
      <div className="carte carte-pleine">
        <h1>Connexion</h1>
        {envoye ? (
          <p>
            Un lien de connexion a été envoyé à <strong>{email}</strong>. Ouvrez-le depuis cet
            appareil pour accéder à vos formations.
          </p>
        ) : (
          <form onSubmit={envoyer} className="formulaire">
            <p className="muted">
              Saisissez votre email : vous recevrez un lien pour vous connecter, sans mot de passe.
              Si vous aviez acheté une formation sur notre ancienne plateforme, utilisez la même
              adresse — votre accès sera retrouvé automatiquement.
            </p>
            <label>
              Email
              <input type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </label>
            {erreur && <Erreur erreur={erreur} />}
            <button className="btn" disabled={envoi}>{envoi ? "Envoi…" : "Recevoir mon lien"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
