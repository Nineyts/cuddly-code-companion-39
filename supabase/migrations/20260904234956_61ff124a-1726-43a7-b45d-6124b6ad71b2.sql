REVOKE EXECUTE ON FUNCTION public.expirar_assinaturas() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.expirar_assinaturas() TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_assinatura() FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.renovar_assinatura(uuid, numeric, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.renovar_assinatura(uuid, numeric, text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.verificar_site(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_site(text) TO anon, authenticated, service_role;
