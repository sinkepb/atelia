-- ═══════════════════════════════════════════════════════════════════════════════
-- FORMATIONS — plateforme de cours en ligne (remplacement de Podia)
-- 11/10/2026
--
-- Schéma Postgres DÉDIÉ `formations`, hébergé (pour la preview) dans le
-- projet Supabase « tontour » : aucune table, fonction ou policy existante de
-- tontour n'est touchée, tout vit dans ce schéma (+ deux buckets Storage et
-- leurs policies, préfixés `formations`). Pour passer plus tard sur un projet
-- Supabase dédié, il suffit d'y rejouer ce même fichier.
--
-- ⚠️ Appliquer ce fichier via le SQL Editor (ou psql), PAS `supabase db push`
-- depuis ce dépôt : l'historique de migrations de tontour vit dans son propre
-- dépôt, la CLI refuserait de pousser un historique qui ne correspond pas.
--
-- ⚠️ À FAIRE UNE FOIS dans le dashboard Supabase, sinon l'API REST renvoie
-- "The schema must be one of the following: public, graphql_public" :
--   Project Settings → Data API → Exposed schemas → ajouter `formations`.
--
-- Modèle :
--   formations ─┬─ modules ── lecons ── lecons_contenu (vidéo + texte, protégé)
--               ├─ inscriptions (qui a accès à quoi : gratuit / Stripe / manuel)
--               └─ invitations  (emails importés depuis Podia, réclamés à la
--                                première connexion — voir reclamer_invitations)
--   progression (leçons terminées par élève)
--   admins      (comptes autorisés à éditer le catalogue)
--
-- Sécurité : le plan de cours (titres des leçons) est public pour les
-- formations publiées ; le CONTENU (référence vidéo, texte) n'est lisible que
-- par un élève inscrit, un admin, ou pour une leçon marquée "aperçu gratuit".
-- Les vidéos hébergées sur Supabase Storage suivent la même règle via les
-- policies du bucket privé `formations-videos` (URL signées à durée limitée).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE SCHEMA IF NOT EXISTS formations;
GRANT USAGE ON SCHEMA formations TO anon, authenticated, service_role;

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE formations.admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE formations.formations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titre         text NOT NULL CHECK (length(trim(titre)) > 0),
  sous_titre    text,
  description   text,
  image_url     text,
  prix_centimes integer NOT NULL DEFAULT 0 CHECK (prix_centimes >= 0),
  devise        text NOT NULL DEFAULT 'eur' CHECK (devise ~ '^[a-z]{3}$'),
  publiee       boolean NOT NULL DEFAULT false,
  ordre         integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE formations.modules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL REFERENCES formations.formations(id) ON DELETE CASCADE,
  titre        text NOT NULL,
  ordre        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX modules_formation_idx ON formations.modules (formation_id, ordre);

-- formation_id est dénormalisé (recopié depuis le module par trigger) pour que
-- les policies RLS et l'accès aux vidéos n'aient pas à remonter deux jointures.
CREATE TABLE formations.lecons (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id      uuid NOT NULL REFERENCES formations.modules(id) ON DELETE CASCADE,
  formation_id   uuid NOT NULL REFERENCES formations.formations(id) ON DELETE CASCADE,
  titre          text NOT NULL,
  ordre          integer NOT NULL DEFAULT 0,
  duree_secondes integer CHECK (duree_secondes IS NULL OR duree_secondes >= 0),
  apercu_gratuit boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lecons_module_idx ON formations.lecons (module_id, ordre);
CREATE INDEX lecons_formation_idx ON formations.lecons (formation_id);

CREATE TABLE formations.lecons_contenu (
  lecon_id   uuid PRIMARY KEY REFERENCES formations.lecons(id) ON DELETE CASCADE,
  -- youtube / vimeo : video_ref = identifiant de la vidéo (pas l'URL complète)
  -- supabase        : video_ref = chemin dans le bucket formations-videos,
  --                   toujours "<formation_id>/<lecon_id>/<fichier>"
  -- url             : video_ref = lien https direct vers un fichier vidéo
  --                   hébergé ailleurs (serveur perso, OVH, Bunny, S3…).
  --                   ⚠️ Lien non protégé : visible par quiconque l'obtient.
  video_type text NOT NULL DEFAULT 'aucune'
             CHECK (video_type IN ('aucune', 'youtube', 'vimeo', 'supabase', 'url')),
  video_ref  text,
  texte      text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (video_type = 'aucune' OR coalesce(video_ref, '') <> ''),
  CHECK (video_type <> 'url' OR video_ref ~ '^https://')
);

CREATE TABLE formations.inscriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id      uuid NOT NULL REFERENCES formations.formations(id) ON DELETE CASCADE,
  source            text NOT NULL CHECK (source IN ('gratuit', 'stripe', 'manuel', 'invitation')),
  stripe_session_id text UNIQUE,
  montant_centimes  integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, formation_id)
);
CREATE INDEX inscriptions_formation_idx ON formations.inscriptions (formation_id);

CREATE TABLE formations.invitations (
  email        text NOT NULL CHECK (email = lower(trim(email)) AND email LIKE '%@%'),
  formation_id uuid NOT NULL REFERENCES formations.formations(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email, formation_id)
);

