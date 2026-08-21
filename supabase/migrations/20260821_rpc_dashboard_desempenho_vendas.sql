-- Migration: RPC para o Novo Dashboard de Desempenho de Vendas
-- Autor: Ceres BI Team
-- Data: 2026-08-21
-- Descrição: Agrega dados enriquecidos com cruzamentos entre Pedidos, Negócios, Itens, Usuários e Clientes.
--            Retorna métricas no padrão analítico: QTD, %, TICKET MÉDIO e VALOR TOTAL com visão Anual e filtros.

CREATE OR REPLACE FUNCTION public.rpc_desempenho_vendas_bi(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_condicao text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_from date;
  v_to date;
BEGIN
  -- Definir intervalo de data considerando filtro de ano ou dateRange
  IF p_ano IS NOT NULL THEN
    v_from := make_date(p_ano, 1, 1);
    v_to := make_date(p_ano, 12, 31);
  ELSE
    v_from := COALESCE(p_from, make_date(EXTRACT(YEAR FROM CURRENT_DATE)::integer, 1, 1));
    v_to := COALESCE(p_to, CURRENT_DATE);
  END IF;

  WITH base_pedidos AS (
    SELECT
      p.pdo_codigointerno,
      p.ngo_numero,
      p.pdo_situacaopedido,
      COALESCE(p.pdo_vlrpedido, 0) AS pdo_vlrpedido,
      COALESCE(p.pdo_vlrfinanciado, 0) AS pdo_vlrfinanciado,
      COALESCE(p.pdo_vlrrecursoproprio, 0) AS pdo_vlrrecursoproprio,
      p.pdo_dthpedido,
      EXTRACT(YEAR FROM p.pdo_dthpedido)::integer AS ano_pedido,
      COALESCE(NULLIF(TRIM(p.pdo_vendedor), ''), 'Não Informado') AS pdo_vendedor,
      COALESCE(NULLIF(TRIM(p.pdo_cidadeufentrega), ''), NULLIF(TRIM(p.emp_cidade), ''), 'Não Informada') AS cidade_entrega,
      COALESCE(NULLIF(TRIM(p.pdo_financiamentobanco), ''), 'Não Informado') AS pdo_banco,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%cancel%' AS is_cancelado
    FROM mirror.crm_pedidos p
    WHERE p.pdo_dthpedido::date BETWEEN v_from AND v_to
      AND (p_vendedor IS NULL OR p.pdo_vendedor ILIKE '%' || p_vendedor || '%')
      AND (p_cidade IS NULL OR p.pdo_cidadeufentrega ILIKE '%' || p_cidade || '%' OR p.emp_cidade ILIKE '%' || p_cidade || '%')
  ),
  dedup_negocios AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      COALESCE(n.ngo_vlrtotalnegociado, 0) AS ngo_vlrtotalnegociado,
      COALESCE(NULLIF(TRIM(n.ngo_formaentrada), ''), 'Não Informada') AS ngo_formaentrada,
      COALESCE(NULLIF(TRIM(n.ngo_campanha), ''), 'Sem Campanha') AS ngo_campanha,
      COALESCE(NULLIF(TRIM(n.ngo_motivoperda), ''), 'Não Informado') AS ngo_motivoperda,
      COALESCE(NULLIF(TRIM(n.mpp_produtoperdamarca), ''), 'Não Informada') AS mpp_produtoperdamarca,
      COALESCE(NULLIF(TRIM(n.cli_tipocliente), ''), 'Não Informado') AS cli_tipocliente,
      COALESCE(NULLIF(TRIM(n.prd_condicaoproduto), ''), 'Novo') AS prd_condicaoproduto,
      n.ngo_datafechamento,
      n.ngo_datacadastro,
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        ELSE 'andamento'
      END AS status_class
    FROM mirror.crm_negocios n
    WHERE (n.ngo_datafechamento::date BETWEEN v_from AND v_to OR (n.ngo_datafechamento IS NULL AND n.ngo_datacadastro::date BETWEEN v_from AND v_to))
      AND (p_vendedor IS NULL OR n.ngo_vendedores ILIKE '%' || p_vendedor || '%')
      AND (p_cidade IS NULL OR n.cli_cidade ILIKE '%' || p_cidade || '%' OR n.emp_cidade ILIKE '%' || p_cidade || '%')
      AND (p_condicao IS NULL OR n.prd_condicaoproduto ILIKE '%' || p_condicao || '%')
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  -- Totais Gerais para cálculo de %
  total_aprovados AS (
    SELECT
      COUNT(DISTINCT pdo_codigointerno) AS qtd_total,
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE is_aprovado), 0) AS faturamento_total,
      COALESCE(SUM(pdo_vlrfinanciado) FILTER (WHERE is_aprovado), 0) AS faturamento_financiado,
      COALESCE(SUM(pdo_vlrrecursoproprio) FILTER (WHERE is_aprovado), 0) AS faturamento_proprio
    FROM base_pedidos
    WHERE is_aprovado
  ),
  -- 1. KPIs
  kpi_agg AS (
    SELECT
      (SELECT faturamento_total FROM total_aprovados) AS faturamento,
      (SELECT qtd_total FROM total_aprovados) AS total_pedidos,
      CASE
        WHEN (SELECT qtd_total FROM total_aprovados) > 0
        THEN ROUND((SELECT faturamento_total FROM total_aprovados) / (SELECT qtd_total FROM total_aprovados), 2)
        ELSE 0
      END AS ticket_medio,
      (SELECT faturamento_financiado FROM total_aprovados) AS valor_financiado,
      (SELECT faturamento_proprio FROM total_aprovados) AS valor_recurso_proprio,
      CASE
        WHEN (SELECT faturamento_total FROM total_aprovados) > 0
        THEN ROUND(((SELECT faturamento_financiado FROM total_aprovados) / (SELECT faturamento_total FROM total_aprovados)) * 100, 1)
        ELSE 0
      END AS percent_financiado,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'perdido'), 0) AS valor_perdido,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'andamento'), 0) AS pipeline_aberto
    FROM dedup_negocios
  ),
  kpis AS (
    SELECT json_build_object(
      'faturamento', faturamento,
      'totalPedidos', total_pedidos,
      'ticketMedio', ticket_medio,
      'valorFinanciado', valor_financiado,
      'valorRecursoProprio', valor_recurso_proprio,
      'percentFinanciado', percent_financiado,
      'valorPerdido', valor_perdido,
      'pipelineAberto', pipeline_aberto
    ) AS val FROM kpi_agg
  ),
  -- 2. Ranking de Vendedores (Quem vende mais)
  ranking_vendedores AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.pdo_vendedor AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM total_aprovados) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM total_aprovados)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM base_pedidos p
      WHERE p.is_aprovado
      GROUP BY p.pdo_vendedor
      ORDER BY SUM(p.pdo_vlrpedido) DESC
      LIMIT 20
    ) sub
  ),
  -- 3. Produtos / Grupos / Modelos Mais Vendidos
  ranking_produtos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(pi.pdo_itemdescricao), ''), NULLIF(TRIM(pi.pdo_itemmodelo), ''), NULLIF(TRIM(pi.pdo_itemgrupo), ''), 'Produto Sem Descrição') AS name,
        COALESCE(NULLIF(TRIM(pi.pdo_itemmarca), ''), 'Outras') AS marca,
        COALESCE(NULLIF(TRIM(pi.pdo_itemgrupo), ''), 'Geral') AS grupo,
        COALESCE(SUM(GREATEST(pi.pdo_itemqtde::numeric, 1)), 0)::int AS qtd,
        COALESCE(SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM total_aprovados) > 0
          THEN ROUND((SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)) / (SELECT faturamento_total FROM total_aprovados)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN SUM(GREATEST(pi.pdo_itemqtde::numeric, 1)) > 0
          THEN ROUND(SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)) / SUM(GREATEST(pi.pdo_itemqtde::numeric, 1)), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM mirror.crm_pedidos_item pi
      INNER JOIN base_pedidos bp ON bp.pdo_codigointerno = pi.pdo_codigointerno AND bp.is_aprovado
      GROUP BY
        COALESCE(NULLIF(TRIM(pi.pdo_itemdescricao), ''), NULLIF(TRIM(pi.pdo_itemmodelo), ''), NULLIF(TRIM(pi.pdo_itemgrupo), ''), 'Produto Sem Descrição'),
        COALESCE(NULLIF(TRIM(pi.pdo_itemmarca), ''), 'Outras'),
        COALESCE(NULLIF(TRIM(pi.pdo_itemgrupo), ''), 'Geral')
      ORDER BY SUM(pi.pdo_itemvlrunitario::numeric * GREATEST(pi.pdo_itemqtde::numeric, 1)) DESC
      LIMIT 20
    ) sub
  ),
  -- 4. Cidades / Filiais com mais vendas
  ranking_cidades AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.cidade_entrega AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM total_aprovados) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM total_aprovados)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM base_pedidos p
      WHERE p.is_aprovado
      GROUP BY p.cidade_entrega
      ORDER BY SUM(p.pdo_vlrpedido) DESC
      LIMIT 20
    ) sub
  ),
  -- 5. Origem do Lead / Formas de Entrada (Donut + Tabela)
  origens_lead AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        dn.ngo_formaentrada AS name,
        COUNT(*)::int AS qtd,
        COALESCE(SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho'), 0)::numeric AS valor,
        COUNT(*) FILTER (WHERE dn.status_class = 'ganho')::int AS "qtdGanhos",
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND((COUNT(*) FILTER (WHERE dn.status_class = 'ganho')::numeric / COUNT(*)) * 100, 1)
          ELSE 0
        END AS "taxaConversao",
        CASE
          WHEN COUNT(*) FILTER (WHERE dn.status_class = 'ganho') > 0
          THEN ROUND(SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho') / COUNT(*) FILTER (WHERE dn.status_class = 'ganho'), 2)
          ELSE 0
        END AS "ticketMedio",
        CASE
          WHEN (SELECT SUM(ngo_vlrtotalnegociado) FROM dedup_negocios WHERE status_class = 'ganho') > 0
          THEN ROUND((SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho') / (SELECT SUM(ngo_vlrtotalnegociado) FROM dedup_negocios WHERE status_class = 'ganho')) * 100, 1)
          ELSE 0
        END AS percent
      FROM dedup_negocios dn
      GROUP BY dn.ngo_formaentrada
      ORDER BY COALESCE(SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho'), 0) DESC
      LIMIT 10
    ) sub
  ),
  -- 6. Financiamento & Bancos
  financiamento_bancos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.pdo_banco AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrfinanciado), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_financiado FROM total_aprovados) > 0
          THEN ROUND((SUM(p.pdo_vlrfinanciado) / (SELECT faturamento_financiado FROM total_aprovados)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrfinanciado) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM base_pedidos p
      WHERE p.is_aprovado AND p.pdo_vlrfinanciado > 0
      GROUP BY p.pdo_banco
      ORDER BY SUM(p.pdo_vlrfinanciado) DESC
      LIMIT 10
    ) sub
  ),
  -- 7. Tipo de Cliente (PF, PJ, Cooperativa)
  tipos_cliente AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        dn.cli_tipocliente AS name,
        COUNT(*)::int AS qtd,
        COALESCE(SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho'), 0)::numeric AS valor,
        CASE
          WHEN (SELECT SUM(ngo_vlrtotalnegociado) FROM dedup_negocios WHERE status_class = 'ganho') > 0
          THEN ROUND((SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho') / (SELECT SUM(ngo_vlrtotalnegociado) FROM dedup_negocios WHERE status_class = 'ganho')) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(*) FILTER (WHERE dn.status_class = 'ganho') > 0
          THEN ROUND(SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho') / COUNT(*) FILTER (WHERE dn.status_class = 'ganho'), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM dedup_negocios dn
      GROUP BY dn.cli_tipocliente
      ORDER BY COALESCE(SUM(dn.ngo_vlrtotalnegociado) FILTER (WHERE dn.status_class = 'ganho'), 0) DESC
    ) sub
  ),
  -- 8. Motivos de Perda
  motivos_perda AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        dn.ngo_motivoperda AS name,
        dn.mpp_produtoperdamarca AS "concorrenteTop",
        COUNT(*)::int AS qtd,
        COALESCE(SUM(dn.ngo_vlrtotalnegociado), 0)::numeric AS valor,
        CASE
          WHEN (SELECT SUM(ngo_vlrtotalnegociado) FROM dedup_negocios WHERE status_class = 'perdido') > 0
          THEN ROUND((SUM(dn.ngo_vlrtotalnegociado) / (SELECT SUM(ngo_vlrtotalnegociado) FROM dedup_negocios WHERE status_class = 'perdido')) * 100, 1)
          ELSE 0
        END AS percent
      FROM dedup_negocios dn
      WHERE dn.status_class = 'perdido'
      GROUP BY dn.ngo_motivoperda, dn.mpp_produtoperdamarca
      ORDER BY SUM(dn.ngo_vlrtotalnegociado) DESC
      LIMIT 10
    ) sub
  ),
  -- 9. Resumo Anual (Histórico dos últimos 3 anos)
  resumo_anual AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.ano DESC), '[]'::json) AS val
    FROM (
      SELECT
        EXTRACT(YEAR FROM p.pdo_dthpedido)::integer AS ano,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido) FILTER (WHERE LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%'), 0)::numeric AS faturamento,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) FILTER (WHERE LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%') > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) FILTER (WHERE LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%') / COUNT(DISTINCT p.pdo_codigointerno) FILTER (WHERE LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%'), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM mirror.crm_pedidos p
      WHERE p.pdo_dthpedido IS NOT NULL
        AND EXTRACT(YEAR FROM p.pdo_dthpedido) >= EXTRACT(YEAR FROM CURRENT_DATE) - 3
      GROUP BY EXTRACT(YEAR FROM p.pdo_dthpedido)
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'rankingVendedores', (SELECT val FROM ranking_vendedores),
    'rankingProdutos', (SELECT val FROM ranking_produtos),
    'rankingCidades', (SELECT val FROM ranking_cidades),
    'origensLead', (SELECT val FROM origens_lead),
    'financiamentoBancos', (SELECT val FROM financiamento_bancos),
    'tiposCliente', (SELECT val FROM tipos_cliente),
    'motivosPerda', (SELECT val FROM motivos_perda),
    'resumoAnual', (SELECT val FROM resumo_anual)
  ) INTO result;

  RETURN result;
END;
$$;

NOTIFY pgrst, 'reload schema';
