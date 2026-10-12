# Atelia — conventions de développement

- Logique pure (formatage, validation, calculs de progression, parsing
  d'URL vidéo, paiement) dans des fichiers `.js`/`.ts` à part, testés avec
  Vitest — jamais enfouie dans un composant.
- Un composant exporté par fichier ; pages dans `src/pages/`, administration
  dans `src/pages/admin/`, composants partagés dans `src/components/`.
- ~400-500 lignes par fichier de composant : au-delà, extraire avant
  d'ajouter la fonctionnalité suivante.
- Base de données : uniquement le schéma `formations` (projet Supabase
  partagé). Ne jamais créer d'objet dans `public` ni toucher aux tables des
  autres applications du projet. Toute modification de schéma = nouveau
  fichier dans `supabase/migrations/`, avec RLS.
- Avant de considérer un changement terminé : `npm run lint`, `npm test`,
  `npm run build`.
