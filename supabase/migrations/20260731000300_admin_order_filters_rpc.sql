-- Feature 1 (admin): distinct filter options for the history filter dropdowns.
-- Admin-only (SECURITY DEFINER + has_role guard) so it can scan across all orders.
create or replace function public.admin_order_filters()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare result json;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;
  select json_build_object(
    'clients', coalesce((
      select json_agg(json_build_object('user_id', user_id, 'customer_name', customer_name)
                      order by customer_name)
      from (select distinct on (user_id) user_id, customer_name
            from public.orders order by user_id, created_at desc) c), '[]'::json),
    'cities', coalesce((
      select json_agg(v order by v)
      from (select distinct city as v from public.orders
            where city is not null and btrim(city) <> '') s), '[]'::json),
    'addresses', coalesce((
      select json_agg(v order by v)
      from (select distinct address as v from public.orders
            where address is not null and btrim(address) <> '') s), '[]'::json)
  ) into result;
  return result;
end;
$$;
-- Only authenticated (and admins pass the in-function guard). Revoke the default
-- PUBLIC grant so anon cannot reach the RPC endpoint at all.
revoke execute on function public.admin_order_filters() from public, anon;
grant execute on function public.admin_order_filters() to authenticated;
