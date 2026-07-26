-- ============================================================================
-- F-04 (🟠) : la policy orders_livreur_update autorisait le livreur assigné à
-- modifier N'IMPORTE QUELLE colonne (statut, total, adresse…) de ses commandes,
-- sans contrôle de transition. Les gardes .eq("status", …) n'étaient
-- qu'applicatives (contournables via appel PostgREST direct).
--
-- Correctif :
--   1) RPC `livreur_update_order_status(order_id, new_status)` SECURITY DEFINER
--      qui : vérifie que l'appelant est le livreur assigné, autorise UNIQUEMENT
--      les transitions légitimes (ready → delivering, delivering → delivered),
--      et ne modifie QUE le statut + l'horodatage associé.
--   2) Suppression de la policy UPDATE directe du livreur → la RPC devient le
--      seul chemin d'écriture. Le livreur conserve son accès SELECT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.livreur_update_order_status(
  p_order_id uuid,
  p_new_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_uid       uuid := auth.uid();
  v_cur       order_status;
  v_livreur   uuid;
  v_assigned  boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_new_status not in ('delivering', 'delivered') then
    raise exception 'Statut non autorisé pour un livreur: %', p_new_status;
  end if;

  -- Verrouille la commande (évite les courses accept/reassign).
  select o.status, o.assigned_livreur_id
    into v_cur, v_livreur
  from public.orders o
  where o.id = p_order_id
  for update;
  if not found then
    raise exception 'Commande introuvable';
  end if;

  -- L'appelant est-il le livreur assigné ?
  select exists (
    select 1 from public.livreurs l
    where l.id = v_livreur and l.user_id = v_uid
  ) into v_assigned;
  if not v_assigned then
    raise exception 'Commande non assignée à ce livreur' using errcode = '42501';
  end if;

  if p_new_status = 'delivering' then
    if v_cur <> 'ready' then
      raise exception 'Transition invalide : la commande n''est plus proposée';
    end if;
    update public.orders
      set status = 'delivering', delivering_at = now()
      where id = p_order_id;
  else -- 'delivered'
    if v_cur <> 'delivering' then
      raise exception 'Transition invalide : la commande n''est pas en livraison';
    end if;
    update public.orders
      set status = 'delivered', delivered_at = now()
      where id = p_order_id;
  end if;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.livreur_update_order_status(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.livreur_update_order_status(uuid, text) TO authenticated;

-- Retire l'écriture directe du livreur : la RPC est désormais le seul chemin.
-- (Le SELECT du livreur — orders_livreur_select — reste inchangé.)
DROP POLICY IF EXISTS "orders_livreur_update" ON public.orders;
DROP POLICY IF EXISTS "orders_livreur_update_assigned" ON public.orders;
