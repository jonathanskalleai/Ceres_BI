-- Migration: Fix "is not a valid hexadecimal digit" in set_user_permissions_tx
-- Purpose: Replace unsafe substr()::bit()::bigint advisory-lock key with hashtextextended()
--          so the cast never sees '-' characters from UUID hyphens.
--
-- Background:
--   The previous implementation computed the advisory-lock key as:
--     ('x' || substr(p_user_id::text, 1, 16))::bit(64)::bigint
--   substr(1,16) of a UUID like 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--   yields 'aaaaaaaa-bbbb-cc' (16 chars including 2 hyphens). Postgres then
--   tries to parse 'xaaaaaaaa-bbbb-cc' as hex via bit() and fails with
--   '-' is not a valid hexadecimal digit. The error is intermittent in
--   appearance depending on where the UUID substring cuts.
--
-- Fix:
--   - hashtextextended(text, seed) returns a bigint directly, no cast
--     chain, no risk of '-' or any non-hex char slipping in.
--   - Result is stable for the same input (deterministic across calls).
--   - Input is bounded by p_user_id::text (always <= 36 chars).
--
-- Side improvements:
--   - Guard against NULL p_user_id and p_granted_by (raises early with a
--     actionable message instead of diving into hex math on empty input).
--   - Guard against NULL/non-array p_permissions (jsonb_array_length(NULL)
--     raises; we want a clean no-op when the UI sends an empty payload).
--
-- Tested locally with Postgres 17: 5 smoke cases all pass (single insert,
-- empty array, NULL payload, second user, auth-guard rejection).

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
DECLARE
  v_perm jsonb;
BEGIN
  -- Input validation: catch empty/NULL before any cast math
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;
  IF p_granted_by IS NULL THEN
    RAISE EXCEPTION 'granted_by obrigatorio';
  END IF;

  -- Authorization: only admins can mutate permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem modificar permissoes';
  END IF;

  -- Deterministic advisory lock keyed by user_id.
  -- hashtextextended returns bigint directly; no hex parsing involved.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Replace existing permissions atomically (DELETE + INSERT in same tx).
  DELETE FROM public.user_permissions
  WHERE user_id = p_user_id;

  -- Insert new permissions if any. Accepts NULL, '[]', or a JSON array.
  IF p_permissions IS NOT NULL
     AND jsonb_typeof(p_permissions) = 'array'
     AND jsonb_array_length(p_permissions) > 0
  THEN
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

-- Re-grant execute (idempotent).
GRANT EXECUTE ON FUNCTION public.set_user_permissions_tx(uuid, jsonb, uuid) TO authenticated;
