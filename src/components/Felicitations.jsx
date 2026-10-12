import { Lien } from "./Lien.jsx";

const COULEURS = ["#4f46e5", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#ec4899"];

// Carte affichée quand l'élève vient de terminer toutes les leçons, avec une
// pluie de confettis en CSS pur (désactivée si l'utilisateur préfère réduire
// les animations — voir styles.css).
export function Felicitations({ formation, onFermer }) {
  return (
    <div className="felicitations carte carte-pleine" role="status">
      <div className="confettis" aria-hidden>
        {Array.from({ length: 40 }, (_, i) => (
          <i key={i} style={{
            left: `${(i * 37) % 100}%`,
            background: COULEURS[i % COULEURS.length],
            animationDelay: `${(i % 10) * 0.12}s`,
            animationDuration: `${2.2 + (i % 5) * 0.3}s`,
          }} />
        ))}
      </div>
      <div className="felicitations-icone">🎉</div>
      <h2>Bravo, vous avez terminé « {formation.titre} » !</h2>
      <p className="muted">Toutes les leçons restent accessibles : revenez-y quand vous voulez.</p>
      <div className="boutons boutons-centre">
        <Lien to="/mes-formations" className="btn">Mes formations</Lien>
        <button className="btn btn-secondaire" onClick={onFermer}>Revoir la leçon</button>
      </div>
    </div>
  );
}