CREATE TABLE formations.progression (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecon_id   uuid NOT NULL REFERENCES formations.lecons(id) ON DELETE CASCADE,
  termine_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lecon_id)
);

-- ── Triggers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION formations.lecons_sync_formation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  SELECT m.formation_id INTO NEW.formation_id
  FROM formations.modules m WHERE m.id = NEW.module_id;
  RETURN NEW;
END $$;

CREATE TRIGGER lecons_sync_formation
  BEFORE INSERT OR UPDATE OF module_id ON formations.lecons
  FOR EACH ROW EXECUTE FUNCTION formations.lecons_sync_formation();

CREATE OR REPLACE FUNCTION formations.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER formations_touch BEFORE UPDATE ON formations.formations
  FOR EACH ROW EXECUTE FUNCTION formations.touch_updated_at();
CREATE TRIGGER lecons_contenu_touch BEFORE UPDATE ON formations.lecons_contenu
  FOR EACH ROW EXECUTE FUNCTION formations.touch_updated_at();

-- ── Fonctions d'accès (SECURITY DEFINER : lues depuis les policies) ─────────

CREATE OR REPLACE FUNCTION formations.est_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM formations.admins a WHERE a.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION formations.a_acces(p_formation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT formations.est_admin()
      OR EXISTS (SELECT 1 FROM formations.inscriptions i
                 WHERE i.formation_id = p_formation AND i.user_id = auth.uid());
$$;

-- Formation visible dans le catalogue (publiée) ou admin.
CREATE OR REPLACE FUNCTION formations.formation_visible(p_formation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT formations.est_admin()
      OR EXISTS (SELECT 1 FROM formations.formations f
                 WHERE f.id = p_formation AND f.publiee);
$$;

-- Contenu d'une leçon lisible : inscrit/admin, ou aperçu gratuit d'une
-- formation publiée.
CREATE OR REPLACE FUNCTION formations.peut_lire_lecon(p_lecon uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM formations.lecons l
    JOIN formations.formations f ON f.id = l.formation_id
    WHERE l.id = p_lecon
      AND (formations.a_acces(l.formation_id) OR (l.apercu_gratuit AND f.publiee))
  );
$$;

-- Accès à un objet du bucket formations-videos, d'après son chemin
-- "<formation_id>/<lecon_id>/<fichier>". Un chemin mal formé (pas des UUID)
-- est refusé au lieu de lever une erreur de cast.
CREATE OR REPLACE FUNCTION formations.peut_lire_video(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_parts text[] := string_to_array(p_name, '/');
  v_uuid  text   := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF formations.est_admin() THEN RETURN true; END IF;
  IF array_length(v_parts, 1) IS DISTINCT FROM 3
     OR v_parts[1] !~ v_uuid OR v_parts[2] !~ v_uuid THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM formations.lecons l
    WHERE l.id = v_parts[2]::uuid
      AND l.formation_id = v_parts[1]::uuid
      AND formations.peut_lire_lecon(l.id)
  );
END $$;

-- ── RPC appelées par le front ────────────────────────────────────────────────

-- Inscription en un clic à une formation gratuite et publiée.
CREATE OR REPLACE FUNCTION formations.inscription_gratuite(p_formation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM formations.formations
                 WHERE id = p_formation AND publiee AND prix_centimes = 0) THEN
    RAISE EXCEPTION 'Formation introuvable ou payante' USING ERRCODE = '42501';
  END IF;
  INSERT INTO formations.inscriptions (user_id, formation_id, source)
  VALUES (auth.uid(), p_formation, 'gratuit')
  ON CONFLICT (user_id, formation_id) DO NOTHING;
END $$;

-- Transforme les invitations (élèves importés depuis Podia) correspondant à
-- l'email du compte connecté en inscriptions. Appelée par le front à chaque
-- connexion. N'agit que si l'email du compte est CONFIRMÉ (email_confirmed_at) :
-- les comptes Auth sont partagés avec l'app tontour, dont on ne maîtrise pas
-- le réglage "Confirm email" — sans ce contrôle, créer un compte par mot de
-- passe avec l'adresse d'un élève invité suffirait à prendre son accès.
CREATE OR REPLACE FUNCTION formations.reclamer_invitations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR v_email = '' THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u
                 WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
                   AND lower(u.email) = v_email) THEN
    RETURN 0;
  END IF;
  INSERT INTO formations.inscriptions (user_id, formation_id, source)
  SELECT auth.uid(), inv.formation_id, 'invitation'
  FROM formations.invitations inv WHERE inv.email = v_email
  ON CONFLICT (user_id, formation_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM formations.invitations WHERE email = v_email;
  RETURN v_count;
END $$;

-- Liste des élèves d'une formation avec leur email (auth.users n'est pas
-- lisible depuis l'API) — réservée aux admins.
CREATE OR REPLACE FUNCTION formations.eleves_formation(p_formation uuid)
RETURNS TABLE (user_id uuid, email text, source text, inscrit_le timestamptz, lecons_terminees bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT formations.est_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT i.user_id, u.email::text, i.source, i.created_at,
           (SELECT count(*) FROM formations.progression p
            JOIN formations.lecons l ON l.id = p.lecon_id
            WHERE p.user_id = i.user_id AND l.formation_id = p_formation)
    FROM formations.inscriptions i
    JOIN auth.users u ON u.id = i.user_id
    WHERE i.formation_id = p_formation
    ORDER BY i.created_at DESC;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA formations FROM PUBLIC;
GRANT EXECUTE ON FUNCTION formations.est_admin(), formations.a_acces(uuid),
  formations.formation_visible(uuid), formations.peut_lire_lecon(uuid),
  formations.peut_lire_video(text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION formations.inscription_gratuite(uuid),
  formations.reclamer_invitations(), formations.eleves_formation(uuid)
  TO authenticated;
-- Fonctions de trigger : exécutées par le propriétaire de la table, aucun rôle
-- API n'a besoin de les appeler directement.

-- ── Privilèges (RLS filtre ensuite ligne par ligne) ──────────────────────────

GRANT SELECT ON formations.formations, formations.modules, formations.lecons,
  formations.lecons_contenu TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON formations.formations, formations.modules,
  formations.lecons, formations.lecons_contenu TO authenticated;
GRANT SELECT ON formations.admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON formations.inscriptions,
  formations.invitations TO authenticated;
GRANT SELECT, INSERT, DELETE ON formations.progression TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA formations TO service_role;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE formations.admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations.formations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations.modules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations.lecons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations.lecons_contenu ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations.inscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations.invitations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations.progression    ENABLE ROW LEVEL SECURITY;

-- admins : chacun peut seulement savoir s'il est admin lui-même. Les admins
-- sont ajoutés en SQL (voir formations/README.md), jamais depuis l'API.
CREATE POLICY admins_self_read ON formations.admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY formations_read ON formations.formations
  FOR SELECT TO anon, authenticated USING (publiee OR formations.est_admin());
CREATE POLICY formations_admin_write ON formations.formations
  FOR ALL TO authenticated
  USING (formations.est_admin()) WITH CHECK (formations.est_admin());

CREATE POLICY modules_read ON formations.modules
  FOR SELECT TO anon, authenticated USING (formations.formation_visible(formation_id));
CREATE POLICY modules_admin_write ON formations.modules
  FOR ALL TO authenticated
  USING (formations.est_admin()) WITH CHECK (formations.est_admin());

CREATE POLICY lecons_read ON formations.lecons
  FOR SELECT TO anon, authenticated USING (formations.formation_visible(formation_id));
CREATE POLICY lecons_admin_write ON formations.lecons
  FOR ALL TO authenticated
  USING (formations.est_admin()) WITH CHECK (formations.est_admin());

CREATE POLICY lecons_contenu_read ON formations.lecons_contenu
  FOR SELECT TO anon, authenticated USING (formations.peut_lire_lecon(lecon_id));
CREATE POLICY lecons_contenu_admin_write ON formations.lecons_contenu
  FOR ALL TO authenticated
  USING (formations.est_admin()) WITH CHECK (formations.est_admin());

-- inscriptions : l'élève lit les siennes ; seules les RPC ci-dessus, le
-- webhook Stripe (service_role) et les admins en créent.
CREATE POLICY inscriptions_self_read ON formations.inscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR formations.est_admin());
CREATE POLICY inscriptions_admin_write ON formations.inscriptions
  FOR ALL TO authenticated
  USING (formations.est_admin()) WITH CHECK (formations.est_admin());

CREATE POLICY invitations_admin ON formations.invitations
  FOR ALL TO authenticated
  USING (formations.est_admin()) WITH CHECK (formations.est_admin());

CREATE POLICY progression_self_read ON formations.progression
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR formations.est_admin());
CREATE POLICY progression_self_insert ON formations.progression
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND formations.peut_lire_lecon(lecon_id));
CREATE POLICY progression_self_delete ON formations.progression
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Storage ──────────────────────────────────────────────────────────────────

-- Vidéos : bucket PRIVÉ, lues uniquement par URL signée (créée par le front
-- après vérification RLS ci-dessous). La taille maximale par fichier reste
-- plafonnée par le réglage global du projet (Storage → Settings).
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('formations-videos', 'formations-videos', false,
        ARRAY['video/mp4', 'video/webm', 'video/quicktime'])
ON CONFLICT (id) DO NOTHING;

-- Médias publics : images de couverture des formations.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('formations-medias', 'formations-medias', true, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY formations_videos_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'formations-videos' AND formations.peut_lire_video(name));
CREATE POLICY formations_videos_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'formations-videos' AND formations.est_admin());
CREATE POLICY formations_videos_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'formations-videos' AND formations.est_admin());
CREATE POLICY formations_videos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'formations-videos' AND formations.est_admin());

CREATE POLICY formations_medias_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'formations-medias' AND formations.est_admin());
CREATE POLICY formations_medias_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'formations-medias' AND formations.est_admin());
CREATE POLICY formations_medias_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'formations-medias' AND formations.est_admin());

COMMIT;
