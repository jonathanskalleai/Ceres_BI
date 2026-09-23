-- Migration: Remove overloads legados ambíguos das listas de Ações e do GPO
-- Data: 2026-09-22
--
-- Evidência de produção (auditoria read-only):
--   * rpc_acoes_pedidos_ganhos existe com 6 argumentos e com 7 argumentos
--     (o sétimo é p_funis text[]);
--   * rpc_acoes_negocios_perdidos existe com 6 argumentos e com 7 argumentos
--     (o sétimo é p_funis text[]);
--   * rpc_evolucao_ganhos_perdidos_12m existe com p_vendedor (1 argumento) e
--     com p_vendedor, p_from, p_to (3 argumentos).
--
-- Chamadas RPC sem o argumento novo são ambíguas no PostgREST (PGRST203).
-- Os overloads de 7/3 argumentos são os contratos vigentes usados pelo BI;
-- os de 6/1 argumentos são os legados removidos abaixo.
--
-- Escopo deliberadamente estreito:
--   * valida identidade, retorno, SECURITY DEFINER e privilégios do contrato
--     vigente antes de qualquer DROP;
--   * remove somente os três overloads legados com RESTRICT;
--   * não altera os overloads vigentes, ACL, RLS, tabelas ou funções auxiliares.
--
-- Rollback manual (somente após aprovação e validação): reaplicar as definições
-- legadas correspondentes das migrations históricas de Ações (20260810_*
-- /20260803_*) e a definição de 1 argumento do GPO disponível no snapshot do
-- banco, restaurando também os GRANTs originais; depois emitir o NOTIFY abaixo.

BEGIN;

DO $$
DECLARE
  v_pedidos_legacy oid;
  v_pedidos_current oid;
  v_negocios_legacy oid;
  v_negocios_current oid;
  v_gpo_legacy oid;
  v_gpo_current oid;
  v_result text;
  v_security_definer boolean;
  v_role text;
