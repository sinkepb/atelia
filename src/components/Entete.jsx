import { supabase } from "../lib/supabase.js";
import { navigate } from "../lib/router.js";
import { Lien } from "./Lien.jsx";

export const NOM_SITE = import.meta.env.VITE_SITE_NOM || "Mes formations";

export function Entete({ session }) {
  async function deconnexion() {
    await supabase.auth.signOut();
    navigate("/");
  }
  return (
    <header className="entete">
      <div className="conteneur entete-ligne">
        <Lien to="/" className="logo">{NOM_SITE}</Lien>
        <nav className="nav">
          <Lien to="/">Catalogue</Lien>
          {session.user && <Lien to="/mes-formations">Mes formations</Lien>}
          {session.admin && <Lien to="/admin">Administration</Lien>}
          {session.user
            ? <button className="btn btn-lien" onClick={deconnexion}>Déconnexion</button>
            : <Lien to="/connexion" className="btn btn-secondaire">Connexion</Lien>}
        </nav>
      </div>
    </header>
  );
}
