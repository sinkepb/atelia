import { useEffect } from "react";
import { SUPABASE_CONFIGURE } from "./lib/supabase.js";
import { matchRoute } from "./lib/routes.js";
import { navigate, useLocation } from "./lib/router.js";
import { useSession } from "./hooks/useSession.js";
import { Entete, NOM_SITE } from "./components/Entete.jsx";
import { Chargement, Vide } from "./components/Etat.jsx";
import { CataloguePage } from "./pages/CataloguePage.jsx";
import { ConnexionPage } from "./pages/ConnexionPage.jsx";
import { FormationPage } from "./pages/FormationPage.jsx";
import { LeconPage } from "./pages/LeconPage.jsx";
import { MesFormationsPage } from "./pages/MesFormationsPage.jsx";
import { AdminPage } from "./pages/admin/AdminPage.jsx";
import { AdminFormationPage } from "./pages/admin/AdminFormationPage.jsx";
import { ToastsProvider } from "./components/Toasts.jsx";
import { DialoguesProvider } from "./components/Dialogues.jsx";

const ROUTES_CONNECTE = new Set(["mesFormations", "admin", "adminFormation"]);

function Page({ route, session }) {
  const { name, params } = route;
  if (ROUTES_CONNECTE.has(name) && !session.user) return null; // redirection en cours
  if (name.startsWith("admin") && !session.admin) {
    return <main className="conteneur"><Vide>Accès réservé à l'administrateur.</Vide></main>;
  }
  switch (name) {
    case "catalogue": return <CataloguePage session={session} />;
    case "connexion": return <ConnexionPage />;
    case "formation": return <FormationPage slug={params.slug} session={session} />;
    case "lecon": return <LeconPage slug={params.slug} leconId={params.leconId} session={session} />;
    case "mesFormations": return <MesFormationsPage session={session} />;
    case "admin": return <AdminPage />;
    case "adminFormation": return <AdminFormationPage id={params.id} />;
    default: return <main className="conteneur"><Vide>Page introuvable.</Vide></main>;
  }
}

function Site() {
  const { pathname } = useLocation();
  const session = useSession();
  const route = matchRoute(pathname);

  useEffect(() => {
    if (session.chargement) return;
    if (ROUTES_CONNECTE.has(route.name) && !session.user) {
      navigate(`/connexion?retour=${encodeURIComponent(pathname)}`, { replace: true });
    } else if (route.name === "connexion" && session.user) {
      const retour = new URLSearchParams(window.location.search).get("retour");
      navigate(retour?.startsWith("/") ? retour : "/mes-formations", { replace: true });
    }
  }, [session.chargement, session.user, route.name, pathname]);

  useEffect(() => { document.title = NOM_SITE; }, []);

  return (
    <>
      <Entete session={session} />
      {session.chargement ? <Chargement /> : <Page route={route} session={session} />}
      <footer className="pied conteneur muted petit">© {new Date().getFullYear()} {NOM_SITE}</footer>
    </>
  );
}

export function App() {
  if (!SUPABASE_CONFIGURE) {
    return (
      <main className="conteneur">
        <Vide>Configurez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir formations/.env.example).</Vide>
      </main>
    );
  }
  return (
    <ToastsProvider>
      <DialoguesProvider>
        <Site />
      </DialoguesProvider>
    </ToastsProvider>
  );
}
