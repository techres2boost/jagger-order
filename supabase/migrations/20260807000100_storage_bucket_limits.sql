-- ============================================================================
-- Durcissement des buckets Storage : taille maximale et types MIME autorisés
-- ============================================================================
--
-- POURQUOI :
--
-- Les buckets `avatars` et `menu-images` avaient `file_size_limit = NULL` et
-- `allowed_mime_types = NULL`, c'est-à-dire AUCUNE contrainte côté serveur.
-- Les seules limites existantes étaient celles du navigateur :
--
--   * `avatars`      : ProfileAvatar.tsx vérifie `file.size > 5 Mo` et
--                      `ACCEPTED = [jpeg, png, webp]`
--   * `menu-images`  : admin/menu.tsx vérifie `MAX_IMAGE_BYTES = 2 Mo` et
--                      `accept="image/jpeg,image/png,image/webp"`
--
-- Or ces contrôles vivent dans le client : un appel direct à l'API Storage les
-- ignore entièrement. Combiné à la policy `Avatar upload own` — qui autorise
-- TOUT utilisateur authentifié à écrire dans son dossier `avatars/<uid>/` — cela
-- exposait deux risques concrets :
--
--   1. Abus de stockage / coût : un compte gratuit pouvait pousser des fichiers
--      de taille arbitraire (bucket public, facturé au volume et à l'egress).
--   2. Contenu actif servi depuis un bucket PUBLIC : sans liste MIME, un SVG ou
--      un document HTML pouvait être stocké et servi depuis le domaine Supabase
--      du projet — vecteur de XSS stocké, hors de la portée de la CSP de
--      l'application (qui protège l'origine de l'app, pas celle du stockage).
--
-- On aligne donc la contrainte SERVEUR sur le contrat que le client applique
-- déjà. Aucune régression : les valeurs sont identiques à celles vérifiées côté
-- UI, et les objets déjà stockés ne sont pas affectés (la contrainte ne
-- s'applique qu'aux nouveaux envois).
--
-- `dish-images` (2 Mo, 3 types) et `address-photos` (privé, 2 Mo, 2 types)
-- étaient déjà correctement contraints — laissés inchangés.
-- ============================================================================

BEGIN;

-- 5 Mo : valeur exacte de `MAX_BYTES` dans src/components/ProfileAvatar.tsx.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

-- 2 Mo : valeur exacte de `MAX_IMAGE_BYTES` dans admin/menu.tsx.
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'menu-images';

COMMIT;
