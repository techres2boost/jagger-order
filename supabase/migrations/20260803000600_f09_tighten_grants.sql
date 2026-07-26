-- ============================================================================
-- F-09 (🟡) : les GRANTs par défaut (Supabase) donnent ALL — dont DELETE et
-- TRUNCATE — à anon/authenticated sur toutes les tables public. La sécurité
-- repose alors uniquement sur la RLS. Défense en profondeur : on RÉVOQUE les
-- privilèges qui ne sont couverts par AUCUNE policy, pour qu'un oubli futur de
-- policy n'expose pas immédiatement la table.
--
-- Révocations SÛRES (chaque privilège retiré n'a aujourd'hui aucune policy
-- permissive correspondante, donc était déjà refusé par la RLS) :
--   * TRUNCATE partout    : jamais utile aux rôles client, non exposé par PostgREST.
--   * user_roles écriture : aucune policy write (les rôles sont gérés hors app).
--   * orders DELETE       : aucune policy DELETE (annulation = UPDATE guardé).
--   * app_settings I/D    : seule la mise à jour admin est prévue.
-- On NE touche pas aux privilèges couverts par une policy (ex. addresses DELETE
-- owner, menu_items/categories DELETE admin, orders UPDATE, etc.).
-- ============================================================================

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.user_roles   FROM anon, authenticated;
REVOKE DELETE                 ON public.orders        FROM anon, authenticated;
REVOKE INSERT, DELETE         ON public.app_settings  FROM anon, authenticated;
