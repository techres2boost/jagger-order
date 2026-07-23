-- Feature 2: server-side delivery assignment worker.
-- Runs from pg_cron (timeouts + queue retries) and from an admin RPC (instant
-- assignment when an order is marked ready). No client-side timer is involved,
-- mirroring the existing expire_stale_orders reliability model.
create or replace function public.process_delivery_assignments()
returns void language plpgsql security definer set search_path = public as $$
declare o record; chosen uuid;
begin
  -- 1) Release proposals not accepted in time; remember the livreur (rotation).
  update public.orders
     set tried_livreur_ids = array_append(tried_livreur_ids, assigned_livreur_id),
         assigned_livreur_id = null,
         assignment_expires_at = null
   where status = 'ready'
     and assigned_livreur_id is not null
     and assignment_expires_at is not null
     and assignment_expires_at < now();

  -- 2) Offer every unassigned ready order to the first free livreur (oldest first).
  --    Free = is_active AND not delivering AND not holding an unexpired proposal.
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
      -- No one free: queue it, reset rotation so freed livreurs get retried,
      -- and notify admin once (only on the false -> true transition).
      update public.orders
         set pending_assignment = true, tried_livreur_ids = '{}'
       where id = o.id and pending_assignment = false;
      if found then
        perform net.http_post(
          url := 'https://ssmmstetcmgsjnjbjkat.supabase.co/functions/v1/notify-admin-unassigned',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('order_id', o.id));
      end if;
    else
      -- Setting assigned_livreur_id fires trg_order_livreur_assigned -> push livreur.
      update public.orders
         set assigned_livreur_id = chosen,
             assignment_expires_at = now() + interval '2 minutes',
             pending_assignment = false
       where id = o.id;
    end if;
  end loop;
end;
$$;
revoke all on function public.process_delivery_assignments() from public, anon, authenticated;

-- Admin-only wrapper so the dashboard can trigger an immediate assignment when
-- an order is marked ready (the cron still handles timeouts/queue retries).
create or replace function public.admin_process_assignments()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'not authorized'; end if;
  perform public.process_delivery_assignments();
end;
$$;
revoke all on function public.admin_process_assignments() from public, anon;
grant execute on function public.admin_process_assignments() to authenticated;
