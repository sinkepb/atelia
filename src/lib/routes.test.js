import { describe, it, expect } from "vitest";
import { matchRoute } from "./routes.js";

const ID = "11111111-1111-4111-8111-111111111111";

describe("matchRoute", () => {
  it.each([
    ["/", "catalogue", {}],
    ["/connexion", "connexion", {}],
    ["/mes-formations/", "mesFormations", {}],
    ["/formation/ma-formation", "formation", { slug: "ma-formation" }],
    [`/formation/ma-formation/lecon/${ID}`, "lecon", { slug: "ma-formation", leconId: ID }],
    ["/admin", "admin", {}],
    [`/admin/formation/${ID}`, "adminFormation", { id: ID }],
    ["/admin/formation/nouvelle", "adminFormation", { id: "nouvelle" }],
    ["/nimporte/quoi", "introuvable", {}],
  ])("%s → %s", (path, name, params) => {
    expect(matchRoute(path)).toEqual({ name, params });
  });
});
