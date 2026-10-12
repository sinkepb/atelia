// Formations — Edge Function formations-checkout (11/10/2026)
//
// Crée une session Stripe Checkout (paiement unique) pour l'achat d'une
// formation payante par l'élève connecté. Le prix est relu en base, jamais
// pris dans la requête. L'inscription elle-même n'est créée qu'à réception du
// webhook signé (formations-stripe-webhook), pas au retour du navigateur.
//
// Secrets requis : FORMATIONS_STRIPE_SECRET_KEY, FORMATIONS_APP_URL
// (ex. https://formations.mondomaine.fr — sert aussi d'origine CORS autorisée,
// voir _shared/cors.ts).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorMessage } from "../_shared/errors.ts";
import { urlsRetour } from "../_shared/formationsPaiement.ts";

serve(async (req) => {
  const CORS = corsHeaders(req, {
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: CORS });

  try {
    const appUrl = Deno.env.get("FORMATIONS_APP_URL");
    if (!appUrl) return json({ error: "FORMATIONS_APP_URL non configuré" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Connexion requise" }, 401);
    const user = userData.user;

    const { formationId } = await req.json().catch(() => ({}));
    if (typeof formationId !== "string") return json({ error: "formationId requis" }, 400);

    const db = supabase.schema("formations");
    const { data: formation } = await db.from("formations")
      .select("id, slug, titre, sous_titre, image_url, prix_centimes, devise, publiee")
      .eq("id", formationId)
      .maybeSingle();
    if (!formation || !formation.publiee) return json({ error: "Formation introuvable" }, 404);
    if (formation.prix_centimes <= 0) return json({ error: "Formation gratuite : pas de paiement" }, 400);

    const { data: deja } = await db.from("inscriptions")
      .select("id").eq("user_id", user.id).eq("formation_id", formation.id).maybeSingle();
    if (deja) return json({ dejaInscrit: true });

    const stripe = new Stripe(Deno.env.get("FORMATIONS_STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
    const metadata = { app: "formations", user_id: user.id, formation_id: formation.id };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      customer_email: user.email,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: formation.devise,
          unit_amount: formation.prix_centimes,
          product_data: {
            name: formation.titre,
            description: formation.sous_titre || undefined,
            images: formation.image_url ? [formation.image_url] : undefined,
          },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
      invoice_creation: { enabled: true },
      ...urlsRetour(appUrl, formation.slug),
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: safeErrorMessage(e, "formations-checkout") }, 500);
  }
});
