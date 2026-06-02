-- Remote has a public event trigger function named rls_auto_enable().
-- The implementation body is intentionally not recreated here until it can be
-- reviewed in full. Future schema work should keep RLS explicit in migrations.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
