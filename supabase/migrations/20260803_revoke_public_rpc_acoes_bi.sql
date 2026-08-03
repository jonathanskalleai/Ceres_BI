-------------------------------------------------------------------------------
-- revoke_public_rpc_acoes_bi.sql
-- Story: SEC-FIX-1
-- Data: 2026-08-03
--
-- PROPOSITO
--   Revogar EXECUTE de PUBLIC e anon na funcao existente rpc_acoes_bi.
--   Garantir que apenas authenticated e service_role possam executar.
--
-- DECISAO
--   O codigo da funcao NAO e alterado. Apenas o GRANT e modificado.
--   A funcao continua existindo e retornando os mesmos dados para callers
--   autenticados. Frontend usa sessao autenticada (confirmado pelo @security).
-------------------------------------------------------------------------------

BEGIN;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text)
  TO authenticated, service_role;

COMMIT;

-- POSTFLIGHT: validar que o GRANT ficou correto
DO $$
DECLARE
  fn_name text := 'rpc_acoes_bi';
  row_count int;
BEGIN
  -- (a) Funcao existe
  SELECT COUNT(*) INTO row_count
  FROM pg_proc
  WHERE proname = fn_name;
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % not found', fn_name;
  END IF;

  -- (b) Owner e postgres
  SELECT COUNT(*) INTO row_count
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = fn_name
    AND r.rolname = 'postgres';
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % owner is not postgres', fn_name;
  END IF;

  -- (c) PUBLIC e anon SEM EXECUTE
  SELECT COUNT(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('PUBLIC', 'anon')
    AND privilege_type = 'EXECUTE';
  IF row_count > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % still has EXECUTE for PUBLIC or anon', fn_name;
  END IF;

  -- (d) authenticated e service_role COM EXECUTE
  SELECT COUNT(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('authenticated', 'service_role')
    AND privilege_type = 'EXECUTE';
  IF row_count < 2 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % missing EXECUTE for authenticated or service_role', fn_name;
  END IF;
END $$;
