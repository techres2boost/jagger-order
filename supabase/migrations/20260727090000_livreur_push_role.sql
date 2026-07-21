-- Tâche 2/3 : autoriser le rôle 'livreur' à enregistrer ses abonnements push.
-- La table push_subscriptions existe déjà (liée à auth.users, colonne role).
-- On se contente d'ÉLARGIR la contrainte de rôle et la RPC d'enregistrement à
-- 'livreur', sans toucher aux flux 'client' / 'admin' existants.

-- Contrainte CHECK : ajouter 'livreur' aux rôles acceptés.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_role_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_role_check
  check (role = any (array['client'::text, 'admin'::text, 'livreur'::text]));

-- RPC SECURITY DEFINER utilisée par le frontend (src/lib/push.ts) : même logique
-- qu'avant, on ajoute simplement 'livreur' à la liste blanche des rôles.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_role not in ('client', 'admin', 'livreur') then
    raise exception 'Rôle invalide: %', p_role using errcode = '22023';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, role, user_id)
    values (p_endpoint, p_p256dh, p_auth, p_role, uid)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        role = excluded.role,
        user_id = excluded.user_id;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
