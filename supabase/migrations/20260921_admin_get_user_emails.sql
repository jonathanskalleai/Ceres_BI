-- Lista e-mails de usuários para a tela administrativa sem expor a
-- service-role key no bundle web. A autorização é revalidada no banco.

CREATE OR REPLACE FUNCTION public.admin_get_user_emails(
  p_user_ids uuid[]
)
RETURNS TABLE (
  user_id uuid,
  email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid()
      AND profile.role = 'admin'
      AND profile.is_active = true
  ) THEN
    RAISE EXCEPTION 'Apenas administradores ativos podem listar e-mails de usuarios'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_ids IS NULL THEN
    RAISE EXCEPTION 'user_ids obrigatorio'
      USING ERRCODE = '22004';
  END IF;

  IF cardinality(p_user_ids) > 500 THEN
    RAISE EXCEPTION 'Limite de 500 usuarios por consulta excedido'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT auth_user.id, auth_user.email::text
  FROM auth.users AS auth_user
  WHERE auth_user.id = ANY (p_user_ids)
  ORDER BY auth_user.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_emails(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_user_emails(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_get_user_emails(uuid[]) IS
  'Retorna e-mails de auth.users somente para administradores ativos autenticados.';
