import { describe, it, expect } from "vitest";
import { construirePlan, pourcentage, voisines, leconAReprendre, resume, formationTerminee, moduleDeLecon } from "./progression.js";

const modules = [{ id: "m2", ordre: 2 }, { id: "m1", ordre: 1 }];
const lecons = [
  { id: "b", module_id: "m1", ordre: 2 },
  { id: "a", module_id: "m1", ordre: 1 },
  { id: "c", module_id: "m2", ordre: 1 },
];
const plan = construirePlan(modules, lecons);

describe("construirePlan", () => {
  it("trie modules et leçons", () => {
    expect(plan.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(plan[0].lecons.map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("pourcentage", () => {
  it("calcule l'avancement", () => {
    expect(pourcentage(plan, new Set())).toBe(0);
    expect(pourcentage(plan, new Set(["a"]))).toBe(33);
    expect(pourcentage(plan, new Set(["a", "b", "c"]))).toBe(100);
  });
  it("0 pour une formation vide", () => expect(pourcentage([], new Set())).toBe(0));
});

describe("voisines", () => {
  it("traverse les modules", () => {
    expect(voisines(plan, "b")).toEqual({ precedente: lecons[1], suivante: lecons[2] });
    expect(voisines(plan, "a").precedente).toBeNull();
    expect(voisines(plan, "c").suivante).toBeNull();
  });
});

describe("leconAReprendre", () => {
  it("première non terminée", () => expect(leconAReprendre(plan, new Set(["a"])).id).toBe("b"));
  it("première si tout est fini", () => expect(leconAReprendre(plan, new Set(["a", "b", "c"])).id).toBe("a"));
  it("null sans leçon", () => expect(leconAReprendre([], new Set())).toBeNull());
});

describe("resume", () => {
  it("compte les leçons et additionne les durées connues", () => {
    expect(resume([{ duree_secondes: 60 }, { duree_secondes: null }, { duree_secondes: 30 }])).toEqual({ nombre: 3, duree: 90 });
    expect(resume([])).toEqual({ nombre: 0, duree: 0 });
  });
});

describe("formationTerminee", () => {
  it("vraie seulement quand tout est fait", () => {
    expect(formationTerminee(plan, new Set(["a", "b"]))).toBe(false);
    expect(formationTerminee(plan, new Set(["a", "b", "c"]))).toBe(true);
  });
  it("fausse pour une formation vide", () => expect(formationTerminee([], new Set())).toBe(false));
});

describe("moduleDeLecon", () => {
  it("retrouve le module", () => {
    expect(moduleDeLecon(plan, "c").id).toBe("m2");
    expect(moduleDeLecon(plan, "zz")).toBeNull();
  });
});
