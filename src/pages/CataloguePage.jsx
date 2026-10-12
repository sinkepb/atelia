import { listerFormations, mesFormationsIds } from "../lib/api.js";
import { useAsync } from "../hooks/useAsync.js";
import { CarteFormation } from "../components/CarteFormation.jsx";
import { Erreur, Vide } from "../components/Etat.jsx";
import { SqueletteCartes } from "../components/Squelettes.jsx";
import { NOM_SITE } from "../components/Entete.jsx";

async function charger(user) {
  const [formations, inscrit] = await Promise.all([
    listerFormations(),
    user ? mesFormationsIds(user.id) : new Set(),
  ]);
  return { formations, inscrit };
}

export function CataloguePage({ session }) {
  const { data, chargement, erreur } = useAsync(() => charger(session.user), [session.user?.id]);
  return (
    <main>
      <section className="hero">
        <div className="conteneur">
          <h1>{NOM_SITE}</h1>
          <p className="hero-texte">Apprenez à votre rythme, sur ordinateur ou mobile. Accès à vie aux vidéos et à leurs mises à jour.</p>
          <ul className="hero-points">
            <li>🎬 Vidéos en haute qualité</li>
            <li>📈 Suivi de votre progression</li>
            <li>♾️ Accès illimité</li>
          </ul>
        </div>
      </section>
      <div className="conteneur">
        <h2>Les formations</h2>
        {chargement && !data ? <SqueletteCartes /> : erreur ? <Erreur erreur={erreur} /> : !data.formations.length
          ? <Vide>Aucune formation publiée pour le moment.</Vide>
          : (
            <div className="grille apparition">
              {data.formations.map((f) => <CarteFormation key={f.id} formation={f} inscrit={data.inscrit.has(f.id)} />)}
            </div>
          )}
      </div>
    </main>
  );
}
