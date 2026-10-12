import { describe, it, expect } from "vitest";
import { formatPrix, parsePrix, formatDuree, formatDureeSaisie, parseDuree, slugify, extraireEmails } from "./format.js";

describe("formatPrix / parsePrix", () => {
  it("affiche Gratuit pour 0", () => expect(formatPrix(0)).toBe("Gratuit"));
  it("formate en euros", () => expect(formatPrix(4990).replace(/\s/g, " ")).toBe("49,90 €"));
  it("parse les saisies courantes", () => {
    expect(parsePrix("49,90")).toBe(4990);
    expect(parsePrix("49.9")).toBe(4990);
    expect(parsePrix("197 €")).toBe(19700);
    expect(parsePrix("")).toBe(0);
  });
  it("rejette les saisies invalides", () => {
    expect(parsePrix("abc")).toBeNull();
    expect(parsePrix("-5")).toBeNull();
    expect(parsePrix("1.999")).toBeNull();
  });
});

describe("formatDuree / parseDuree", () => {
  it("formate", () => {
    expect(formatDuree(45)).toBe("45 s");
    expect(formatDuree(75)).toBe("1 min 15 s");
    expect(formatDuree(600)).toBe("10 min");
    expect(formatDuree(3725)).toBe("1 h 02");
    expect(formatDuree(null)).toBe("");
  });
  it("parse mm:ss et hh:mm:ss", () => {
    expect(parseDuree("12:30")).toBe(750);
    expect(parseDuree("1:02:03")).toBe(3723);
    expect(parseDuree("90")).toBe(90);
    expect(parseDuree("")).toBeNull();
    expect(parseDuree("1h")).toBeNaN();
  });
  it("formatDureeSaisie est relue à l'identique par parseDuree", () => {
    expect(formatDureeSaisie(750)).toBe("12:30");
    expect(formatDureeSaisie(3723)).toBe("1:02:03");
    for (const n of [0, 59, 750, 3723]) expect(parseDuree(formatDureeSaisie(n))).toBe(n);
  });
});

describe("slugify", () => {
  it("produit un slug compatible avec la contrainte SQL", () => {
    expect(slugify("Créer sa boutique en ligne !")).toBe("creer-sa-boutique-en-ligne");
    expect(slugify("  Été  2026 -- Module 1 ")).toBe("ete-2026-module-1");
    expect(slugify("¡!")).toBe("");
  });
});

describe("extraireEmails", () => {
  it("extrait d'un export CSV, dédoublonne et met en minuscules", () => {
    const csv = "Name,Email\nAlice,Alice@Exemple.fr\nBob,bob@test.com;bob@test.com\n";
    expect(extraireEmails(csv)).toEqual(["alice@exemple.fr", "bob@test.com"]);
  });
  it("renvoie un tableau vide sans email", () => expect(extraireEmails("rien")).toEqual([]));
});
