import { formatDuree } from "../lib/format.js";
import { moduleDeLecon, resume } from "../lib/progression.js";
import { Lien } from "./Lien.jsx";

// Plan de cours en accordéon (modules → leçons). Les leçons sont cliquables si
// l'élève a accès à la formation, ou si la leçon est un aperçu gratuit. Sur la
// page d'une leçon, seul le module en cours est déplié.
export function PlanCours({ formation, acces, terminees = new Set(), leconCourante }) {
  if (!formation.plan.length) return <p className="muted">Le contenu arrive bientôt.</p>;
  const moduleCourant = leconCourante ? moduleDeLecon(formation.plan, leconCourante) : null;

  return (
    <div className="plan">
      {formation.plan.map((module, i) => {
        const { nombre, duree } = resume(module.lecons);
        const faites = module.lecons.filter((l) => terminees.has(l.id)).length;
        const ouvert = moduleCourant ? moduleCourant.id === module.id : true;
        return (
          <details key={module.id} className="plan-module" open={ouvert}>
            <summary>
              <span className="plan-module-titre">
                <span className="muted petit">Module {i + 1}</span>
                {module.titre}
              </span>
              <span className="muted petit plan-module-meta">
                {acces ? `${faites}/${nombre}` : `${nombre} leçon${nombre > 1 ? "s" : ""}`}
                {duree > 0 && ` · ${formatDuree(duree)}`}
              </span>
            </summary>
            <ol>
              {module.lecons.map((lecon) => (
                <LigneLecon key={lecon.id} formation={formation} lecon={lecon} acces={acces}
                  faite={terminees.has(lecon.id)} courante={lecon.id === leconCourante} />
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}

function LigneLecon({ formation, lecon, acces, faite, courante }) {
  const ouverte = acces || lecon.apercu_gratuit;
  const contenu = (
    <>
      <span className={`plan-coche ${faite ? "faite" : ""}`} aria-hidden>
        {faite ? "✓" : ouverte ? "▶" : "🔒"}
      </span>
      <span className="plan-titre">{lecon.titre}</span>
      {!acces && lecon.apercu_gratuit && <span className="badge badge-doux">Aperçu gratuit</span>}
      <span className="muted plan-duree">{formatDuree(lecon.duree_secondes)}</span>
    </>
  );
  return (
    <li className={courante ? "courante" : ""} aria-current={courante ? "page" : undefined}>
      {ouverte
        ? <Lien to={`/formation/${formation.slug}/lecon/${lecon.id}`} className="plan-lecon">{contenu}</Lien>
        : <div className="plan-lecon verrouillee" title="Disponible après l'inscription">{contenu}</div>}
    </li>
  );
}
