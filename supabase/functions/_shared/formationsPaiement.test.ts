import { describe, it, expect } from "vitest";
import { inscriptionDepuisSession, urlsRetour } from "./formationsPaiement.ts";

const USER = "00000000-0000-4000-8000-00000000000b";
const FORMATION = "11111111-1111-4111-8111-111111111111";
const session = (over = {}) => ({
  id: "cs_test_1",
  payment_status: "paid",
  amount_total: 9900,
  metadata: { app: "formations", user_id: USER, formation_id: FORMATION },
  ...over,
});

describe("inscriptionDepuisSession", () => {
  it("transforme une session payée en inscription", () => {
    expect(inscriptionDepuisSession(session())).toEqual({
      user_id: USER, formation_id: FORMATION, source: "stripe",
      stripe_session_id: "cs_test_1", montant_centimes: 9900,
    });
  });

  it("ignore une session Stripe étrangère aux formations (pas de metadata app=formations)", () => {
    expect(inscriptionDepuisSession(session({ metadata: { pharmacie_id: "x" } }))).toBeNull();
    expect(inscriptionDepuisSession(session({ metadata: null }))).toBeNull();
  });

  it("attend un paiement différé non encore confirmé", () => {
    expect(inscriptionDepuisSession(session({ payment_status: "unpaid" }))).toBeNull();
  });

  it("accepte une session à 0 € (code promo 100 %)", () => {
    expect(inscriptionDepuisSession(session({ payment_status: "no_payment_required", amount_total: 0 })))
      .toMatchObject({ montant_centimes: 0 });
  });

  it("rejette des identifiants qui ne sont pas des UUID", () => {
    expect(inscriptionDepuisSession(session({ metadata: { app: "formations", user_id: "x", formation_id: FORMATION } }))).toBeNull();
  });
});

describe("urlsRetour", () => {
  it("construit les URL depuis l'origine configurée", () => {
    expect(urlsRetour("https://formations.exemple.fr/", "ma-formation")).toEqual({
      success_url: "https://formations.exemple.fr/formation/ma-formation?paiement=ok",
      cancel_url: "https://formations.exemple.fr/formation/ma-formation",
    });
  });
});