BEGIN
  v_pedidos_legacy := to_regprocedure(
    'public.rpc_acoes_pedidos_ganhos(date,date,text,text,integer,integer)'
  );
  v_pedidos_current := to_regprocedure(
    'public.rpc_acoes_pedidos_ganhos(date,date,text,text,integer,integer,text[])'
  );
  v_negocios_legacy := to_regprocedure(
    'public.rpc_acoes_negocios_perdidos(date,date,text,text,integer,integer)'
  );
  v_negocios_current := to_regprocedure(
    'public.rpc_acoes_negocios_perdidos(date,date,text,text,integer,integer,text[])'
  );
  v_gpo_legacy := to_regprocedure(
    'public.rpc_evolucao_ganhos_perdidos_12m(text)'
  );
  v_gpo_current := to_regprocedure(
    'public.rpc_evolucao_ganhos_perdidos_12m(text,date,date)'
  );

  IF v_pedidos_current IS NULL
     OR v_negocios_current IS NULL
     OR v_gpo_current IS NULL THEN
    RAISE EXCEPTION
      'Abortando: contrato vigente ausente (pedidos %, negocios %, gpo %)',
      v_pedidos_current,
      v_negocios_current,
      v_gpo_current;
  END IF;

  -- A identidade sozinha não basta para um DROP seguro: confirma também que
  -- cada alvo legado ainda tem o tipo de retorno e o modo de segurança
  -- esperados. Se tiver sido reaproveitado, a migration aborta.
  IF v_pedidos_legacy IS NOT NULL THEN
    IF pg_get_function_result(v_pedidos_legacy) IS DISTINCT FROM 'json' THEN
      RAISE EXCEPTION
        'Abortando: retorno inesperado do pedidos ganhos legado: %',
        pg_get_function_result(v_pedidos_legacy);
    END IF;
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_pedidos_legacy) THEN
      RAISE EXCEPTION 'Abortando: pedidos ganhos legado não é SECURITY DEFINER';
    END IF;
  END IF;

  IF v_negocios_legacy IS NOT NULL THEN
    IF pg_get_function_result(v_negocios_legacy) IS DISTINCT FROM 'json' THEN
      RAISE EXCEPTION
        'Abortando: retorno inesperado do negócios perdidos legado: %',
        pg_get_function_result(v_negocios_legacy);
    END IF;
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_negocios_legacy) THEN
      RAISE EXCEPTION 'Abortando: negócios perdidos legado não é SECURITY DEFINER';
    END IF;
  END IF;

  IF v_gpo_legacy IS NOT NULL THEN
    IF pg_get_function_result(v_gpo_legacy) IS DISTINCT FROM
       'TABLE(mes text, oportunidades bigint, ganhos bigint, perdidos bigint, valor_ganho numeric, valor_perdido numeric, valor_oportunidades numeric)' THEN
      RAISE EXCEPTION
        'Abortando: retorno inesperado do GPO legado: %',
        pg_get_function_result(v_gpo_legacy);
    END IF;
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_gpo_legacy) THEN
      RAISE EXCEPTION 'Abortando: GPO legado não é SECURITY DEFINER';
    END IF;
  END IF;

  -- O contrato vigente precisa continuar acessível aos papéis do gateway.
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
      RAISE EXCEPTION 'Abortando: role esperada não existe: %', v_role;
    END IF;

    IF NOT has_function_privilege(v_role, v_pedidos_current, 'EXECUTE')
       OR NOT has_function_privilege(v_role, v_negocios_current, 'EXECUTE')
       OR NOT has_function_privilege(v_role, v_gpo_current, 'EXECUTE') THEN
      RAISE EXCEPTION
        'Abortando: ACL do contrato vigente não concede EXECUTE a %',
        v_role;
    END IF;
  END LOOP;

  -- Retornos são parte do contrato consumido pelo frontend/serviço Python.
  FOREACH v_result IN ARRAY ARRAY[
    pg_get_function_result(v_pedidos_current),
    pg_get_function_result(v_negocios_current)
  ] LOOP
    IF v_result <> 'json' THEN
      RAISE EXCEPTION
        'Abortando: retorno inesperado nas RPCs de listas de Ações: %',
        v_result;
    END IF;
  END LOOP;

  v_result := pg_get_function_result(v_gpo_current);
  IF v_result <> 'TABLE(mes text, oportunidades bigint, ganhos bigint, perdidos bigint, valor_ganho numeric, valor_perdido numeric, valor_oportunidades numeric)' THEN
    RAISE EXCEPTION 'Abortando: retorno inesperado do GPO vigente: %', v_result;
  END IF;

  SELECT p.prosecdef
    INTO v_security_definer
    FROM pg_proc p
   WHERE p.oid = v_pedidos_current;
  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'Abortando: pedidos ganhos vigente não é SECURITY DEFINER';
  END IF;

  SELECT p.prosecdef
    INTO v_security_definer
    FROM pg_proc p
   WHERE p.oid = v_negocios_current;
  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'Abortando: negócios perdidos vigente não é SECURITY DEFINER';
  END IF;

  SELECT p.prosecdef
    INTO v_security_definer
    FROM pg_proc p
   WHERE p.oid = v_gpo_current;
  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'Abortando: GPO vigente não é SECURITY DEFINER';
  END IF;

  RAISE NOTICE
    'Contratos preservados: pedidos %, negócios %, GPO %',
    pg_get_function_identity_arguments(v_pedidos_current),
    pg_get_function_identity_arguments(v_negocios_current),
    pg_get_function_identity_arguments(v_gpo_current);

  IF v_pedidos_legacy IS NULL
     AND v_negocios_legacy IS NULL
     AND v_gpo_legacy IS NULL THEN
    RAISE NOTICE 'Overloads legados já ausentes; migration será no-op além da validação';
  ELSE
    RAISE NOTICE
      'Alvos legados confirmados: pedidos %, negócios %, GPO %',
      v_pedidos_legacy,
      v_negocios_legacy,
      v_gpo_legacy;
  END IF;
