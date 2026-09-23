-- The BI gateway validates the Supabase JWT in Python. These two auth tables
-- keep RLS policies based on auth.uid(), so the read-only API role cannot query
-- them directly to authorize a request. This helper exposes only the single
-- decision the gateway needs and keeps the API role without BYPASSRLS.
CREATE OR REPLACE FUNCTION public.rpc_bi_authorize_user(
  p_user_id uuid,
  p_modules text[]
)
RETURNS TABLE (
  user_role text,
  can_use_dashboard boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    p.role,
    p.role = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.user_permissions up
        WHERE up.user_id = p.id
          AND up.module_id = ANY(COALESCE(p_modules, ARRAY[]::text[]))
      )
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND p.is_active = true;
$$;

ALTER FUNCTION public.rpc_bi_authorize_user(uuid, text[])
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.rpc_bi_authorize_user(uuid, text[])
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_bi_authorize_user(uuid, text[])
      TO ceres_bi_api;
  END IF;
END
$$;
