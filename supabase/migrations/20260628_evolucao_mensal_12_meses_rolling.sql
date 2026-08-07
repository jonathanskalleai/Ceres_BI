-- =====================================================================
-- 20260628 — Evolucao mensal = ultimos 12 meses rolling (server-side)
-- =====================================================================
-- PROBLEMA: os graficos de evolucao mensal mostravam so 1 mes porque a serie
-- era agregada DENTRO do filtro [p_from, p_to], que nasce no mes atual.
--
-- DECISAO (usuario + @architect): evolucao = ultimos 12 meses rolling ate hoje,
-- calculado server-side nas RPCs, INDEPENDENTE do [p_from, p_to] dos KPIs.
--
-- ABORDAGEM (sem mudar assinatura — CREATE OR REPLACE in-place):
--   - Cada RPC ganha uma janela propria de 12 meses:
--       v_evo_from := (date_trunc('month', CURRENT_DATE) - interval '11 months')::date
--       v_evo_to   := CURRENT_DATE
--   - Um CTE de evolucao SEPARADO (sufixo _evo) replica TODOS os predicados
--     NAO-data existentes (funil, cidade, vendedor, tipo_acao) com a janela de
--     12 meses. So o array de evolucao passa a ler desse CTE.
--   - O base/deduped/filtered ligado a [p_from, p_to] que alimenta KPIs e demais
--     graficos fica INTOCADO (a janela NAO vaza pros KPIs).
--
-- Definicoes baseadas no corpo VIVO do banco (pg_get_functiondef), NAO nos .sql
-- de migrations anteriores (que divergem do banco vivo).
--
-- Rollback conhecido por funcao: pedidos=20260627, negocios_bi/servicos=20260626,
-- acoes/evolucao_mensal=20260623, negocios_crm=20260625_rpc_negocios_crm.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) rpc_pedidos_bi — evolucaoMensal por ngo_datafechamento (12m rolling)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_pedidos_bi(p_from date, p_to date, p_cidade text DEFAULT NULL::text, p_vendedor text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  result json;
  v_evo_from date := (date_trunc('month', CURRENT_DATE) - interval '11 months')::date;
  v_evo_to   date := CURRENT_DATE;
BEGIN
  WITH negocios_dedup AS (
    -- 1 linha por negocio (padrao DISTINCT ON da rpc_negocios_bi). Criterio de
    -- ordenacao proprio: a versao ganha mais recente por ngo_datafechamento vence
    -- (ngo_dataatualizacao e ctid como desempates estaveis).
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_datafechamento
    FROM mirror.crm_negocios n
    ORDER BY n.ngo_numero,
             n.ngo_datafechamento DESC NULLS LAST,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.ctid
  ),
  base AS (
    SELECT
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_vlrfinanciado,
      p.pdo_vlrrecursoproprio,
      n.ngo_datafechamento,
      p.pdo_vendedor,
      p.pdo_cidadeufentrega,
      p.pdo_codigointerno,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%cancel%' AS is_cancelado
    FROM mirror.crm_pedidos p
    INNER JOIN negocios_dedup n ON n.ngo_numero = p.ngo_numero
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%'
      AND (p_cidade IS NULL OR p.emp_cidade = p_cidade)
      AND (p_vendedor IS NULL OR p.pdo_vendedor = p_vendedor)
  ),
  -- Janela de evolucao: 12 meses rolling, mesmos predicados NAO-data do base
  base_evo AS (
    SELECT
      p.pdo_vlrpedido,
      n.ngo_datafechamento,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado
    FROM mirror.crm_pedidos p
    INNER JOIN negocios_dedup n ON n.ngo_numero = p.ngo_numero
    WHERE n.ngo_datafechamento::date BETWEEN v_evo_from AND v_evo_to
      AND LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%'
      AND (p_cidade IS NULL OR p.emp_cidade = p_cidade)
      AND (p_vendedor IS NULL OR p.pdo_vendedor = p_vendedor)
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
  -- Evolucao mensal (aprovados only) — por data de ganho, 12 meses rolling
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datafechamento::date, 'YYYY-MM') AS name,
        COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS faturamento,
        COUNT(*) AS qtd
      FROM base_evo
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
  -- Por grupo de produto (top 10) — itens de pedidos VENDIDOS (negocio ganho na
  -- janela + aprovado). Fonte: mirror.crm_pedidos_item; vinculo via pdo_codigointerno.
  -- valor = SUM(qtde * vlr unitario) (nao ha total pre-calculado na tabela de itens).
  grupo_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        i.pdo_itemgrupo AS name,
        COALESCE(SUM(COALESCE(i.pdo_itemqtde, 0) * COALESCE(i.pdo_itemvlrunitario, 0)), 0)::numeric AS valor,
        COALESCE(SUM(i.pdo_itemqtde), 0)::numeric AS qtd
      FROM mirror.crm_pedidos_item i
      INNER JOIN base b ON b.pdo_codigointerno = i.pdo_codigointerno
      WHERE b.is_aprovado AND i.pdo_itemgrupo IS NOT NULL
      GROUP BY i.pdo_itemgrupo
      ORDER BY valor DESC
      LIMIT 10
    ) sub
  ),
  -- Por marca (top 10) — mesma fonte/escopo, agrupado por marca do item.
  marca_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        i.pdo_itemmarca AS name,
        COALESCE(SUM(COALESCE(i.pdo_itemqtde, 0) * COALESCE(i.pdo_itemvlrunitario, 0)), 0)::numeric AS valor,
        COALESCE(SUM(i.pdo_itemqtde), 0)::numeric AS qtd
      FROM mirror.crm_pedidos_item i
      INNER JOIN base b ON b.pdo_codigointerno = i.pdo_codigointerno
      WHERE b.is_aprovado AND i.pdo_itemmarca IS NOT NULL
      GROUP BY i.pdo_itemmarca
      ORDER BY valor DESC
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
$function$;