END;
$$;

-- RESTRICT é intencional: dependência inesperada deve abortar a migration,
-- nunca remover objetos consumidores em cascata.
DROP FUNCTION IF EXISTS public.rpc_acoes_pedidos_ganhos(
  date,
  date,
  text,
  text,
  integer,
  integer
) RESTRICT;

DROP FUNCTION IF EXISTS public.rpc_acoes_negocios_perdidos(
  date,
  date,
  text,
  text,
  integer,
  integer
) RESTRICT;

DROP FUNCTION IF EXISTS public.rpc_evolucao_ganhos_perdidos_12m(
  text
) RESTRICT;

DO $$
DECLARE
  v_pedidos_legacy oid;
  v_pedidos_current oid;
  v_negocios_legacy oid;
  v_negocios_current oid;
  v_gpo_legacy oid;
  v_gpo_current oid;
BEGIN
  v_pedidos_legacy := to_regprocedure(
    'public.rpc_acoes_pedidos_ganhos(date,date,text,text,integer,integer)'
  );
  v_pedidos_current := to_regprocedure(
    'public.rpc_acoes_pedidos_ganhos(date,date,text,text,integer,integer,text[])'
  );
  v_negocios_legacy := to_regprocedure(
    'public.rpc_acoes_negocios_perdidos(date,date,text,text,integer,integer)'
  );
  v_negocios_current := to_regprocedure(
    'public.rpc_acoes_negocios_perdidos(date,date,text,text,integer,integer,text[])'
  );
  v_gpo_legacy := to_regprocedure(
    'public.rpc_evolucao_ganhos_perdidos_12m(text)'
  );
  v_gpo_current := to_regprocedure(
    'public.rpc_evolucao_ganhos_perdidos_12m(text,date,date)'
  );

  IF v_pedidos_legacy IS NOT NULL
     OR v_negocios_legacy IS NOT NULL
     OR v_gpo_legacy IS NOT NULL THEN
    RAISE EXCEPTION
      'Validação falhou: overload legado ainda existe (pedidos %, negócios %, GPO %)',
      v_pedidos_legacy,
      v_negocios_legacy,
      v_gpo_legacy;
  END IF;

  IF v_pedidos_current IS NULL
     OR v_negocios_current IS NULL
     OR v_gpo_current IS NULL THEN
    RAISE EXCEPTION
      'Validação falhou: contrato vigente desapareceu (pedidos %, negócios %, GPO %)',
      v_pedidos_current,
      v_negocios_current,
      v_gpo_current;
  END IF;

  IF pg_get_function_result(v_pedidos_current) <> 'json'
     OR pg_get_function_result(v_negocios_current) <> 'json'
     OR pg_get_function_result(v_gpo_current) <> 'TABLE(mes text, oportunidades bigint, ganhos bigint, perdidos bigint, valor_ganho numeric, valor_perdido numeric, valor_oportunidades numeric)' THEN
    RAISE EXCEPTION 'Validação falhou: retorno do contrato vigente foi alterado';
  END IF;

  IF NOT has_function_privilege('anon', v_pedidos_current, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_pedidos_current, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_pedidos_current, 'EXECUTE')
     OR NOT has_function_privilege('anon', v_negocios_current, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_negocios_current, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_negocios_current, 'EXECUTE')
     OR NOT has_function_privilege('anon', v_gpo_current, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_gpo_current, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_gpo_current, 'EXECUTE') THEN
    RAISE EXCEPTION 'Validação falhou: ACL do contrato vigente foi alterada';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc p
     WHERE p.oid = ANY (ARRAY[v_pedidos_current, v_negocios_current, v_gpo_current])
       AND NOT p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Validação falhou: SECURITY DEFINER do contrato vigente foi alterado';
  END IF;

  RAISE NOTICE
    'Validação OK: legados removidos; contratos atuais preservados com retorno e ACL';
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
