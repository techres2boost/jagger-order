-- ============================================================================
-- F-08 (🟡) : les buckets PUBLICS `avatars`, `dish-images`, `menu-images` ont
-- une policy SELECT large sur storage.objects → n'importe qui peut LISTER tous
-- les fichiers (énumération), pas seulement accéder à une URL d'objet connue.
--
-- Correctif : supprimer ces policies SELECT de listing. L'accès aux objets par
-- URL publique (/storage/v1/object/public/<bucket>/<path>) NE dépend PAS de ces
-- policies pour un bucket public → l'affichage des images reste fonctionnel.
--
-- ⚠️ VÉRIFICATION APRÈS APPLICATION (important) : recharger l'app et confirmer
--    que les images menu/plats et les avatars s'affichent toujours. Si une
--    image ne se charge plus (cas où le bucket ne serait pas réellement public),
--    ROLLBACK en recréant la policy correspondante, ex. :
--      CREATE POLICY "Public read menu images" ON storage.objects
--        FOR SELECT TO public USING (bucket_id = 'menu-images');
-- ============================================================================

DROP POLICY IF EXISTS "Avatar public read"     ON storage.objects; -- bucket avatars
DROP POLICY IF EXISTS "Public read dish images" ON storage.objects; -- bucket dish-images
DROP POLICY IF EXISTS "Public read menu images" ON storage.objects; -- bucket menu-images
