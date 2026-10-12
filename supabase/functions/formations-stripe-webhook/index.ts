// Formations — Edge Function formations-stripe-webhook (11/10/2026)
//
// Webhook Stripe dédié aux formations : son propre endpoint et son propre
// secret de signature, indépendants de tout autre webhook du projet. À déclarer dans Stripe → Developers → Webhooks avec les
// événements checkout.session.completed et
// checkout.session.async_payment_succeeded.
//
// Secrets requis : FORMATIONS_STRIPE_SECRET_KEY, FORMATIONS_STRIPE_WEBHOOK_SECRET
// (préfixés pour ne pas entrer en collision avec d'éventuels secrets Stripe
// de l'app tontour, les secrets étant partagés par tout le projet Supabase).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.0.0";
import { inscriptionDepuisSession } from "../_shared/formationsPaiement.ts";

const stripe = new Stripe(Deno.env.get("FORMATIONS_STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  const sig = req.headers.get("stripe-signature") || "";
  const body = await req.text();
  let event: Stripe.Event;
  // constructEventAsync (et non constructEvent) : seule variante compatible
  // avec le runtime Deno (constructEvent utilise SubtleCrypto en synchrone,
  // indisponible dans les edge functions, et échoue toujours).
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, Deno.env.get("FORMATIONS_STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (e) {
    console.error("[formations-stripe-webhook] signature invalide", (e as Error).message);
    return new Response("Signature invalide", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const inscription = inscriptionDepuisSession(event.data.object as Stripe.Checkout.Session);
    if (inscription) {
      // ignoreDuplicates : Stripe peut livrer le même événement plusieurs fois,
      // et l'élève peut déjà être inscrit (invitation, ajout manuel).
      const { error } = await supabase.schema("formations").from("inscriptions")
        .upsert(inscription, { onConflict: "user_id,formation_id", ignoreDuplicates: true });
      if (error) {
        console.error("[formations-stripe-webhook] inscription", error.message);
        // 500 → Stripe réessaiera la livraison automatiquement.
        return new Response("Erreur d'enregistrement", { status: 500 });
      }
    }
  }
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
