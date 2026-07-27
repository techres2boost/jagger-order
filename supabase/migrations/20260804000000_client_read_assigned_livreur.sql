-- ============================================================================
-- Carte livreur (écran de suivi client) : le client propriétaire d'une commande
-- ne pouvait PAS lire le nom de son livreur assigné.
--
-- Les policies de `livreurs` n'autorisent en SELECT que l'admin et le livreur
-- lui-même (user_id = auth.uid()). Un client n'a donc aucun accès à la table :
-- la requête `from("livreurs").select("nom").eq("id", assigned_livreur_id)`
-- renvoyait 0 ligne (RLS), et la carte livreur ne s'affichait jamais.
--
-- Correctif — exposition minimale via RPC SECURITY DEFINER plutôt qu'une policy
-- ouvrant toute la ligne (`telephone`, `email`… ne doivent pas fuiter côté
-- client). `get_order_livreur` ne renvoie QUE `id` + `nom`, et uniquement si
-- l'appelant est le propriétaire de la commande (ou le livreur assigné, ou un
-- admin). Aucune policy de table n'est modifiée.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_order_livreur(p_order_id uuid)
RETURNS TABLE (id uuid, nom text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id, l.nom
  FROM public.orders o
  JOIN public.livreurs l ON l.id = o.assigned_livreur_id
  WHERE o.id = p_order_id
    AND (
      o.user_id = auth.uid()                    -- le client propriétaire de la commande
      OR l.user_id = auth.uid()                 -- le livreur assigné lui-même
      OR public.has_role(auth.uid(), 'admin')   -- un administrateur
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_order_livreur(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_order_livreur(uuid) TO authenticated;
