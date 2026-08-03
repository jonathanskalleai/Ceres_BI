-------------------------------------------------------------------------------
-- revoke_public_rpc_acoes_bi.sql
-- Story: SEC-FIX-1
-- Data: 2026-08-03
--
-- PROPOSITO
--   Revogar EXECUTE de PUBLIC e anon na funcao existente rpc_acoes_bi.
--   Garantir que apenas authenticated e service_role possam executar.
-------------------------------------------------------------------------------

BEGIN;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text)
  TO authenticated, service_role;
COMMIT;

DO $$
DECLARE
  fn_name text := 'rpc_acoes_bi';
  row_count int;
BEGIN
  SELECT COUNT(*) INTO row_count FROM pg_proc WHERE proname = fn_name;
  IF row_count = 0 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % not found', fn_name; END IF;
  SELECT COUNT(*) INTO row_count FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE p.proname = fn_name AND r.rolname = 'postgres';
  IF row_count = 0 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % owner not postgres', fn_name; END IF;
  SELECT COUNT(*) INTO row_count FROM information_schema.routine_privileges WHERE routine_name = fn_name AND grantee IN ('PUBLIC','anon') AND privilege_type='EXECUTE';
  IF row_count > 0 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % has EXECUTE for PUBLIC/anon', fn_name; END IF;
  SELECT COUNT(*) INTO row_count FROM information_schema.routine_privileges WHERE routine_name = fn_name AND grantee IN ('authenticated','service_role') AND privilege_type='EXECUTE';
  IF row_count < 2 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % missing EXECUTE for authenticated', fn_name; END IF;
END $$;
