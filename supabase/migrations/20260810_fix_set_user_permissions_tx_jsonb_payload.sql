-- Keep module_id as text: app_modules.id and user_permissions.module_id are text.
-- This also rejects malformed JSONB before deleting any existing permissions.
CREATE OR REPLACE FUNCTION public.set_user_permissions_tx(
  p_user_id uuid,
  p_permissions jsonb,
  p_granted_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;
  IF p_granted_by IS NULL THEN
    RAISE EXCEPTION 'granted_by obrigatorio';
  END IF;
  IF p_permissions IS NULL OR jsonb_typeof(p_permissions) <> 'array' THEN
    RAISE EXCEPTION 'p_permissions deve ser um array JSON';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem modificar permissoes';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  DELETE FROM public.user_permissions
  WHERE user_id = p_user_id;

  IF jsonb_array_length(p_permissions) > 0 THEN
    INSERT INTO public.user_permissions (user_id, module_id, is_visible, granted_by)
    SELECT
      p_user_id,
      elem->>'moduleId',
      COALESCE((elem->>'isVisible')::boolean, true),
      p_granted_by
    FROM jsonb_array_elements(p_permissions) AS elem;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_permissions_tx(uuid, jsonb, uuid) TO authenticated;
