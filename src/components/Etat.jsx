// États génériques de chargement / erreur / vide.
export function Chargement() {
  return <div className="etat"><span className="spinner" aria-label="Chargement" /></div>;
}

export function Erreur({ erreur }) {
  return <div className="alerte alerte-erreur" role="alert">{erreur?.message || String(erreur)}</div>;
}

export function Vide({ children }) {
  return <div className="etat etat-vide">{children}</div>;
}
