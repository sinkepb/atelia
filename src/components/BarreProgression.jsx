export function BarreProgression({ valeur }) {
  return (
    <div className="progression" role="progressbar" aria-valuenow={valeur} aria-valuemin={0} aria-valuemax={100}>
      <div className="progression-remplie" style={{ width: `${valeur}%` }} />
      <span className="progression-texte">{valeur} %</span>
    </div>
  );
}
