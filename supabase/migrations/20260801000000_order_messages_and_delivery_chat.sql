-- Feature : Live Tracking + Chat client-livreur (BOX)
-- Ajoute la table de messages de chat de commande, ses règles RLS, l'activation
-- Realtime et la notification push automatique des nouveaux messages.
--
-- Aucune modification du schéma existant de `orders` ou `profiles` : on ajoute
-- une nouvelle table, des policies additives et un trigger de notification.
--
-- Faits de schéma vérifiés (Étape 0) réutilisés ci-dessous :
--   * "en livraison"                = order_status 'delivering'
--   * client d'une commande         = orders.user_id  (= auth.users.id = profiles.id)
--   * livreur assigné d'une commande = orders.assigned_livreur_id -> livreurs.id,
--     dont le compte auth est livreurs.user_id

-- 1) Table des messages -------------------------------------------------------
create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- Le rôle de l'expéditeur (client/livreur) n'est PAS stocké : il se déduit à
-- l'affichage en comparant sender_id à auth.uid(), et son nom via profiles.

create index if not exists order_messages_order_id_created_at_idx
  on public.order_messages (order_id, created_at);

grant select, insert on public.order_messages to authenticated;
grant all on public.order_messages to service_role;

-- 2) Helpers d'accès (SECURITY DEFINER, même pattern que public.has_role) ------
-- On passe par des fonctions SECURITY DEFINER pour ne PAS dépendre des RLS de
-- orders/livreurs dans les sous-requêtes des policies (sinon un participant ne
-- pourrait pas « voir » l'autre pour valider l'accès).

-- Vrai si l'utilisateur courant est le client OU le livreur assigné de la
-- commande, ET que celle-ci est au statut 'delivering'.
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
      and o.status = 'delivering'
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

-- Vrai si le profil _profile_id et l'utilisateur courant sont les deux
-- participants (client / livreur) d'une même commande en cours de livraison.
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
    where o.status = 'delivering'
      and (
        (o.user_id = auth.uid() and l.user_id = _profile_id)
        or (o.user_id = _profile_id and l.user_id = auth.uid())
      )
  );
$$;

revoke all on function public.shares_active_delivery(uuid) from public, anon;
grant execute on function public.shares_active_delivery(uuid) to authenticated;

-- 3) RLS sur order_messages ---------------------------------------------------
alter table public.order_messages enable row level security;

-- SELECT et INSERT autorisés uniquement si : statut 'delivering' ET
-- l'utilisateur est le client OU le livreur assigné (via can_access_order_chat).
drop policy if exists "order_messages_participants_select" on public.order_messages;
create policy "order_messages_participants_select" on public.order_messages
  for select to authenticated
  using (public.can_access_order_chat(order_id));

-- À l'insert, l'expéditeur doit être l'utilisateur courant (pas d'usurpation).
drop policy if exists "order_messages_participants_insert" on public.order_messages;
create policy "order_messages_participants_insert" on public.order_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_order_chat(order_id)
  );

-- 4) Lecture croisée des noms de profil des deux participants -----------------
-- Le chat affiche profiles.full_name de l'expéditeur. La policy self ne permet
-- que la lecture de sa propre ligne : on ouvre en plus, UNIQUEMENT pendant une
-- livraison en cours, la lecture réciproque du profil de l'autre participant.
drop policy if exists "profiles_delivery_chat_participants_select" on public.profiles;
create policy "profiles_delivery_chat_participants_select" on public.profiles
  for select to authenticated
  using (public.shares_active_delivery(id));

-- 5) Realtime -----------------------------------------------------------------
alter table public.order_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end
$$;

-- 6) Notification push des nouveaux messages ----------------------------------
-- Même mécanique que trg_order_status_notify : appel asynchrone (pg_net) d'une
-- Edge Function dédiée, sans bloquer l'INSERT. La fonction résout le destinataire
-- (l'autre participant) et envoie le push.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_order_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-order-message',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'message_id', new.id,
      'order_id', new.order_id,
      'sender_id', new.sender_id,
      'content', new.content
    )
  );
  return new;
end;
$$;

revoke all on function public.notify_order_message() from public, anon, authenticated;

drop trigger if exists trg_order_message_notify on public.order_messages;
create trigger trg_order_message_notify
  after insert on public.order_messages
  for each row
  execute function public.notify_order_message();
