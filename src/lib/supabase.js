import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIGURE = Boolean(url && key);

// Projet Supabase partagé (tontour pour la preview) : toutes les requêtes
// `.from()` visent le schéma dédié `formations` (voir supabase/migrations/).
// Le Storage et les edge functions ne dépendent pas de ce réglage.
export const supabase = SUPABASE_CONFIGURE
  ? createClient(url, key, { db: { schema: "formations" } })
  : null;
