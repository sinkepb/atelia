// Table de routage — pure, testée dans routes.test.js. Pas de dépendance à
// react-router : 6 routes ne le justifient pas.

const ROUTES = [
  ["catalogue", /^\/$/],
  ["connexion", /^\/connexion\/?$/],
  ["mesFormations", /^\/mes-formations\/?$/],
  ["lecon", /^\/formation\/([a-z0-9-]+)\/lecon\/([0-9a-f-]{36})\/?$/, ["slug", "leconId"]],
  ["formation", /^\/formation\/([a-z0-9-]+)\/?$/, ["slug"]],
  ["admin", /^\/admin\/?$/],
  ["adminFormation", /^\/admin\/formation\/([0-9a-f-]{36}|nouvelle)\/?$/, ["id"]],
];

export function matchRoute(pathname) {
  for (const [name, re, keys = []] of ROUTES) {
    const m = pathname.match(re);
    if (m) return { name, params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1]])) };
  }
  return { name: "introuvable", params: {} };
}
