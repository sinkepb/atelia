// Logique pure du paiement des formations (formations-checkout et
// formations-stripe-webhook) — extraite pour être testable sous Vitest sans
// dépendances Deno/Stripe.

export type InscriptionPayee = {
  user_id: string;
  formation_id: string;
  source: "stripe";
  stripe_session_id: string;
  montant_centimes: number | null;
};

type SessionCheckout = {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Session Checkout terminée → ligne à insérer dans formations.inscriptions,
// ou null si la session ne concerne pas une formation ou n'est pas (encore)
// payée (paiement différé : on attendra checkout.session.async_payment_succeeded).
export function inscriptionDepuisSession(session: SessionCheckout): InscriptionPayee | null {
  const meta = session.metadata || {};
  if (meta.app !== "formations") return null;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return null;
  if (!UUID.test(meta.user_id || "") || !UUID.test(meta.formation_id || "")) return null;
  return {
    user_id: meta.user_id,
    formation_id: meta.formation_id,
    source: "stripe",
    stripe_session_id: session.id,
    montant_centimes: session.amount_total ?? null,
  };
}

// URL de retour Stripe : toujours construite depuis FORMATIONS_APP_URL (secret
// de fonction), jamais depuis une valeur envoyée par le navigateur.
export function urlsRetour(appUrl: string, slug: string): { success_url: string; cancel_url: string } {
  const base = appUrl.replace(/\/+$/, "");
  const page = `${base}/formation/${encodeURIComponent(slug)}`;
  return { success_url: `${page}?paiement=ok`, cancel_url: page };
}
