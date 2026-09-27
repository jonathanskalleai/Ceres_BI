-------------------------------------------------------------------------------
-- Server-side derived measures for the Ações contracts.
--
-- The previous React widgets recomputed ticket médio and conversion with
-- reduce()/division.  Keep the proven SQL implementations as *_core backup
-- functions and expose the same signatures through a thin semantic wrapper.
-- This is additive at the API boundary: existing fields and row semantics are
-- preserved, while the derived fields are now calculated beside their source
-- aggregates in PostgreSQL.
-------------------------------------------------------------------------------

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.rpc_acoes_bi_periodo(date,date,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'rpc_acoes_bi_periodo canonical function is missing';
  END IF;
  IF to_regprocedure('public.rpc_acoes_bi_periodo_core(date,date,text,text,text)') IS NULL THEN
    ALTER FUNCTION public.rpc_acoes_bi_periodo(date, date, text, text, text)
      RENAME TO rpc_acoes_bi_periodo_core;
  END IF;

  IF to_regprocedure('public.rpc_acoes_funil_gestao_periodo(date,date,text,text)') IS NULL THEN
    RAISE EXCEPTION 'rpc_acoes_funil_gestao_periodo canonical function is missing';
  END IF;
  IF to_regprocedure('public.rpc_acoes_funil_gestao_periodo_core(date,date,text,text)') IS NULL THEN
    ALTER FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
      RENAME TO rpc_acoes_funil_gestao_periodo_core;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_acoes_bi_periodo(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, mirror, pg_catalog
AS $wrapper$
DECLARE
  v_payload jsonb;
  v_kpis jsonb;
  v_valor_ganho numeric;
  v_pedidos_ganho numeric;
  v_ticket numeric;
BEGIN
  v_payload := public.rpc_acoes_bi_periodo_core(
    p_from, p_to, p_vendedor, p_tipo_acao, p_cidade
  )::jsonb;
  v_kpis := v_payload -> 'kpis';

  IF jsonb_typeof(v_kpis -> 'valorGanho') = 'number' THEN
    v_valor_ganho := (v_kpis ->> 'valorGanho')::numeric;
  END IF;
  IF jsonb_typeof(v_kpis -> 'negociosGanho') = 'number' THEN
    v_pedidos_ganho := (v_kpis ->> 'negociosGanho')::numeric;
  END IF;

  IF v_valor_ganho IS NOT NULL AND v_pedidos_ganho IS NOT NULL THEN
    v_ticket := CASE
      WHEN v_pedidos_ganho > 0 THEN ROUND(v_valor_ganho / v_pedidos_ganho, 2)
      ELSE 0
    END;
    v_payload := jsonb_set(
      v_payload,
      '{kpis,ticketMedioGanho}',
      to_jsonb(v_ticket),
      true
    );
  END IF;

  RETURN v_payload::json;
END;
$wrapper$;

ALTER FUNCTION public.rpc_acoes_bi_periodo(
  date, date, text, text, text
) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.rpc_acoes_bi_periodo(
  date, date, text, text, text
) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo(
      date, date, text, text, text
    ) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo(
      date, date, text, text, text
    ) TO ceres_bi_api;
  END IF;
END;
$$;

-- The backup remains available to the API/service roles only; the browser must
-- not be able to bypass the semantic wrapper.
REVOKE ALL ON FUNCTION public.rpc_acoes_bi_periodo_core(
  date, date, text, text, text
) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo_core(
      date, date, text, text, text
    ) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo_core(
      date, date, text, text, text
    ) TO ceres_bi_api;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_bi_periodo(
  date, date, text, text, text
) IS 'Contrato semântico de ações; ticketMedioGanho é calculado no PostgreSQL sobre os agregados canônicos.';

CREATE OR REPLACE FUNCTION public.rpc_acoes_funil_gestao_periodo(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, mirror, pg_catalog
AS $wrapper$
DECLARE
  v_payload jsonb;
  v_funil jsonb;
  v_oportunidades numeric;
  v_ganhos numeric;
  v_taxa numeric;
BEGIN
  v_payload := public.rpc_acoes_funil_gestao_periodo_core(
    p_from, p_to, p_vendedor, p_cidade
  )::jsonb;
  v_funil := v_payload -> 'funil';

  IF jsonb_typeof(v_funil -> 'oportunidades') = 'number' THEN
    v_oportunidades := (v_funil ->> 'oportunidades')::numeric;
  END IF;
  IF jsonb_typeof(v_funil -> 'ganhos') = 'number' THEN
    v_ganhos := (v_funil ->> 'ganhos')::numeric;
  END IF;

  IF v_oportunidades IS NOT NULL AND v_ganhos IS NOT NULL THEN
    v_taxa := CASE
      WHEN v_oportunidades > 0 THEN ROUND(v_ganhos * 100 / v_oportunidades, 1)
      ELSE NULL
    END;
    v_payload := jsonb_set(
      v_payload,
      '{funil,taxaGanho}',
      COALESCE(to_jsonb(v_taxa), 'null'::jsonb),
      true
    );
  END IF;

  RETURN v_payload::json;
END;
$wrapper$;

ALTER FUNCTION public.rpc_acoes_funil_gestao_periodo(
  date, date, text, text
) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.rpc_acoes_funil_gestao_periodo(
  date, date, text, text
) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(
      date, date, text, text
    ) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(
      date, date, text, text
    ) TO ceres_bi_api;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_acoes_funil_gestao_periodo_core(
  date, date, text, text
) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo_core(
      date, date, text, text
    ) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo_core(
      date, date, text, text
    ) TO ceres_bi_api;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_funil_gestao_periodo(
  date, date, text, text
) IS 'Contrato semântico do funil de ações; taxaGanho é calculada no PostgreSQL sem divisão no navegador.';

COMMIT;