-- ---------------------------------------------------------------------
-- 2) rpc_negocios_bi — evolucaoMensal por ngo_datacadastro (12m rolling)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_negocios_bi(p_from date, p_to date, p_funis text[] DEFAULT NULL::text[], p_cidade text DEFAULT NULL::text, p_vendedor text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  result json;
  v_to date := LEAST(p_to, CURRENT_DATE);
  v_evo_from date := (date_trunc('month', CURRENT_DATE) - interval '11 months')::date;
  v_evo_to   date := CURRENT_DATE;
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
      AND (p_cidade IS NULL OR n.emp_cidade = p_cidade)
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST, n.ngo_vlrtotalnegociado DESC NULLS LAST, n.ctid
  ),
  -- Janela de evolucao: 12 meses rolling, mesmos predicados NAO-data do deduped
  deduped_evo AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_datacadastro,
      n.ngo_vlrtotalnegociado
    FROM mirror.crm_negocios n
    WHERE n.ngo_datacadastro::date BETWEEN v_evo_from AND v_evo_to
      AND (p_funis IS NULL OR n.ngo_funil = ANY(p_funis))
      AND (p_cidade IS NULL OR n.emp_cidade = p_cidade)
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
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
  -- Evolucao mensal — 12 meses rolling
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datacadastro::date, 'YYYY-MM') AS name,
        COUNT(*) AS novos,
        COALESCE(SUM(ngo_vlrtotalnegociado), 0)::numeric AS "valorCriado"
      FROM deduped_evo
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
  -- Velocidade do funil (tempo medio por etapa, ganhos)
  velocidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.ordem), '[]'::json) AS val
    FROM (
      SELECT
        ngo_etapa AS name,
        ROUND(AVG(ngo_ciclovendas)::numeric, 1) AS dias,
        COUNT(*) AS qtd,
        ROW_NUMBER() OVER (ORDER BY AVG(ngo_ciclovendas) NULLS LAST) AS ordem
      FROM deduped
      WHERE status_class = 'ganho' AND ngo_ciclovendas > 0 AND ngo_etapa IS NOT NULL
      GROUP BY ngo_etapa
    ) sub
  ),
  -- Duracao total (distribuicao de ciclo de vendas dos ganhos)
  duracao_total AS (
    SELECT json_build_array(
      json_build_object('name', '0-7 dias', 'value', COUNT(*) FILTER (WHERE ngo_ciclovendas BETWEEN 0 AND 7)),
      json_build_object('name', '8-15 dias', 'value', COUNT(*) FILTER (WHERE ngo_ciclovendas BETWEEN 8 AND 15)),
      json_build_object('name', '16-30 dias', 'value', COUNT(*) FILTER (WHERE ngo_ciclovendas BETWEEN 16 AND 30)),
      json_build_object('name', '31-60 dias', 'value', COUNT(*) FILTER (WHERE ngo_ciclovendas BETWEEN 31 AND 60)),
      json_build_object('name', '61-90 dias', 'value', COUNT(*) FILTER (WHERE ngo_ciclovendas BETWEEN 61 AND 90)),
      json_build_object('name', '90+ dias', 'value', COUNT(*) FILTER (WHERE ngo_ciclovendas > 90))
    ) AS val
    FROM deduped
    WHERE status_class = 'ganho' AND ngo_ciclovendas > 0
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'funilPorEtapa', (SELECT val FROM funil),
    'porOrigem', (SELECT val FROM origens),
    'motivosPerda', (SELECT val FROM motivos),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'rankingConsultor', (SELECT val FROM ranking),
    'velocidadeFunil', (SELECT val FROM velocidade),
    'duracaoTotal', (SELECT val FROM duracao_total)
  ) INTO result;

  RETURN result;
