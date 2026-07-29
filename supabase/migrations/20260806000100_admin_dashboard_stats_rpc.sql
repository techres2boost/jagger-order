-- ============================================================================
-- [Scalabilité 1.2] RPC d'agrégats dashboard admin — remplace les select("*")
-- de tables entières (orders / order_items / order_ratings) chargées à chaque
-- affichage du dashboard puis agrégées en JS.
--
-- Principe « mêmes chiffres » : la RPC agrège UNIQUEMENT jusqu'à des
-- intermédiaires BORNÉS (quantité par plat, sommes/compteurs par statut, buckets
-- de notes). Les étapes finales dépendant de constantes/format côté client
-- (mapping catégorie via src/data/menu, tris/slices top-5, formatage) restent en
-- JS, INCHANGÉES → résultats identiques.
--
-- ⚠️ Différence assumée et documentée : le bucketing horaire (créneau Matin/Midi/
--    Soir) et le regroupement par jour (tendance des notes) utilisaient
--    `Date#getHours()` / `format(...)` en timezone LOCALE DU NAVIGATEUR (donc
--    variable selon l'admin). Ici on fige sur 'Africa/Tunis' (l'app facture en
--    DT). C'est plus stable/correct ; l'écart n'apparaît que pour un admin hors
--    fuseau tunisien.
--
-- SECURITY DEFINER + contrôle explicite du rôle admin à l'intérieur.
-- p_rating_start / p_rating_end : bornes (timestamptz) calculées côté client
-- exactement comme avant (début de journée / fin de journée locale) pour que le
-- filtre période des avis reste identique. NULL/NULL = tous les avis.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(
  p_rating_start timestamptz DEFAULT NULL,
  p_rating_end   timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_uid uuid := auth.uid();
  result jsonb;
begin
  if v_uid is null or not public.has_role(v_uid, 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with sold as (
    -- soldItems : items dont la commande n'est PAS pending/refused/expired/cancelled
    select oi.name, oi.qty, o.created_at
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status not in ('pending','refused','expired','cancelled')
  ),
  dish_qty as (
    select name, sum(qty)::bigint as qty from sold group by name
  ),
  svc as (
    select
      coalesce(sum(qty) filter (where h < 11), 0)               as matin,
      coalesce(sum(qty) filter (where h >= 11 and h < 17), 0)   as midi,
      coalesce(sum(qty) filter (where h >= 17), 0)              as soir
    from (select qty, extract(hour from (created_at at time zone 'Africa/Tunis'))::int as h from sold) s
  ),
  acc_f as (
    select extract(epoch from (accepted_at - created_at)) as dur
    from public.orders
    where accepted_at is not null
      and extract(epoch from (accepted_at - created_at)) >= 0
      and extract(epoch from (accepted_at - created_at)) < 3600
  ),
  ratings_valid as (
    select r.order_id, r.rating, r.created_at
    from public.order_ratings r
    where r.dismissed is not true and r.rating is not null
      and (p_rating_start is null or p_rating_end is null
           or (r.created_at >= p_rating_start and r.created_at <= p_rating_end))
  ),
  rating_dish as (
    select rv.rating, oi.name
    from ratings_valid rv
    join (select distinct order_id, name from public.order_items) oi on oi.order_id = rv.order_id
  )
  select jsonb_build_object(
    'dish_qty',    coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty)) from dish_qty), '[]'::jsonb),
    'service_map', (select jsonb_build_object('Matin', matin, 'Midi', midi, 'Soir', soir) from svc),
    'accept',      (select jsonb_build_object(
                       'avg_sec', coalesce(avg(dur), 0),
                       'min_sec', coalesce(min(dur), 0),
                       'max_sec', coalesce(max(dur), 0),
                       'count',   count(*)
                     ) from acc_f),
    'refused',     (select count(*) from public.orders where status='refused'),
    'unavailable', (select count(*) from public.orders where status='refused' and refusal_reason='unavailable'),
    'busy',        (select count(*) from public.orders where status='refused' and refusal_reason='busy'),
    'expired',     (select count(*) from public.orders where status='expired'),
    'cancelled',   (select count(*) from public.orders where status='cancelled'),
    'total_orders',(select count(*) from public.orders),
    'rating', jsonb_build_object(
      'count', (select count(*) from ratings_valid),
      'sum',   (select coalesce(sum(rating), 0) from ratings_valid),
      'distribution', coalesce((select jsonb_agg(jsonb_build_object('rating', g, 'count', c) order by g) from (
                        select gs as g, (select count(*) from ratings_valid where round(rating) = gs) as c
                        from generate_series(1,5) gs
                      ) d), '[]'::jsonb),
      'trend', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'sum', s, 'n', n) order by day) from (
                 select to_char(created_at at time zone 'Africa/Tunis', 'YYYY-MM-DD') as day,
                        sum(rating) s, count(*) n
                 from ratings_valid group by 1
               ) t), '[]'::jsonb),
      'dish_agg', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'sum', s, 'n', n)) from (
                    select name, sum(rating) s, count(*) n from rating_dish group by name
                  ) da), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

REVOKE ALL   ON FUNCTION public.admin_dashboard_stats(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(timestamptz, timestamptz) TO authenticated;
