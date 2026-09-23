-- Migration: Remove o overload legado ambiguo de Desempenho de Vendas
-- Data: 2026-09-22
--
-- Contexto:
--   O banco pode conter simultaneamente os overloads de 10 argumentos (legado)
--   e de 11 argumentos (o contrato vigente, com p_funis text[]). O PostgREST
--   não consegue escolher entre funções com parâmetros DEFAULT quando a chamada
--   omite p_funis e responde PGRST203 ("Could not choose the best candidate").
--
-- Escopo deliberadamente estreito:
--   * remove SOMENTE public.rpc_desempenho_vendas_bi(date,date,integer,
--     text,text,text,text,text,text,text);
--   * preserva o overload vigente com o último argumento text[];
--   * não altera rpc_desempenho_vendas_bi_core, ACL, RLS ou qualquer tabela.
--
-- Rollback manual (somente após aprovação e validação): reaplicar o bloco
-- CREATE OR REPLACE da versão de 10 argumentos em
-- 20260908_desempenho_vendas_mensal_fix.sql (e os GRANTs correspondentes),
-- seguido de NOTIFY pgrst, 'reload schema'.

BEGIN;

DO $$
DECLARE
  v_legacy_oid oid;
  v_current_oid oid;
  v_legacy_result text;
  v_current_result text;
  v_current_security_definer boolean;
BEGIN
  -- Resolve por identidade completa, nunca por nome/quantidade de argumentos
  -- apenas. Isso torna explícito o alvo e aborta antes do DROP se o contrato
  -- vigente não estiver instalado.
  v_legacy_oid := to_regprocedure(
    'public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text)'
  );
  v_current_oid := to_regprocedure(
    'public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text,text[])'
  );

  IF v_current_oid IS NULL THEN
    RAISE EXCEPTION
      'Abortando: overload vigente rpc_desempenho_vendas_bi(..., text[]) não foi encontrado';
  END IF;

  IF v_legacy_oid IS NULL THEN
    RAISE NOTICE
      'Alvo já ausente: overload legado de 10 argumentos não requer alteração';
  ELSE
    v_legacy_result := pg_get_function_result(v_legacy_oid);
    IF v_legacy_result IS DISTINCT FROM 'json' THEN
      RAISE EXCEPTION
        'Abortando: alvo legado tem retorno inesperado (%), esperado json',
        v_legacy_result;
    END IF;
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_legacy_oid) THEN
      RAISE EXCEPTION
        'Abortando: alvo legado não é SECURITY DEFINER';
    END IF;
    RAISE NOTICE
      'Alvo confirmado: % (OID %, retorno %); será removido sem CASCADE',
      pg_get_function_identity_arguments(v_legacy_oid),
      v_legacy_oid,
      v_legacy_result;
  END IF;

  v_current_result := pg_get_function_result(v_current_oid);
  IF v_current_result IS DISTINCT FROM 'json' THEN
    RAISE EXCEPTION
      'Abortando: overload vigente tem retorno inesperado (%), esperado json',
      v_current_result;
  END IF;

  SELECT p.prosecdef
    INTO v_current_security_definer
    FROM pg_proc p
   WHERE p.oid = v_current_oid;
  IF NOT v_current_security_definer THEN
    RAISE EXCEPTION
      'Abortando: overload vigente não é SECURITY DEFINER';
  END IF;

  IF NOT has_function_privilege('anon', v_current_oid, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_current_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_current_oid, 'EXECUTE') THEN
    RAISE EXCEPTION
      'Abortando: ACL do overload vigente não concede EXECUTE aos papéis do gateway';
  END IF;
  RAISE NOTICE
    'Contrato preservado: % (OID %, retorno %)',
    pg_get_function_identity_arguments(v_current_oid),
    v_current_oid,
    v_current_result;
END;
$$;

-- Não usar CASCADE: dependências inesperadas devem impedir a migration.
DROP FUNCTION IF EXISTS public.rpc_desempenho_vendas_bi(
  date,
  date,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) RESTRICT;

DO $$
DECLARE
  v_legacy_oid oid;
  v_current_oid oid;
  v_current_result text;
  v_current_security_definer boolean;
BEGIN
  v_legacy_oid := to_regprocedure(
    'public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text)'
  );
  v_current_oid := to_regprocedure(
    'public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text,text[])'
  );

  IF v_legacy_oid IS NOT NULL THEN
    RAISE EXCEPTION
      'Validação falhou: overload legado de 10 argumentos ainda existe (OID %)',
      v_legacy_oid;
  END IF;

  IF v_current_oid IS NULL THEN
    RAISE EXCEPTION
      'Validação falhou: overload vigente com p_funis text[] desapareceu';
  END IF;

  v_current_result := pg_get_function_result(v_current_oid);
  IF v_current_result IS DISTINCT FROM 'json' THEN
    RAISE EXCEPTION
      'Validação falhou: overload vigente tem retorno inesperado (%), esperado json',
      v_current_result;
  END IF;

  SELECT p.prosecdef
    INTO v_current_security_definer
    FROM pg_proc p
   WHERE p.oid = v_current_oid;
  IF NOT v_current_security_definer THEN
    RAISE EXCEPTION
      'Validação falhou: overload vigente não é SECURITY DEFINER';
  END IF;

  IF NOT has_function_privilege('anon', v_current_oid, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_current_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_current_oid, 'EXECUTE') THEN
    RAISE EXCEPTION
      'Validação falhou: ACL do overload vigente foi alterada';
  END IF;

  RAISE NOTICE
    'Validação OK: overload legado ausente; overload vigente com text[] preservado (OID %, retorno %)',
    v_current_oid,
    v_current_result;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