END;
$function$;

-- ---------------------------------------------------------------------
-- 3) rpc_acoes_bi — porMes por aco_dthconclusao (12m rolling)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_acoes_bi(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_vendedor text DEFAULT NULL::text, p_tipo_acao text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  result json;
  v_evo_from date := (date_trunc('month', CURRENT_DATE) - interval '11 months')::date;
  v_evo_to   date := CURRENT_DATE;
BEGIN
  WITH filtered AS (
    SELECT
      a.aco_vendedor,
      a.emp_cidade,
      a.aco_tipocontato,
      a.aco_tipoacao,
      a.cli_nome,
      a.aco_dthconclusao
    FROM mirror.crm_acoes a
    WHERE (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR a.emp_cidade = p_cidade)
  ),
  -- Janela de evolucao: 12 meses rolling, mesmos predicados NAO-data do filtered
  filtered_evo AS (
    SELECT
      a.aco_dthconclusao
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date BETWEEN v_evo_from AND v_evo_to
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR a.emp_cidade = p_cidade)
  ),
  -- KPIs
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_acoes,
      COUNT(DISTINCT emp_cidade) FILTER (WHERE emp_cidade IS NOT NULL) AS cidades,
      COUNT(DISTINCT aco_vendedor) FILTER (WHERE aco_vendedor IS NOT NULL) AS consultores,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(aco_tipocontato, '')) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT cli_nome) FILTER (WHERE cli_nome IS NOT NULL) AS clientes,
      COUNT(DISTINCT aco_tipoacao) FILTER (WHERE aco_tipoacao IS NOT NULL) AS tipos_acao_distintos
    FROM filtered
  ),
  kpis AS (
    SELECT json_build_object(
      'totalAcoes', total_acoes,
      'cidades', cidades,
      'consultores', consultores,
      'visitas', visitas,
      'clientes', clientes,
      'tiposAcaoDistintos', tipos_acao_distintos
    ) AS val FROM kpi_agg
  ),
  -- Por vendedor (top 15)
  por_vendedor AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT aco_vendedor AS name, COUNT(*) AS acoes
      FROM filtered
      WHERE aco_vendedor IS NOT NULL
      GROUP BY aco_vendedor
      ORDER BY COUNT(*) DESC
      LIMIT 15
    ) sub
  ),
  -- Por cidade (top 15)
  por_cidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT emp_cidade AS name, COUNT(*) AS acoes
      FROM filtered
      WHERE emp_cidade IS NOT NULL
      GROUP BY emp_cidade
      ORDER BY COUNT(*) DESC
      LIMIT 15
    ) sub
  ),
  -- Por mes — 12 meses rolling
  por_mes AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT TO_CHAR(aco_dthconclusao::date, 'YYYY-MM') AS name, COUNT(*) AS acoes
      FROM filtered_evo
      GROUP BY TO_CHAR(aco_dthconclusao::date, 'YYYY-MM')
    ) sub
  ),
  -- Por dia da semana (0=Dom, 1=Seg, ..., 6=Sab)
  por_dia AS (
    SELECT json_build_array(
      json_build_object('name', 'Seg', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 1)),
      json_build_object('name', 'Ter', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 2)),
      json_build_object('name', 'Qua', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 3)),
      json_build_object('name', 'Qui', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 4)),
      json_build_object('name', 'Sex', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 5)),
      json_build_object('name', 'Sab', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 6)),
      json_build_object('name', 'Dom', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 0))
    ) AS val
    FROM filtered
  ),
  -- Por tipo acao
  por_tipo_acao AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT aco_tipoacao AS id, aco_tipoacao AS name, COUNT(*) AS value
      FROM filtered
      WHERE aco_tipoacao IS NOT NULL
      GROUP BY aco_tipoacao
      ORDER BY COUNT(*) DESC
    ) sub
  ),
  -- Por tipo contato
  por_tipo_contato AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT aco_tipocontato AS id, aco_tipocontato AS name, COUNT(*) AS value
      FROM filtered
      WHERE aco_tipocontato IS NOT NULL
      GROUP BY aco_tipocontato
      ORDER BY COUNT(*) DESC
    ) sub
  ),
  -- Lista de anos disponveis
  lista_anos AS (
    SELECT COALESCE(json_agg(sub.ano ORDER BY sub.ano DESC), '[]'::json) AS val
    FROM (
      SELECT DISTINCT TO_CHAR(aco_dthconclusao::date, 'YYYY') AS ano
      FROM filtered
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'porVendedor', (SELECT val FROM por_vendedor),
    'porCidade', (SELECT val FROM por_cidade),
    'porMes', (SELECT val FROM por_mes),
    'porDiaSemana', (SELECT val FROM por_dia),
    'porTipoAcao', (SELECT val FROM por_tipo_acao),
    'porTipoContato', (SELECT val FROM por_tipo_contato),
    'listaAnos', (SELECT val FROM lista_anos)
  ) INTO result;

  RETURN result;
END;
$function$;

-- ---------------------------------------------------------------------
-- 4) rpc_servicos_bi — evolucaoAberturas por os_dthabertura (12m rolling)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_servicos_bi(p_from date, p_to date, p_cidade text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  result json;
  v_evo_from date := (date_trunc('month', CURRENT_DATE) - interval '11 months')::date;
  v_evo_to   date := CURRENT_DATE;
BEGIN
  WITH base AS (
    SELECT
      os.os_nros,
      os.os_fstatus,
      os.os_dthabertura,
      os.os_dthencerramento,
      CASE
        WHEN LOWER(COALESCE(os.os_fstatus, '')) LIKE '%fechad%' THEN 'fechada'
        WHEN LOWER(COALESCE(os.os_fstatus, '')) LIKE '%abert%' THEN 'aberta'
        ELSE COALESCE(NULLIF(TRIM(os.os_fstatus), ''), 'Outro')
      END AS status_class,
      CASE
        WHEN os.os_dthabertura IS NOT NULL AND os.os_dthencerramento IS NOT NULL
        THEN EXTRACT(DAY FROM (os.os_dthencerramento - os.os_dthabertura))::numeric
        ELSE NULL
      END AS dias_resolucao
    FROM mirror.ordens_servico os
    WHERE os.os_dthabertura::date BETWEEN p_from AND p_to
      AND (p_cidade IS NULL OR os.emp_cidade = p_cidade)
  ),
  -- Janela de evolucao: 12 meses rolling, mesmos predicados NAO-data do base
  base_evo AS (
    SELECT
      os.os_dthabertura
    FROM mirror.ordens_servico os
    WHERE os.os_dthabertura::date BETWEEN v_evo_from AND v_evo_to
      AND (p_cidade IS NULL OR os.emp_cidade = p_cidade)
  ),
  -- KPIs
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_os,
      COUNT(*) FILTER (WHERE status_class = 'aberta') AS abertas,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE status_class = 'fechada')::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END AS taxa_fechamento,
      COALESCE(ROUND((AVG(dias_resolucao) FILTER (WHERE dias_resolucao IS NOT NULL))::numeric, 1), 0) AS tempo_medio_resolucao,
      COALESCE(ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY dias_resolucao) FILTER (WHERE dias_resolucao IS NOT NULL))::numeric, 1), 0) AS tempo_mediano_resolucao
    FROM base
  ),
  kpis AS (
    SELECT json_build_object(
      'totalOS', total_os,
      'abertas', abertas,
      'taxaFechamento', taxa_fechamento,
      'tempoMedioResolucao', tempo_medio_resolucao,
      'tempoMedianoResolucao', tempo_mediano_resolucao,
      'totalOcorrencias', 0
    ) AS val FROM kpi_agg
  ),
  -- Por status
  por_status AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.value DESC), '[]'::json) AS val
    FROM (
      SELECT status_class AS name, COUNT(*) AS value
      FROM base
      GROUP BY status_class
    ) sub
  ),
  -- Faixas de resolucao
  faixas AS (
    SELECT json_build_array(
      json_build_object('name', '0-3 dias', 'value', COUNT(*) FILTER (WHERE dias_resolucao BETWEEN 0 AND 3)),
      json_build_object('name', '4-7 dias', 'value', COUNT(*) FILTER (WHERE dias_resolucao BETWEEN 4 AND 7)),
      json_build_object('name', '8-15 dias', 'value', COUNT(*) FILTER (WHERE dias_resolucao BETWEEN 8 AND 15)),
      json_build_object('name', '16-30 dias', 'value', COUNT(*) FILTER (WHERE dias_resolucao BETWEEN 16 AND 30)),
      json_build_object('name', '30+ dias', 'value', COUNT(*) FILTER (WHERE dias_resolucao > 30))
    ) AS val
    FROM base
    WHERE dias_resolucao IS NOT NULL
  ),
  -- Evolucao aberturas — 12 meses rolling
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(os_dthabertura::date, 'YYYY-MM') AS name,
        COUNT(*) AS value
      FROM base_evo
      GROUP BY TO_CHAR(os_dthabertura::date, 'YYYY-MM')
      ORDER BY TO_CHAR(os_dthabertura::date, 'YYYY-MM')
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'porStatus', (SELECT val FROM por_status),
    'faixasResolucao', (SELECT val FROM faixas),
    'evolucaoAberturas', (SELECT val FROM evolucao),
    'situacaoOcorrencias', '[]'::json,
    'motivosPausa', '[]'::json,
    'causasAtendimento', '[]'::json
  ) INTO result;

  RETURN result;
