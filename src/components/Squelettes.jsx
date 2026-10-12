// Cartes « fantômes » pendant le chargement du catalogue : la mise en page
// apparaît tout de suite, sans saut quand les données arrivent.
export function SqueletteCartes({ nombre = 3 }) {
  return (
    <div className="grille" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="carte">
          <div className="carte-image squelette" />
          <div className="carte-corps">
            <div className="squelette ligne-squelette" style={{ width: "70%" }} />
            <div className="squelette ligne-squelette" style={{ width: "90%" }} />
            <div className="squelette ligne-squelette" style={{ width: "30%", marginTop: 16 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
