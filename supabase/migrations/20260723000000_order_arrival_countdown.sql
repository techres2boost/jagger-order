-- Compte à rebours d'arrivée client : on fige une heure d'arrivée cible une
-- seule fois (à l'acceptation), le front ne fait ensuite que du décompte dessus.
--
-- arrival_at = now() + temps de préparation (réglage global admin) + temps de
-- trajet estimé. Le temps de trajet est dérivé de orders.distance_km (colonne de
-- trajet existante) à 25 km/h, cohérent avec src/lib/order-timing.ts.

-- Réglages globaux (une seule ligne, modifiable par l'admin plus tard).
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  prep_time_minutes int not null default 20
);

insert into public.app_settings (id, prep_time_minutes)
  values (1, 20)
  on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Seul l'admin lit/écrit les réglages (l'UI admin viendra plus tard).
drop policy if exists "app_settings_admin_select" on public.app_settings;
create policy "app_settings_admin_select" on public.app_settings
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "app_settings_admin_update" on public.app_settings;
create policy "app_settings_admin_update" on public.app_settings
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

-- Heure d'arrivée cible figée.
alter table public.orders add column if not exists arrival_at timestamptz;

-- Trigger : à l'acceptation, on fige arrival_at une seule fois.
-- security definer pour lire app_settings malgré la RLS.
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_arrival_at on public.orders;
create trigger trg_set_arrival_at
  before update on public.orders
  for each row
  execute function public.set_order_arrival_at();
