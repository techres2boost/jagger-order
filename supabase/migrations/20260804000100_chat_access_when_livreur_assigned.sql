-- ============================================================================
-- Chat de livraison : accès dès qu'un livreur est assigné (pas seulement au
-- statut 'delivering').
--
-- can_access_order_chat / shares_active_delivery exigeaient `status = 'delivering'`,
-- si bien que le chat n'était lisible/insérable qu'une fois la livraison lancée.
-- On élargit la fenêtre d'accès : dès qu'un livreur est assigné, et tant que la
-- commande n'est ni annulée/expirée/refusée, ni livrée depuis longtemps (> 24 h).
-- Le modèle de sécurité est inchangé : seuls les deux participants (client
-- propriétaire OU livreur assigné) accèdent au chat / se voient mutuellement.
-- ============================================================================

create or replace function public.can_access_order_chat(_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = _order_id
      and o.assigned_livreur_id is not null
      and o.status not in ('cancelled', 'expired', 'refused')
      and (o.status <> 'delivered' or o.delivered_at >= now() - interval '24 hours')
      and (
        o.user_id = auth.uid()
        or exists (
          select 1 from public.livreurs l
          where l.id = o.assigned_livreur_id
            and l.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_access_order_chat(uuid) from public, anon;
grant execute on function public.can_access_order_chat(uuid) to authenticated;

create or replace function public.shares_active_delivery(_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    left join public.livreurs l on l.id = o.assigned_livreur_id
    where o.assigned_livreur_id is not null
      and o.status not in ('cancelled', 'expired', 'refused')
      and (o.status <> 'delivered' or o.delivered_at >= now() - interval '24 hours')
      and (
        (o.user_id = auth.uid() and l.user_id = _profile_id)
        or (o.user_id = _profile_id and l.user_id = auth.uid())
      )
  );
$$;

revoke all on function public.shares_active_delivery(uuid) from public, anon;
grant execute on function public.shares_active_delivery(uuid) to authenticated;
