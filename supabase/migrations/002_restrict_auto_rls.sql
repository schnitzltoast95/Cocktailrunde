-- Supabase's optional automatic-RLS event trigger creates this helper in public.
-- It is not an API endpoint and should not be callable by app roles.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
