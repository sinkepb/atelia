import { leconsParFormation, leconsTerminees, mesInscriptions } from "../lib/api.js";
import { useAsync } from "../hooks/useAsync.js";
import { CarteFormation } from "../components/CarteFormation.jsx";
import { BarreProgression } from "../components/BarreProgression.jsx";
import { Lien } from "../components/Lien.jsx";
import { Chargement, Erreur, Vide } from "../components/Etat.jsx";

async function charger(userId) {
  const inscriptions = (await mesInscriptions(userId)).filter((i) => i.formation);
  const [parFormation, terminees] = await Promise.all([
    leconsParFormation(inscriptions.map((i) => i.formation.id)),
    leconsTerminees(userId),
  ]);
  return inscriptions.map(({ formation }) => {
    const ids = parFormation[formation.id] || [];
    const faites = ids.filter((id) => terminees.has(id)).length;
    return { formation, avancement: ids.length ? Math.round((faites / ids.length) * 100) : 0 };
  });
}

export function MesFormationsPage({ session }) {
  const { data, chargement, erreur } = useAsync(() => charger(session.user.id), [session.user.id]);
  return (
    <main className="conteneur">
      <h1>Mes formations</h1>
      {chargement ? <Chargement /> : erreur ? <Erreur erreur={erreur} /> : !data.length ? (
        <Vide>
          Vous n'avez encore accès à aucune formation. <Lien to="/">Voir le catalogue</Lien>
        </Vide>
      ) : (
        <div className="grille">
          {data.map(({ formation, avancement }) => (
            <CarteFormation key={formation.id} formation={formation} pied={<BarreProgression valeur={avancement} />} />
          ))}
        </div>
      )}
    </main>
  );
}
