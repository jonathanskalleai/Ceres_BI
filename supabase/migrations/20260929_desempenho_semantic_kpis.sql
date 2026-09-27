-------------------------------------------------------------------------------
-- Completa o contrato semântico de Desempenho sem duplicar a consulta pesada.
--
-- A função core continua sendo a fonte canônica dos números. Este wrapper
-- apenas acrescenta a medida derivada que a tela exibe, no PostgreSQL, para
-- que o React não precise recalcular taxa de conversão a cada renderização.
-- Valores inválidos ou ausentes não são convertidos silenciosamente em zero;
-- nesse caso a medida permanece JSON null e o contrato de dados sinaliza a
-- ausência para a camada cliente.
-------------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_desempenho_vendas_bi(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_condicao text DEFAULT NULL,
  p_produto text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_banco text DEFAULT NULL,
  p_motivo_perda text DEFAULT NULL,
  p_funis text[] DEFAULT NULL
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
  v_total_pedidos numeric;
  v_total_perdido numeric;
  v_decididos numeric;
  v_taxa numeric;
BEGIN
  v_payload := public.rpc_desempenho_vendas_bi_core(
    p_from, p_to, p_ano, p_vendedor, p_cidade, p_condicao,
    p_produto, p_origem, p_banco, p_motivo_perda, p_funis
  )::jsonb;
  v_kpis := v_payload -> 'kpis';

  IF jsonb_typeof(v_kpis -> 'totalPedidos') = 'number' THEN
    v_total_pedidos := (v_kpis ->> 'totalPedidos')::numeric;
  END IF;
  IF jsonb_typeof(v_kpis -> 'totalPerdido') = 'number' THEN
    v_total_perdido := (v_kpis ->> 'totalPerdido')::numeric;
  ELSIF jsonb_typeof(v_kpis -> 'qtdPerdido') = 'number' THEN
    v_total_perdido := (v_kpis ->> 'qtdPerdido')::numeric;
  END IF;

  IF v_total_pedidos IS NOT NULL AND v_total_perdido IS NOT NULL THEN
    v_decididos := v_total_pedidos + v_total_perdido;
    v_taxa := CASE
      WHEN v_decididos > 0 THEN ROUND((v_total_pedidos / v_decididos) * 100, 1)
      ELSE 0
    END;
    v_payload := jsonb_set(
      v_payload,
      '{kpis,taxaConversao}',
      to_jsonb(v_taxa),
      true
    );
  END IF;

  RETURN v_payload::json;
END;
$wrapper$;

ALTER FUNCTION public.rpc_desempenho_vendas_bi(
  date, date, integer, text, text, text, text, text, text, text, text[]
) OWNER TO supabase_admin;

REVOKE ALL ON FUNCTION public.rpc_desempenho_vendas_bi(
  date, date, integer, text, text, text, text, text, text, text, text[]
) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(
      date, date, integer, text, text, text, text, text, text, text, text[]
    ) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(
      date, date, integer, text, text, text, text, text, text, text, text[]
    ) TO ceres_bi_api;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rpc_desempenho_vendas_bi(
  date, date, integer, text, text, text, text, text, text, text, text[]
) IS 'Contrato semântico de desempenho; medidas derivadas são calculadas no PostgreSQL.';

COMMIT;
