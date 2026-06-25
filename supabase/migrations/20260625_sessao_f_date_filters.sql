-- Migration: Sessao F — alteracoes de filtro de data conforme decisao do cliente
-- Autor: @data-engineer (Dara)
-- Data: 2026-06-25
-- Branch: perf/bi-quick-wins
--
-- Mudanca #1: rpc_negocios_bi — trocar filtro de ngo_datafechamento por ngo_datacadastro
--   Decisao do cliente: "Negocios, eu iria pela data de abertura do negocio"
--   ngo_datacadastro = data de cadastro/abertura do negocio.
--   Afeta: WHERE principal + CTE evolucaoMensal.
--
-- Mudanca #2: rpc_pedidos_bi — filtrar apenas pedidos cujo negocio tem conclusao "Ganho"
--   Decisao do cliente: pedidos devem considerar apenas negocios ganhos.
--   Implementacao: INNER JOIN mirror.crm_negocios + WHERE ngo_conclusao LIKE '%ganh%'
--   Mantido: filtro de data por pdo_dthpedido (decisao do cliente).

-------------------------------------------------------------------------------
-- RPC 1: rpc_negocios_bi (sobrescreve — muda filtro para ngo_datacadastro)
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_negocios_bi(
  p_from date,
  p_to date,
  p_funis text[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_to date := LEAST(p_to, CURRENT_DATE);
BEGIN
  WITH deduped AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_vlrtotalnegociado,
      n.ngo_formaentrada,
      n.ngo_etapa,
      n.ngo_motivoperda,
      n.ngo_datacadastro,
      n.ngo_datafechamento,
      NULLIF(n.ngo_ciclovendas, '')::numeric AS ngo_ciclovendas,
      NULLIF(n.ngo_qtdacoes, '')::numeric AS ngo_qtdacoes,
      n.ngo_funil,
      n.ngo_vendedores,
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        ELSE 'andamento'
      END AS status_class
    FROM mirror.crm_negocios n
    WHERE n.ngo_datacadastro::date BETWEEN p_from AND v_to
      AND (p_funis IS NULL OR n.ngo_funil = ANY(p_funis))
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST, n.ngo_vlrtotalnegociado DESC NULLS LAST, n.ctid
  ),
  -- KPIs
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_negocios,
      COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos,
      COUNT(*) FILTER (WHERE status_class = 'perdido') AS perdidos,
      COUNT(*) FILTER (WHERE status_class = 'andamento') AS andamento,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class != 'perdido'), 0) AS pipeline_aberto,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'perdido'), 0) AS pipeline_perdido,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'ganho'), 0) AS valor_ganho,
      COALESCE(AVG(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'ganho'), 0) AS ticket_medio_ganho,
      COALESCE(AVG(ngo_ciclovendas) FILTER (WHERE status_class = 'ganho' AND ngo_ciclovendas > 0), 0) AS ciclo_medio_dias,
      COALESCE(AVG(ngo_qtdacoes), 0) AS esforco_medio
    FROM deduped
  ),
  kpis AS (
    SELECT json_build_object(
      'totalNegocios', total_negocios,
      'ganhos', ganhos,
      'perdidos', perdidos,
      'andamento', andamento,
      'taxaConversao', CASE WHEN total_negocios > 0 THEN ROUND((ganhos::numeric / total_negocios) * 100, 1) ELSE 0 END,
      'pipelineAberto', pipeline_aberto,
      'pipelinePerdido', pipeline_perdido,
      'valorGanho', valor_ganho,
      'ticketMedioGanho', ROUND(ticket_medio_ganho, 2),
      'cicloMedioDias', ROUND(ciclo_medio_dias, 0),
      'esforcoMedio', ROUND(esforco_medio, 1)
    ) AS val FROM kpi_agg
  ),
  -- Funil por etapa
  funil AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.qtd DESC), '[]'::json) AS val
    FROM (
      SELECT ngo_etapa AS name, SUM(ngo_vlrtotalnegociado)::numeric AS valor, COUNT(*) AS qtd
      FROM deduped
      WHERE ngo_etapa IS NOT NULL
      GROUP BY ngo_etapa
    ) sub
  ),
  -- Por origem (top 8)
  origens AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        ngo_formaentrada AS name,
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos,
        COUNT(*) FILTER (WHERE status_class = 'perdido') AS perdidos,
        COUNT(*) FILTER (WHERE status_class = 'andamento') AS andamento,
        COUNT(*) AS total,
        CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status_class = 'ganho')::numeric / COUNT(*)) * 100, 1) ELSE 0 END AS taxa,
        COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'ganho'), 0) AS "valorGanho"
      FROM deduped
      WHERE ngo_formaentrada IS NOT NULL
      GROUP BY ngo_formaentrada
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) sub
  ),
  -- Motivos de perda (top 8)
  motivos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT ngo_motivoperda AS name, SUM(ngo_vlrtotalnegociado)::numeric AS valor, COUNT(*) AS qtd
      FROM deduped
      WHERE status_class = 'perdido' AND ngo_motivoperda IS NOT NULL
      GROUP BY ngo_motivoperda
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) sub
  ),
  -- Evolucao mensal
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datacadastro::date, 'YYYY-MM') AS name,
        COUNT(*) AS novos,
        COALESCE(SUM(ngo_vlrtotalnegociado), 0)::numeric AS "valorCriado"
      FROM deduped
      GROUP BY TO_CHAR(ngo_datacadastro::date, 'YYYY-MM')
      ORDER BY TO_CHAR(ngo_datacadastro::date, 'YYYY-MM')
    ) sub
  ),
  -- Ranking consultor (top 10)
  ranking AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        ngo_vendedores AS name,
        COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'ganho'), 0)::numeric AS "valorGanho",
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos,
        COUNT(*) AS total,
        CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status_class = 'ganho')::numeric / COUNT(*)) * 100, 1) ELSE 0 END AS taxa
      FROM deduped
      WHERE ngo_vendedores IS NOT NULL
      GROUP BY ngo_vendedores
      ORDER BY COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'ganho'), 0) DESC
      LIMIT 10
    ) sub
  ),
  -- Velocidade do funil
  velocidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub."diasMedio" DESC), '[]'::json) AS val
    FROM (
      SELECT
        fe.etapa_dscstatusnegocio AS name,
        ROUND(AVG(fe.fne_duracaodias::numeric), 1) AS "diasMedio",
        COUNT(*) AS qtd
      FROM mirror.crm_funil_etapa fe
      WHERE fe.fne_duracaodias > 0
        AND fe.etapa_dscstatusnegocio IS NOT NULL
        AND fe.ngo_numero IN (SELECT ngo_numero FROM deduped)
      GROUP BY fe.etapa_dscstatusnegocio
      ORDER BY AVG(fe.fne_duracaodias::numeric) DESC
      LIMIT 12
    ) sub
  ),
  -- Duracao media total
  duracao_total AS (
    SELECT COALESCE(ROUND(AVG(fe.fne_duracaodias::numeric), 1), 0) AS val
    FROM mirror.crm_funil_etapa fe
    WHERE fe.fne_duracaodias > 0
      AND fe.ngo_numero IN (SELECT ngo_numero FROM deduped)
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'funilPorEtapa', (SELECT val FROM funil),
    'porOrigem', (SELECT val FROM origens),
    'motivosPerda', (SELECT val FROM motivos),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'rankingConsultor', (SELECT val FROM ranking),
    'velocidadeFunil', (SELECT val FROM velocidade),
    'duracaoMediaTotal', (SELECT val FROM duracao_total)
  ) INTO result;

  RETURN result;
END;
$$;


-------------------------------------------------------------------------------
-- RPC 2: rpc_pedidos_bi (sobrescreve — adiciona filtro por negocio ganho)
--
-- Mudanca: INNER JOIN mirror.crm_negocios ON ngo_numero para filtrar apenas
-- pedidos cujo negocio associado tem conclusao "ganho" (LIKE '%ganh%').
-- Mantido: filtro de data por pdo_dthpedido conforme decisao do cliente.
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
      p.pdo_vendedor,
      p.pdo_cidadeufentrega,
      p.pdo_codigointerno,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%cancel%' AS is_cancelado
    FROM mirror.crm_pedidos p
    INNER JOIN mirror.crm_negocios n ON n.ngo_numero = p.ngo_numero
    WHERE p.pdo_dthpedido::date BETWEEN p_from AND p_to
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
  -- Evolucao mensal (aprovados only)
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(pdo_dthpedido::date, 'YYYY-MM') AS name,
        COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS faturamento,
        COUNT(*) AS qtd
      FROM base
      WHERE is_aprovado
      GROUP BY TO_CHAR(pdo_dthpedido::date, 'YYYY-MM')
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
