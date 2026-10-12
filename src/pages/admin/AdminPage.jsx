import { listerFormations } from "../../lib/api.js";
import { formatPrix } from "../../lib/format.js";
import { useAsync } from "../../hooks/useAsync.js";
import { Lien } from "../../components/Lien.jsx";
import { Chargement, Erreur, Vide } from "../../components/Etat.jsx";

export function AdminPage() {
  const { data, chargement, erreur } = useAsync(listerFormations, []);
  return (
    <main className="conteneur">
      <div className="titre-actions">
        <h1>Administration</h1>
        <Lien to="/admin/formation/nouvelle" className="btn">+ Nouvelle formation</Lien>
      </div>
      {chargement ? <Chargement /> : erreur ? <Erreur erreur={erreur} /> : !data.length ? (
        <Vide>Aucune formation. Créez la première pour commencer.</Vide>
      ) : (
        <table className="tableau">
          <thead><tr><th>Formation</th><th>Prix</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {data.map((f) => (
              <tr key={f.id}>
                <td><strong>{f.titre}</strong><div className="muted petit">/formation/{f.slug}</div></td>
                <td>{formatPrix(f.prix_centimes, f.devise)}</td>
                <td>{f.publiee ? <span className="badge badge-ok">Publiée</span> : <span className="badge">Brouillon</span>}</td>
                <td className="droite"><Lien to={`/admin/formation/${f.id}`} className="btn btn-secondaire">Modifier</Lien></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
