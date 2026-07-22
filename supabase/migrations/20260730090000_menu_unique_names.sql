-- Empêche les doublons de catégories et de plats dans le menu admin.
--
-- Règle :
--   * nom de catégorie unique, insensible à la casse et aux espaces superflus ;
--   * nom de plat unique DANS une catégorie (le même nom reste autorisé dans
--     deux catégories différentes), même normalisation.
--
-- Normalisation : lower(trim(name)) — ignore la casse et les espaces de début/fin.
-- Ces index uniques d'expression sont la source de vérité ; le frontend fait une
-- vérification préventive et retombe sur le code d'erreur 23505 en cas de course.

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_ci
  ON public.categories (lower(trim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_category_name_unique_ci
  ON public.menu_items (category_id, lower(trim(name)));
