-- Restrict EXECUTE on SECURITY DEFINER functions that should not be callable via the API.
-- handle_new_user: trigger only (on auth.users).
-- set_updated_at: trigger only.
-- expire_stale_orders: maintenance job; only service_role should call it.
-- has_role: intentionally kept executable because it is referenced by RLS policies,
-- which are evaluated in the calling role's context and require EXECUTE.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_orders() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_orders() TO service_role;