END;
$function$;

-- ---------------------------------------------------------------------
-- 5) rpc_evolucao_mensal — serie inteira = 12 meses rolling
--    p_from/p_to ficam na assinatura por compat mas sao IGNORADOS.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_evolucao_mensal(p_from date, p_to date, p_vendedor text DEFAULT NULL::text)
 RETURNS TABLE(mes text, acoes bigint, visitas bigint, valor numeric, clientes bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  WITH acoes_filtradas AS (
    SELECT
      TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM') AS ym,
      a.cli_nome,
      a.aco_tipocontato,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    -- 12 meses rolling ate hoje (p_from/p_to ignorados de proposito)
    WHERE a.aco_dthconclusao::date BETWEEN (date_trunc('month', CURRENT_DATE) - interval '11 months')::date AND CURRENT_DATE
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  ),
  mensal AS (
    SELECT
      af.ym,
      COUNT(*) AS acoes,
      COUNT(*) FILTER (WHERE LOWER(af.aco_tipocontato) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT af.cli_nome) FILTER (WHERE af.cli_nome IS NOT NULL) AS clientes
    FROM acoes_filtradas af
    GROUP BY af.ym
  ),
  valor_mensal AS (
    SELECT
      af.ym,
      COALESCE(SUM(n.ngo_vlrtotalnegociado::numeric), 0) AS valor
    FROM (
      SELECT DISTINCT ym, ngo_nronegocio
      FROM acoes_filtradas
      WHERE ngo_nronegocio IS NOT NULL
    ) af
    JOIN mirror.crm_negocios n ON n.ngo_numero = af.ngo_nronegocio
    WHERE n.ngo_conclusao IS NULL OR LOWER(n.ngo_conclusao) NOT LIKE '%perd%'
    GROUP BY af.ym
  )
  SELECT
    m.ym AS mes,
    m.acoes,
    m.visitas,
    COALESCE(vm.valor, 0) AS valor,
    m.clientes
  FROM mensal m
  LEFT JOIN valor_mensal vm ON vm.ym = m.ym
  ORDER BY m.ym;
$function$;

-- ---------------------------------------------------------------------
-- 6) rpc_negocios_crm — evolucaoMensal por ngo_datacadastro (12m rolling)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_negocios_crm(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_cidade text DEFAULT NULL::text, p_vendedor text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  result json;
  v_to date := LEAST(p_to, CURRENT_DATE);  -- Fix #1: clamp future dates
  v_evo_from date := (date_trunc('month', CURRENT_DATE) - interval '11 months')::date;
  v_evo_to   date := CURRENT_DATE;
BEGIN
  WITH deduped AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores,
      n.ngo_datacadastro,
      n.emp_cidade,
      n.emp_uf,
      n.cli_nome,
      n.prd_condicaoproduto,
      n.usa_valor,
      -- Join pedido inline for recebido/valor_pedido
      p.pdo_vlrpedido,
      p.pdo_vlrrecursoproprio,
      p.pdo_cidadeufentrega,
      p.pdo_vendedor,
      -- Resolve vendedor name
      COALESCE(u.usr_nomeusuario, n.ngo_vendedores) AS consultor_nome,
      -- Status classification
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) = 'ganho' THEN 'ganho'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) = 'perdido' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        ELSE 'andamento'
      END AS status_class,
      -- Computed valor (pedido takes priority)
      COALESCE(p.pdo_vlrpedido, n.ngo_vlrtotalnegociado, 0)::numeric AS valor_efetivo,
      COALESCE(p.pdo_vlrrecursoproprio, 0)::numeric AS recebido
    FROM mirror.crm_negocios n
    LEFT JOIN LATERAL (
      SELECT p2.pdo_vlrpedido, p2.pdo_vlrrecursoproprio, p2.pdo_cidadeufentrega, p2.pdo_vendedor
      FROM mirror.crm_pedidos p2
      WHERE p2.ngo_numero = n.ngo_numero
      LIMIT 1
    ) p ON true
    LEFT JOIN mirror.usuarios u ON TRIM(u.usr_codusuario) = TRIM(n.ngo_vendedores)
    WHERE (p_from IS NULL OR n.ngo_datacadastro::date >= p_from)
      AND (v_to IS NULL OR n.ngo_datacadastro::date <= v_to)  -- Fix #1: v_to
      AND (p_cidade IS NULL OR n.emp_cidade ILIKE '%' || p_cidade || '%'
           OR p.pdo_cidadeufentrega ILIKE '%' || p_cidade || '%')
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST, n.ngo_vlrtotalnegociado DESC NULLS LAST, n.ctid  -- Fix #2: stable tiebreaker
  ),
  -- Janela de evolucao: 12 meses rolling, mesmos predicados NAO-data do deduped
  -- (DISTINCT ON + LATERAL pedido para valor_efetivo/cidade pedido; usuarios join
  --  e demais colunas omitidos por nao serem usados na serie de evolucao).
  deduped_evo AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_datacadastro,
      COALESCE(p.pdo_vlrpedido, n.ngo_vlrtotalnegociado, 0)::numeric AS valor_efetivo,
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) = 'ganho' THEN 'ganho'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) = 'perdido' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        ELSE 'andamento'
      END AS status_class
    FROM mirror.crm_negocios n
    LEFT JOIN LATERAL (
      SELECT p2.pdo_vlrpedido, p2.pdo_cidadeufentrega
      FROM mirror.crm_pedidos p2
      WHERE p2.ngo_numero = n.ngo_numero
      LIMIT 1
    ) p ON true
    WHERE n.ngo_datacadastro::date BETWEEN v_evo_from AND v_evo_to
      AND (p_cidade IS NULL OR n.emp_cidade ILIKE '%' || p_cidade || '%'
           OR p.pdo_cidadeufentrega ILIKE '%' || p_cidade || '%')
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST, n.ngo_vlrtotalnegociado DESC NULLS LAST, n.ctid
  ),
  -- -----------------------------------------------------------------------
  -- clientes atendidos no período (de crm_acoes, para taxaConversao)
  -- -----------------------------------------------------------------------
  clientes_atendidos AS (
    SELECT COUNT(DISTINCT a.cli_nome) AS total
    FROM mirror.crm_acoes a
    WHERE a.cli_nome IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (v_to IS NULL OR a.aco_dthconclusao::date <= v_to)  -- Fix #1: v_to
      AND (p_cidade IS NULL OR a.emp_cidade ILIKE '%' || p_cidade || '%')
      AND (p_vendedor IS NULL OR UPPER(TRIM(a.aco_vendedor)) = (
        SELECT UPPER(TRIM(u2.usr_nomeusuario))
        FROM mirror.usuarios u2
        WHERE TRIM(u2.usr_codusuario) = TRIM(p_vendedor)
        LIMIT 1
      ))
  ),
  -- -----------------------------------------------------------------------
  -- Summary KPIs
  -- -----------------------------------------------------------------------
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_negocios,
      COALESCE(SUM(valor_efetivo), 0)::numeric AS total_valor,
      COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos,
      COUNT(*) FILTER (WHERE status_class = 'andamento') AS em_andamento,
      COUNT(*) FILTER (WHERE status_class = 'perdido') AS perdidos,
      COALESCE(SUM(recebido), 0)::numeric AS total_recebido,
      COALESCE(SUM(GREATEST(valor_efetivo - recebido, 0)), 0)::numeric AS total_usado
    FROM deduped
  ),
  -- -----------------------------------------------------------------------
  -- Evolucao mensal: { mes, total, valor, ganhos } — 12 meses rolling
  -- -----------------------------------------------------------------------
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.mes), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datacadastro::date, 'YYYY-MM') AS mes,
        COUNT(*) AS total,
        COALESCE(SUM(valor_efetivo), 0)::numeric AS valor,
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos
      FROM deduped_evo
      WHERE ngo_datacadastro IS NOT NULL
      GROUP BY TO_CHAR(ngo_datacadastro::date, 'YYYY-MM')
      ORDER BY mes
    ) sub
  ),
  -- -----------------------------------------------------------------------
  -- Por consultor com lista de clientes
  -- Fix #3: clientes_por_vendedor now resolves aco_vendedor (name) to
  --         usr_codusuario via LEFT JOIN mirror.usuarios, groups by code,
  --         and joins on cod_vendedor instead of fragile name comparison.
  -- -----------------------------------------------------------------------
  clientes_por_vendedor AS (
    SELECT
      COALESCE(TRIM(u3.usr_codusuario), UPPER(TRIM(a.aco_vendedor))) AS cod_vendedor,
      COUNT(DISTINCT a.cli_nome) AS clientes_count
    FROM mirror.crm_acoes a
    LEFT JOIN mirror.usuarios u3 ON UPPER(TRIM(u3.usr_nomeusuario)) = UPPER(TRIM(a.aco_vendedor))
    WHERE a.cli_nome IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (v_to IS NULL OR a.aco_dthconclusao::date <= v_to)  -- Fix #1: v_to
      AND (p_cidade IS NULL OR a.emp_cidade ILIKE '%' || p_cidade || '%')
    GROUP BY COALESCE(TRIM(u3.usr_codusuario), UPPER(TRIM(a.aco_vendedor)))
  ),
  por_consultor_base AS (
    SELECT
      COALESCE(NULLIF(TRIM(d.consultor_nome), ''), 'Sem consultor') AS nome,
      d.ngo_vendedores AS cod_vendedor,
      COUNT(*) AS total,
      COALESCE(SUM(d.valor_efetivo), 0)::numeric AS valor,
      COUNT(*) FILTER (WHERE d.status_class = 'ganho') AS ganhos,
      COALESCE(SUM(d.recebido), 0)::numeric AS total_recebido,
      COALESCE(SUM(GREATEST(d.valor_efetivo - d.recebido, 0)), 0)::numeric AS total_usado,
      -- clientes json array
      COALESCE(json_agg(
        json_build_object(
          'cliente', COALESCE(NULLIF(TRIM(d.cli_nome), ''), 'Sem cliente'),
          'valorTotal', ROUND(d.valor_efetivo, 2),
          'recebido', ROUND(d.recebido, 2),
          'valorUsado', ROUND(GREATEST(d.valor_efetivo - d.recebido, 0), 2)
        ) ORDER BY d.valor_efetivo DESC
      ), '[]'::json) AS clientes_raw
    FROM deduped d
    WHERE d.consultor_nome IS NOT NULL
    GROUP BY d.consultor_nome, d.ngo_vendedores
  ),
  por_consultor AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        pcb.nome,
        pcb.total,
        pcb.valor,
        pcb.ganhos,
        pcb.total_recebido AS recebido,
        pcb.total_usado AS usado,
        CASE WHEN pcb.valor > 0 THEN ROUND((pcb.total_usado / pcb.valor) * 100, 1) ELSE 0 END AS "percentUsado",
        CASE WHEN pcb.total > 0 THEN ROUND(pcb.valor / pcb.total, 2) ELSE 0 END AS "ticketMedio",
        COALESCE(cpv.clientes_count, 0)::int AS "clientesAtendidos",
        CASE WHEN COALESCE(cpv.clientes_count, 0) > 0
          THEN ROUND((pcb.total::numeric / cpv.clientes_count) * 100)
          ELSE 0
        END AS conversao,
        pcb.clientes_raw AS clientes
      FROM por_consultor_base pcb
      LEFT JOIN clientes_por_vendedor cpv ON cpv.cod_vendedor = TRIM(pcb.cod_vendedor)  -- Fix #3: join by code
    ) sub
  ),
  -- -----------------------------------------------------------------------
  -- Por regiao: { regiao, total, valor, ganhos }
  -- -----------------------------------------------------------------------
  por_regiao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(
          NULLIF(TRIM(pdo_cidadeufentrega), ''),
          NULLIF(TRIM(emp_cidade || CASE WHEN emp_uf IS NOT NULL THEN '/' || emp_uf ELSE '' END), '/'),
          'Sem região'
        ) AS regiao,
        COUNT(*) AS total,
        COALESCE(SUM(valor_efetivo), 0)::numeric AS valor,
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos
      FROM deduped
      GROUP BY
        COALESCE(
          NULLIF(TRIM(pdo_cidadeufentrega), ''),
          NULLIF(TRIM(emp_cidade || CASE WHEN emp_uf IS NOT NULL THEN '/' || emp_uf ELSE '' END), '/'),
          'Sem região'
        )
      ORDER BY valor DESC
      LIMIT 30
    ) sub
  ),
  -- -----------------------------------------------------------------------
  -- Por tipo: { tipo, total, valor }
  -- -----------------------------------------------------------------------
  por_tipo AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(prd_condicaoproduto), ''), 'Sem tipo') AS tipo,
        COUNT(*) AS total,
        COALESCE(SUM(valor_efetivo), 0)::numeric AS valor
      FROM deduped
      GROUP BY COALESCE(NULLIF(TRIM(prd_condicaoproduto), ''), 'Sem tipo')
      ORDER BY valor DESC
      LIMIT 20
    ) sub
  )
  -- -----------------------------------------------------------------------
  -- Final assembly
  -- -----------------------------------------------------------------------
  SELECT json_build_object(
    'totalNegocios',    k.total_negocios,
    'totalValor',       k.total_valor,
    'ticketMedio',      CASE WHEN k.total_negocios > 0 THEN ROUND(k.total_valor / k.total_negocios, 2) ELSE 0 END,
    'ganhos',           k.ganhos,
    'emAndamento',      k.em_andamento,
    'perdidos',         k.perdidos,
    'taxaConversao',    CASE
                          WHEN (SELECT total FROM clientes_atendidos) > 0
                          THEN ROUND((k.total_negocios::numeric / (SELECT total FROM clientes_atendidos)) * 100)
                          ELSE 0
                        END,
    'clientesAtendidos',(SELECT total FROM clientes_atendidos),
    'totalRecebido',    k.total_recebido,
    'totalUsado',       k.total_usado,
    'percentUsado',     CASE WHEN k.total_valor > 0 THEN ROUND((k.total_usado / k.total_valor) * 100, 1) ELSE 0 END,
    'evolucaoMensal',   (SELECT val FROM evolucao),
    'porConsultor',     (SELECT val FROM por_consultor),
    'porRegiao',        (SELECT val FROM por_regiao),
    'porTipo',          (SELECT val FROM por_tipo),
    'registros',        '[]'::json
  ) INTO result
  FROM kpi_agg k;

  RETURN result;
END;
$function$;

-- Recarregar o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
