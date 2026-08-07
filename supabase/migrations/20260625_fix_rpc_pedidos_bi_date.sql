-------------------------------------------------------------------------------
-- Fix: rpc_pedidos_bi — filtrar por data de fechamento do negocio (ganho)
--
-- Antes: filtro de data por p.pdo_dthpedido (data do pedido).
-- Depois: filtro de data por n.ngo_datafechamento (quando o negocio foi
--         concluido/ganho), em mirror.crm_negocios.
--
-- A RPC ja faz INNER JOIN com mirror.crm_negocios ON ngo_numero e ja filtra
-- LOWER(COALESCE(n.ngo_conclusao,'')) LIKE '%ganh%'. So o campo de data muda.
--
-- 3 pontos alterados:
--   1. CTE base WHERE: pdo_dthpedido -> ngo_datafechamento
--   2. CTE base SELECT: adiciona n.ngo_datafechamento (usado na evolucao)
--   3. CTE evolucao: TO_CHAR/GROUP BY pdo_dthpedido -> ngo_datafechamento
--
-- Idempotente (CREATE OR REPLACE). Sobrescreve a versao de
-- 20260625_sessao_f_date_filters.sql.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_pedidos_bi(
  p_from date,
  p_to date
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH base AS (
    SELECT
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_vlrfinanciado,
      p.pdo_vlrrecursoproprio,
      p.pdo_dthpedido,
      n.ngo_datafechamento,
      p.pdo_vendedor,
      p.pdo_cidadeufentrega,
      p.pdo_codigointerno,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%cancel%' AS is_cancelado
    FROM mirror.crm_pedidos p
    INNER JOIN mirror.crm_negocios n ON n.ngo_numero = p.ngo_numero
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%'
  ),
  -- KPIs
  kpi_agg AS (
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE is_aprovado), 0) AS faturamento,
      CASE WHEN COUNT(*) FILTER (WHERE is_aprovado) > 0
        THEN ROUND(SUM(pdo_vlrpedido) FILTER (WHERE is_aprovado) / COUNT(*) FILTER (WHERE is_aprovado), 2)
        ELSE 0
      END AS ticket_medio,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE is_aprovado)::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END AS percent_aprovado,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE pdo_vlrfinanciado > 0)::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END AS percent_financiado,
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE is_cancelado), 0) AS valor_cancelado
    FROM base
  ),
  kpis AS (
    SELECT json_build_object(
      'total', total,
      'faturamento', faturamento,
      'ticketMedio', ticket_medio,
      'percentAprovado', percent_aprovado,
      'percentFinanciado', percent_financiado,
      'valorCancelado', valor_cancelado
    ) AS val FROM kpi_agg
  ),
  -- Evolucao mensal (aprovados only) — agora por data de fechamento do negocio
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datafechamento::date, 'YYYY-MM') AS name,
        COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS faturamento,
        COUNT(*) AS qtd
      FROM base
      WHERE is_aprovado
      GROUP BY TO_CHAR(ngo_datafechamento::date, 'YYYY-MM')
    ) sub
  ),
  -- Por situacao
  situacao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        pdo_situacaopedido AS name,
        COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS valor,
        COUNT(*) AS qtd
      FROM base
      WHERE pdo_situacaopedido IS NOT NULL
      GROUP BY pdo_situacaopedido
    ) sub
  ),
  -- Mix pagamento (Recurso Proprio vs Financiado)
  mix AS (
    SELECT json_build_array(
      json_build_object('name', 'Recurso Proprio', 'value', COALESCE(SUM(pdo_vlrrecursoproprio) FILTER (WHERE is_aprovado), 0)::numeric),
      json_build_object('name', 'Financiado', 'value', COALESCE(SUM(pdo_vlrfinanciado) FILTER (WHERE is_aprovado), 0)::numeric)
    ) AS val
    FROM base
  ),
  -- Por vendedor (top 10, aprovados)
  vendedores AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT pdo_vendedor AS name, COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS value
      FROM base
      WHERE is_aprovado AND pdo_vendedor IS NOT NULL
      GROUP BY pdo_vendedor
      ORDER BY SUM(pdo_vlrpedido) DESC
      LIMIT 10
    ) sub
  ),
  -- Por cidade (top 10, aprovados)
  cidades AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT pdo_cidadeufentrega AS name, COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS value
      FROM base
      WHERE is_aprovado AND pdo_cidadeufentrega IS NOT NULL
      GROUP BY pdo_cidadeufentrega
      ORDER BY SUM(pdo_vlrpedido) DESC
      LIMIT 10
    ) sub
  ),
  -- Por grupo de produto (top 10, from crm_pedidos_item joined to base)
  grupo_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(pi.pdo_itemgrupo), ''), 'Sem grupo') AS name,
        COALESCE(SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)), 0) AS valor,
        COALESCE(SUM(GREATEST(pi.pdo_itemqtde::numeric, 1)), 0)::int AS qtd
      FROM mirror.crm_pedidos_item pi
      WHERE pi.pdo_codigointerno IN (SELECT pdo_codigointerno FROM base WHERE is_aprovado)
      GROUP BY COALESCE(NULLIF(TRIM(pi.pdo_itemgrupo), ''), 'Sem grupo')
      ORDER BY SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)) DESC
      LIMIT 10
    ) sub
  ),
  -- Por marca de produto (top 10, from crm_pedidos_item joined to base)
  marca_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(pi.pdo_itemmarca), ''), 'Sem marca') AS name,
        COALESCE(SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)), 0) AS valor,
        COALESCE(SUM(GREATEST(pi.pdo_itemqtde::numeric, 1)), 0)::int AS qtd
      FROM mirror.crm_pedidos_item pi
      WHERE pi.pdo_codigointerno IN (SELECT pdo_codigointerno FROM base WHERE is_aprovado)
      GROUP BY COALESCE(NULLIF(TRIM(pi.pdo_itemmarca), ''), 'Sem marca')
      ORDER BY SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)) DESC
      LIMIT 10
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'porSituacao', (SELECT val FROM situacao),
    'mixPagamento', (SELECT val FROM mix),
    'porVendedor', (SELECT val FROM vendedores),
    'porCidade', (SELECT val FROM cidades),
    'porGrupoProduto', (SELECT val FROM grupo_produto),
    'porMarcaProduto', (SELECT val FROM marca_produto)
  ) INTO result;

  RETURN result;
END;
$$;

-------------------------------------------------------------------------------
-- Reload PostgREST schema cache
-------------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
