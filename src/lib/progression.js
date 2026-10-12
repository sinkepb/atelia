// Plan de cours et progression — fonctions pures, testées dans progression.test.js.

// modules + lecons (lignes plates de l'API) → modules triés, chacun avec ses
// leçons triées.
export function construirePlan(modules, lecons) {
  const parOrdre = (a, b) => a.ordre - b.ordre || String(a.created_at).localeCompare(String(b.created_at));
  return [...modules].sort(parOrdre).map((m) => ({
    ...m,
    lecons: lecons.filter((l) => l.module_id === m.id).sort(parOrdre),
  }));
}

export function leconsAplat(plan) {
  return plan.flatMap((m) => m.lecons);
}

export function pourcentage(plan, terminees) {
  const toutes = leconsAplat(plan);
  if (!toutes.length) return 0;
  const faites = toutes.filter((l) => terminees.has(l.id)).length;
  return Math.round((faites / toutes.length) * 100);
}

export function voisines(plan, leconId) {
  const toutes = leconsAplat(plan);
  const i = toutes.findIndex((l) => l.id === leconId);
  return { precedente: i > 0 ? toutes[i - 1] : null, suivante: i >= 0 && i < toutes.length - 1 ? toutes[i + 1] : null };
}

// Leçon où reprendre : la première non terminée, sinon la première.
export function leconAReprendre(plan, terminees) {
  const toutes = leconsAplat(plan);
  return toutes.find((l) => !terminees.has(l.id)) || toutes[0] || null;
}

// Nombre de leçons et durée cumulée (secondes) d'un module ou d'une liste de leçons.
export function resume(lecons) {
  return {
    nombre: lecons.length,
    duree: lecons.reduce((s, l) => s + (l.duree_secondes || 0), 0),
  };
}

// Vrai quand toutes les leçons (au moins une) sont terminées.
export function formationTerminee(plan, terminees) {
  const toutes = leconsAplat(plan);
  return toutes.length > 0 && toutes.every((l) => terminees.has(l.id));
}

// Module contenant une leçon donnée (pour ouvrir l'accordéon au bon endroit).
export function moduleDeLecon(plan, leconId) {
  return plan.find((m) => m.lecons.some((l) => l.id === leconId)) || null;
}
