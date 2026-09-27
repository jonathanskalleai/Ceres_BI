-------------------------------------------------------------------------------
-- Fecha os overloads históricos de Desempenho para execução direta pelo browser.
--
-- Algumas instalações antigas criaram assinaturas de 6 e 10 argumentos com
-- EXECUTE para `authenticated`. A API semântica atual usa a assinatura de 11
-- argumentos através do role `ceres_bi_api`; manter os overloads antigos
-- públicos permitiria contornar a autorização por módulo do gateway. A
-- migration é condicional para permanecer segura em bases que já removeram os
-- overloads (e não apaga nenhuma função).
-------------------------------------------------------------------------------

BEGIN;

DO $$
DECLARE
  v_signature text;
  v_signatures constant text[] := ARRAY[
    'date,date,integer,text,text,text',
    'date,date,integer,text,text,text,text,text,text,text',
    'date,date,integer,text,text,text,text,text,text,text,text[]'
  ];
BEGIN
  FOREACH v_signature IN ARRAY v_signatures LOOP
    IF to_regprocedure(format('public.rpc_desempenho_vendas_bi(%s)', v_signature)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.rpc_desempenho_vendas_bi(%s) FROM PUBLIC, anon, authenticated',
      v_signature
    );

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(%s) TO service_role',
        v_signature
      );
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(%s) TO ceres_bi_api',
        v_signature
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.rpc_desempenho_vendas_bi(
  date, date, integer, text, text, text, text, text, text, text, text[]
) IS 'Contrato semântico de desempenho; acesso de produção somente pelo gateway ceres_bi_api.';

NOTIFY pgrst, 'reload schema';

COMMIT;
