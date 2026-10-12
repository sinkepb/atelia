import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { estAdmin, reclamerInvitations } from "../lib/api.js";

// Session Supabase Auth + statut admin. À chaque connexion, les invitations
// (élèves importés depuis Podia) liées à l'email sont converties en accès.
export function useSession() {
  const [etat, setEtat] = useState({ chargement: true, user: null, admin: false });

  useEffect(() => {
    let actif = true;
    async function appliquer(session) {
      const user = session?.user ?? null;
      let admin = false;
      if (user) {
        await reclamerInvitations().catch(() => 0);
        admin = await estAdmin(user.id).catch(() => false);
      }
      if (actif) setEtat({ chargement: false, user, admin });
    }
    supabase.auth.getSession().then(({ data }) => appliquer(data.session));
    // Le callback ne doit pas attendre d'appel Supabase (verrou interne de
    // supabase-js) : on diffère le traitement.
    const { data: sub } = supabase.auth.onAuthStateChange((evenement, session) => {
      if (evenement === "INITIAL_SESSION" || evenement === "TOKEN_REFRESHED") return;
      setTimeout(() => appliquer(session), 0);
    });
    return () => { actif = false; sub.subscription.unsubscribe(); };
  }, []);

  return etat;
}
