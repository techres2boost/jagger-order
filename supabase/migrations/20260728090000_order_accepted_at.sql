-- Stats dashboard "Délai moyen" / "Temps d'acceptation" cassées : elles étaient
-- calculées en filtrant sur status = 'accepted' (statut COURANT). Une commande
-- acceptée passe aussitôt à ready/delivering/delivered et n'a donc plus ce
-- statut, d'où des stats vides. Le bon repère est un ÉVÉNEMENT historique :
-- l'instant d'acceptation, stocké dans orders.accepted_at.
--
-- Migration idempotente :
--   1. garantit la colonne accepted_at (déjà présente en prod, no-op sécurisé) ;
--   2. complète la fonction set_order_arrival_at() (le trigger qui fixe déjà
--      arrival_at à l'acceptation) pour qu'elle fixe aussi accepted_at au même
--      moment, SANS créer de second trigger et SANS toucher au countdown/arrival_at ;
--   3. backfill approximatif des commandes historiques (voir note plus bas).

-- 1) Colonne accepted_at (déjà créée par une évolution antérieure du schéma ;
--    le IF NOT EXISTS rend la migration rejouable sans erreur).
alter table public.orders
  add column if not exists accepted_at timestamptz;

-- 2) Même fonction/trigger que le countdown (arrival_at) : on AJOUTE seulement le
--    remplissage d'accepted_at à la transition vers 'accepted'. coalesce() pour ne
--    jamais écraser une valeur déjà fournie par le front (admin.tsx pose déjà
--    accepted_at dans le même UPDATE), tout en garantissant la valeur au niveau
--    base quelle que soit la voie d'écriture.
create or replace function public.set_order_arrival_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prep_minutes int;
  travel_minutes int;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select prep_time_minutes into prep_minutes from public.app_settings where id = 1;
    prep_minutes := coalesce(prep_minutes, 20);
    travel_minutes := ceil(coalesce(new.distance_km, 0) / 25.0 * 60.0)::int;
    new.arrival_at := now() + make_interval(mins => prep_minutes + travel_minutes);
    -- Ajout : horodatage de l'acceptation (event distinct de status/arrival_at).
    new.accepted_at := coalesce(new.accepted_at, now());
  end if;
  return new;
end;
$$;

-- 3) Backfill APPROXIMATIF et documenté des commandes déjà acceptées avant que
--    accepted_at ne soit renseigné. On INVERSE la formule d'arrival_at :
--        arrival_at = accepted_at + (prep_minutes + travel_minutes)
--    donc accepted_at ≈ arrival_at - (prep_minutes + travel_minutes).
--    ATTENTION : ce n'est PAS une donnée exacte, seulement une estimation
--    reconstituée à partir du temps de préparation configuré et de la distance.
--    On ne l'applique QUE lorsque arrival_at existe (seul repère fiablement
--    inversible). Les commandes historiques sans arrival_at restent NULL et sont
--    simplement exclues des stats de temps d'acceptation (aucune donnée inventée).
--    Idempotent : ne touche que les lignes encore NULL.
update public.orders o
set accepted_at = o.arrival_at - make_interval(
      mins => coalesce((select prep_time_minutes from public.app_settings where id = 1), 20)
            + ceil(coalesce(o.distance_km, 0) / 25.0 * 60.0)::int
    )
where o.accepted_at is null
  and o.arrival_at is not null
  and o.status in ('accepted', 'ready', 'delivering', 'delivered');
