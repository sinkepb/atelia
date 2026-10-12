# Atelia — plateforme de formations en ligne (remplace Podia)

**Atelia** est un site de formations vidéo : catalogue, page de vente, achat Stripe, lecteur de
leçons avec progression, espace d'administration et import des élèves Podia.

**Base de données (preview) :** schéma Postgres dédié `formations` dans le
projet Supabase **tontour**. Rien n'est créé dans le schéma `public` ni dans
les tables de l'app tontour, à part deux buckets Storage préfixés
`formations-`. Pour passer plus tard sur un projet Supabase dédié, il suffit
d'y rejouer la migration.

| Côté | Emplacement |
|---|---|
| Schéma SQL, RLS, buckets Storage | `supabase/migrations/20261012000000_formations_schema.sql` |
| Paiement Stripe | `supabase/functions/formations-checkout`, `supabase/functions/formations-stripe-webhook` |
| Site (React + Vite) | `src/` |

## Fonctionnalités

- Catalogue public, page de vente par formation (programme, durée, prix)
- Modules → leçons, avec des **aperçus gratuits** visibles sans achat
- Vidéos : fichier sur Supabase Storage (bucket privé, URL signées), YouTube,
  Vimeo, ou lien direct vers un MP4 hébergé ailleurs
- Connexion sans mot de passe (lien magique par email)
- Achat via Stripe Checkout (codes promo acceptés, facture générée), ou inscription gratuite
- Progression : leçons terminées, reprise de la vidéo, bouton « Continuer », félicitations en fin de parcours
- Administration : formations, programme, envoi des vidéos avec progression, élèves, retrait d'accès
- **Import des élèves Podia** : on colle leurs emails, ils retrouvent leur accès à leur première connexion

## Mise en route

### 1. Base de données (projet Supabase tontour)

1. SQL Editor → coller et exécuter `supabase/migrations/20261012000000_formations_schema.sql`.
   ⚠️ Ne pas utiliser `supabase db push` depuis ce dépôt : l'historique de
   migrations de tontour vit dans son propre dépôt, la CLI le refuserait.
2. **Exposer le schéma** : Project Settings → Data API → *Exposed schemas* → ajouter `formations`.
3. Se déclarer admin (après s'être connecté une fois sur le site, pour que le compte existe) :
   ```sql
   insert into formations.admins (user_id)
   select id from auth.users where email = 'votre@email.fr';
   ```

### 2. Authentification

Authentication → URL Configuration → *Redirect URLs* : ajouter
`https://formations.votredomaine.fr/**` (et `http://localhost:5174/**` pour le dev).
Sans ça, le lien magique renvoie vers le *Site URL* du projet (l'app tontour).

⚠️ Les comptes Auth sont partagés avec l'app tontour, et les emails Auth (lien
magique) utilisent les mêmes modèles : les rendre neutres, ou utiliser
`{{ .RedirectTo }}` pour adapter le texte selon le site d'origine. Être
inscrit à une formation ne donne aucun droit dans l'app tontour, et
inversement.

### 3. Stripe

1. Déployer les fonctions (`<ref>` = identifiant du projet tontour) :
   ```sh
   supabase functions deploy formations-checkout --project-ref <ref>
   supabase functions deploy formations-stripe-webhook --project-ref <ref>
   ```
2. Secrets (préfixés `FORMATIONS_` pour ne pas écraser ceux de tontour) :
   ```sh
   supabase secrets set --project-ref <ref> \
     FORMATIONS_STRIPE_SECRET_KEY=sk_... \
     FORMATIONS_STRIPE_WEBHOOK_SECRET=whsec_... \
     FORMATIONS_APP_URL=https://formations.votredomaine.fr
   ```
   Facultatif : `FORMATIONS_ALLOWED_ORIGINS` (URL de preview supplémentaires
   autorisées en CORS, séparées par des virgules).
3. Stripe → Developers → Webhooks : nouvel endpoint
   `https://<ref>.supabase.co/functions/v1/formations-stripe-webhook`,
   événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`.

### 4. Développement

```sh
cp .env.example .env.local   # URL + clé anon du projet tontour
npm install
npm run dev                  # http://localhost:5174
npm run lint && npm test && npm run build
```

### 5. Mise en ligne du site

`npm run build` produit le dossier `dist/`, un ensemble de fichiers
statiques hébergeable n'importe où. Dans tous les cas, ajouter ensuite
l'adresse finale aux *Redirect URLs* (étape 2) et à `FORMATIONS_APP_URL` (étape 3).

**Vercel** : importer le dépôt. `vercel.json` gère les routes et les en-têtes de sécurité.

**Hébergement direct, Apache** (mutualisé OVH, o2switch, Hostinger…) :
1. Créer `.env.local`, puis `npm run build`.
2. Envoyer **le contenu** de `dist/` (FTP / gestionnaire de fichiers) à la
   racine du site ou du sous-domaine, **y compris le fichier caché `.htaccess`**.
   Sans lui, recharger une page comme `/formation/ma-formation` donne une 404.
3. Activer le certificat HTTPS gratuit (Let's Encrypt) dans le panneau de l'hébergeur.

**Hébergement direct, Nginx** (VPS) : voir `nginx.conf.example`.

⚠️ Le site doit être servi à la racine d'un domaine ou sous-domaine
(`https://formations.mondomaine.fr/`), pas dans un sous-dossier.

## Migrer depuis Podia

1. Pour chaque formation : la recréer dans Administration, puis ses modules et ses leçons.
2. Vidéos : les télécharger depuis Podia, puis les envoyer dans chaque leçon
   (ou les héberger ailleurs et coller le lien).
3. Élèves : exporter la liste depuis Podia (Audience → Export CSV), puis coller
   le contenu dans l'onglet « Élèves & accès » de la formation. Chaque élève se
   connecte avec la même adresse et retrouve son accès.

## Où héberger les vidéos ?

| | Supabase Storage | Lien direct (ton serveur) | YouTube (non répertoriée) | Vimeo / Bunny Stream |
|---|---|---|---|---|
| Accès réservé aux acheteurs | ✅ bucket privé + URL signée (4 h) | ❌ quiconque a le lien peut regarder | ❌ idem | ✅ restriction par domaine |
| Coût | inclus dans le plan Pro (100 Go stockés, 250 Go de bande passante), puis ~0,09 $/Go | celui de ton hébergement | gratuit | Vimeo ~20 €/mois ; Bunny quelques €/mois |
| Qualité adaptative (HLS) | ❌ fichier MP4 brut | ❌ fichier MP4 brut | ✅ | ✅ |
| Taille max par fichier | réglage du projet (50 Mo en Free, beaucoup plus en Pro) | aucune | très large | très large |

Les quotas Storage sont ceux du projet tontour, partagés avec son app.

**Lien direct** : déposer le MP4 (H.264/AAC, le plus compatible) sur un
serveur en HTTPS et coller son adresse dans la leçon (type « Lien direct »).
Le serveur doit accepter les requêtes partielles (« Range ») pour qu'on
puisse avancer dans la vidéo : c'est le cas d'Apache, de Nginx et des CDN
courants. Le lien n'étant pas protégé, réserver ce type aux vidéos peu
sensibles.
