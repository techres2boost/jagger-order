-- 1) Table de configuration interne (secrets partagés DB <-> Edge Functions)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.internal_config FROM anon, authenticated;
GRANT ALL ON public.internal_config TO service_role;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
-- Aucune policy : inaccessible via l'API Data (seuls service_role / SECURITY DEFINER y accèdent).

CREATE TRIGGER internal_config_set_updated_at
  BEFORE UPDATE ON public.internal_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.internal_config (key, value)
VALUES ('push_trigger_secret', '20f2db342a81952dad30627914e6b0d03dd0da1dcb3a8fcc')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.internal_secret(_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT value FROM public.internal_config WHERE key = _key;
$$;
REVOKE ALL ON FUNCTION public.internal_secret(text) FROM public, anon, authenticated;

-- 2) Les triggers/CRON envoient le secret partagé aux Edge Functions
CREATE OR REPLACE FUNCTION public.notify_livreur_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.assigned_livreur_id is not null
     and new.assigned_livreur_id is distinct from old.assigned_livreur_id then
    perform net.http_post(
      url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-livreur',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', public.internal_secret('push_trigger_secret')
      ),
      body := jsonb_build_object(
        'livreur_id', new.assigned_livreur_id,
        'order_id', new.id
      )
    );
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_order_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  perform net.http_post(
    url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-order-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', public.internal_secret('push_trigger_secret')
    ),
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

CREATE OR REPLACE FUNCTION public.trigger_late_delivery_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
begin
  perform net.http_post(
    url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-admin-late-delivery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', public.internal_secret('push_trigger_secret')
    ),
    body := jsonb_build_object(
      'order_id', new.order_id,
      'message', new.message
    )
  );
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.check_late_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
declare
  r record;
begin
  for r in
    select id, order_number
    from orders
    where status in ('accepted', 'ready', 'delivering')
      and estimated_ready_at < now()
      and late_notification_sent = false
  loop
    perform net.http_post(
      url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', public.internal_secret('push_trigger_secret')
      ),
      body := jsonb_build_object(
        'target', 'admin',
        'title', 'Commande en retard',
        'body', 'La commande #' || r.order_number || ' dépasse le délai prévu (toujours en préparation/livraison)'
      )
    );

    update orders set late_notification_sent = true where id = r.id;
  end loop;
end;
$$;

CREATE OR REPLACE FUNCTION public.process_delivery_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare o record; chosen uuid;
begin
  update public.orders
     set tried_livreur_ids = array_append(tried_livreur_ids, assigned_livreur_id),
         assigned_livreur_id = null,
         assignment_expires_at = null
   where status = 'ready'
     and assigned_livreur_id is not null
     and assignment_expires_at is not null
     and assignment_expires_at < now();

  for o in
    select id, tried_livreur_ids from public.orders
     where status = 'ready' and assigned_livreur_id is null
     order by ready_at nulls first, created_at
  loop
    select l.id into chosen
    from public.livreurs l
    where l.is_active = true
      and not (l.id = any(o.tried_livreur_ids))
      and not exists (
        select 1 from public.orders b
        where b.assigned_livreur_id = l.id
          and (b.status = 'delivering'
               or (b.status = 'ready' and b.assignment_expires_at is not null
                   and b.assignment_expires_at > now())))
    order by l.created_at
    limit 1;

    if chosen is null then
      update public.orders
         set pending_assignment = true, tried_livreur_ids = '{}'
       where id = o.id and pending_assignment = false;
      if found then
        perform net.http_post(
          url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-admin-unassigned',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-secret', public.internal_secret('push_trigger_secret')
          ),
          body := jsonb_build_object('order_id', o.id));
      end if;
    else
      update public.orders
         set assigned_livreur_id = chosen,
             assignment_expires_at = now() + interval '2 minutes',
             pending_assignment = false
       where id = o.id;
    end if;
  end loop;
end;
$$;

-- 3) Anti-escalade sur push_subscriptions : le rôle demandé doit être réellement détenu
CREATE OR REPLACE FUNCTION public.enforce_push_subscription_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.role not in ('client', 'admin', 'livreur') then
    raise exception 'Rôle invalide: %', new.role using errcode = '22023';
  end if;

  if new.role in ('admin', 'livreur') then
    if new.user_id is null
       or not public.has_role(new.user_id, new.role::app_role) then
      raise exception 'Rôle non autorisé pour cet utilisateur' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS push_subscriptions_enforce_role ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_enforce_role
  BEFORE INSERT OR UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_push_subscription_role();

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if p_role not in ('client', 'admin', 'livreur') then
    raise exception 'Rôle invalide: %', p_role using errcode = '22023';
  end if;

  -- Seul un utilisateur détenant réellement le rôle admin/livreur dans
  -- user_roles peut s'abonner aux notifications de ce rôle.
  if p_role in ('admin', 'livreur') and not public.has_role(uid, p_role::app_role) then
    raise exception 'Rôle non autorisé pour cet utilisateur' using errcode = '42501';
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

-- 4) search_path figé (lint 0011)
ALTER FUNCTION public.check_max_5_addresses() SET search_path TO 'public', 'pg_temp';

-- 5) Suivi GPS temps réel : canaux privés autorisés aux seuls participants
DROP POLICY IF EXISTS "Order tracking read for participants" ON realtime.messages;
DROP POLICY IF EXISTS "Order tracking write for participants" ON realtime.messages;

CREATE POLICY "Order tracking read for participants"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'order-tracking-%'
  AND public.can_access_order_chat(
    nullif(substring(realtime.topic() from 16), '')::uuid
  )
);

CREATE POLICY "Order tracking write for participants"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'order-tracking-%'
  AND public.can_access_order_chat(
    nullif(substring(realtime.topic() from 16), '')::uuid
  )
);