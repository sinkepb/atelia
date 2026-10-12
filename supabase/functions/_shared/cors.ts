// Origines autorisées à appeler les edge functions formations depuis un
// navigateur : l'URL du site (FORMATIONS_APP_URL), le serveur de dev local, et
// d'éventuelles URL de preview listées dans FORMATIONS_ALLOWED_ORIGINS
// (séparées par des virgules). Décision pure dans corsOrigin.ts.
import { origineAutorisee, parseAllowlist } from "./corsOrigin.ts";

const ALLOWED_ORIGINS = [
  Deno.env.get("FORMATIONS_APP_URL")?.replace(/\/+$/, ""),
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  ...parseAllowlist(Deno.env.get("FORMATIONS_ALLOWED_ORIGINS")),
].filter((o): o is string => Boolean(o));

export function corsHeaders(req: Request, extra: Record<string, string> = {}): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const isAllowed = origineAutorisee(origin, ALLOWED_ORIGINS);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Vary": "Origin",
    ...extra,
  };
}
