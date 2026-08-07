-- Migration: Add transactional set_user_permissions function
-- Purpose: Prevent permission loss on insert failure by wrapping DELETE+INSERT in a transaction
-- This fixes the race condition where a failed INSERT after DELETE leaves user with no permissions

-- Create a transactional wrapper function for setting user permissions
-- Uses a CTE to perform delete and insert atomically
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
  -- SECURITY: Validate caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem modificar permissoes';
  END IF;

  -- Use advisory lock to prevent concurrent modifications to same user
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(p_user_id::text, 1, 16))::bit(64)::bigint
  );

  -- Delete existing permissions for this user
  DELETE FROM public.user_permissions
  WHERE user_id = p_user_id;

  -- Insert new permissions (if any)
  IF jsonb_array_length(p_permissions) > 0 THEN
    INSERT INTO public.user_permissions (user_id, module_id, is_visible, granted_by)
    SELECT
      p_user_id,
      (elem->>'moduleId')::uuid,
      COALESCE((elem->>'isVisible')::boolean, true),
      p_granted_by
    FROM jsonb_array_elements(p_permissions) AS elem;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users (UI uses auth context)
GRANT EXECUTE ON FUNCTION public.set_user_permissions_tx(uuid, jsonb, uuid) TO authenticated;
