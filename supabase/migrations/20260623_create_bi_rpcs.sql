-- Migration: RPCs para BI de Negocios e Pedidos (server-side aggregation)
-- Autor: @dev (Dex)
-- Data: 2026-06-23
-- Dependencia: 20260608_rebuild_all_mirrors.sql (tables mirror.crm_negocios, mirror.crm_pedidos, mirror.usuarios)

-------------------------------------------------------------------------------
-- INDICES (IF NOT EXISTS — idempotent)
-------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_crm_negocios_datafechamento_conclusao
  ON mirror.crm_negocios (ngo_datafechamento, ngo_conclusao);

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_dthpedido_situacao
  ON mirror.crm_pedidos (pdo_dthpedido, pdo_situacaopedido);

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_vendedor_dthpedido
  ON mirror.crm_pedidos (pdo_vendedor, pdo_dthpedido);

-------------------------------------------------------------------------------
-- RPC 1: rpc_negocios_bi
-- Retorna JSON com KPIs, funil, origens, motivos de perda, evolucao e ranking
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
      n.ngo_ciclovendas,
      n.ngo_qtdacoes,
      n.ngo_funil,
      n.ngo_vendedores,
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        ELSE 'andamento'
      END AS status_class
    FROM mirror.crm_negocios n
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (p_funis IS NULL OR n.ngo_funil = ANY(p_funis))
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
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
  -- Evolucao mensal (last 12)
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datafechamento::date, 'YYYY-MM') AS name,
        COUNT(*) AS novos,
        COALESCE(SUM(ngo_vlrtotalnegociado), 0)::numeric AS "valorCriado"
      FROM deduped
      GROUP BY TO_CHAR(ngo_datafechamento::date, 'YYYY-MM')
      ORDER BY TO_CHAR(ngo_datafechamento::date, 'YYYY-MM')
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
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'funilPorEtapa', (SELECT val FROM funil),
    'porOrigem', (SELECT val FROM origens),
    'motivosPerda', (SELECT val FROM motivos),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'rankingConsultor', (SELECT val FROM ranking)
  ) INTO result;

  RETURN result;
END;
$$;


-------------------------------------------------------------------------------
-- RPC 2: rpc_pedidos_bi
-- Retorna JSON com KPIs, evolucao, situacao, mix pagamento, por vendedor/cidade
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
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%cancel%' AS is_cancelado
    FROM mirror.crm_pedidos p
    WHERE p.pdo_dthpedido::date BETWEEN p_from AND p_to
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
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'porSituacao', (SELECT val FROM situacao),
    'mixPagamento', (SELECT val FROM mix),
    'porVendedor', (SELECT val FROM vendedores),
    'porCidade', (SELECT val FROM cidades)
  ) INTO result;

  RETURN result;
END;
$$;

-------------------------------------------------------------------------------
-- RPC 3: rpc_servicos_bi
-- Retorna JSON com KPIs de OS, status, faixas de resolucao, evolucao mensal
-- Nota: atendimentos e ocorrencias sao de tabelas legadas (SQL Server)
--       e NAO estao no mirror. Este RPC cobre apenas mirror.ordens_servico.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_servicos_bi(
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
      COALESCE(ROUND(AVG(dias_resolucao) FILTER (WHERE dias_resolucao IS NOT NULL), 1), 0) AS tempo_medio_resolucao,
      COALESCE(ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias_resolucao) FILTER (WHERE dias_resolucao IS NOT NULL), 1), 0) AS tempo_mediano_resolucao
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
  -- Evolucao aberturas (last 12 meses)
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(os_dthabertura::date, 'YYYY-MM') AS name,
        COUNT(*) AS value
      FROM base
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
$$;


-------------------------------------------------------------------------------
-- RPC 4: rpc_admin_bi
-- Retorna JSON com KPIs de carteira, prospect vs ativo, tipo, UF, consultor
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_admin_bi()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH deduped AS (
    SELECT DISTINCT ON (c.cli_idcliente)
      c.cli_idcliente,
      c.cli_tipocliente,
      c.cli_prospect,
      c.cli_uf,
      c.cli_cidade,
      c.usr_nomeusuario
    FROM mirror.crm_carteira_clientes c
    WHERE c.cli_idcliente IS NOT NULL
    ORDER BY c.cli_idcliente
  ),
  -- KPIs
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_clientes,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(cli_prospect, '')) ~ '^(sim|s|prospect|true|1)$') AS prospects,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(cli_prospect, '')) !~ '^(sim|s|prospect|true|1)$') AS ativos,
      COUNT(DISTINCT cli_uf) FILTER (WHERE cli_uf IS NOT NULL) AS ufs_cobertas,
      COUNT(DISTINCT usr_nomeusuario) FILTER (WHERE usr_nomeusuario IS NOT NULL) AS consultores_carteira
    FROM deduped
  ),
  kpis AS (
    SELECT json_build_object(
      'totalClientes', total_clientes,
      'prospects', prospects,
      'ativos', ativos,
      'ufsCobertas', ufs_cobertas,
      'consultoresCarteira', consultores_carteira,
      'empresas', 0
    ) AS val FROM kpi_agg
  ),
  -- Prospect vs Ativo
  prospect_vs_ativo AS (
    SELECT json_build_array(
      json_build_object('name', 'Prospect', 'value', COUNT(*) FILTER (WHERE LOWER(COALESCE(cli_prospect, '')) ~ '^(sim|s|prospect|true|1)$')),
      json_build_object('name', 'Ativo', 'value', COUNT(*) FILTER (WHERE LOWER(COALESCE(cli_prospect, '')) !~ '^(sim|s|prospect|true|1)$'))
    ) AS val
    FROM deduped
  ),
  -- Por tipo cliente (top 10)
  por_tipo AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT cli_tipocliente AS name, COUNT(*) AS value
      FROM deduped
      WHERE cli_tipocliente IS NOT NULL
      GROUP BY cli_tipocliente
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) sub
  ),
  -- Por UF (top 10)
  por_uf AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT cli_uf AS name, COUNT(*) AS value
      FROM deduped
      WHERE cli_uf IS NOT NULL
      GROUP BY cli_uf
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) sub
  ),
  -- Por consultor (top 10)
  por_consultor AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT usr_nomeusuario AS name, COUNT(*) AS value
      FROM deduped
      WHERE usr_nomeusuario IS NOT NULL
      GROUP BY usr_nomeusuario
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'prospectVsAtivo', (SELECT val FROM prospect_vs_ativo),
    'porTipoCliente', (SELECT val FROM por_tipo),
    'porUF', (SELECT val FROM por_uf),
    'porConsultor', (SELECT val FROM por_consultor)
  ) INTO result;

  RETURN result;
END;
$$;


-------------------------------------------------------------------------------
-- RPC 5: rpc_acoes_bi
-- Retorna JSON com KPIs, rankings e breakdowns para a tab Acoes
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_bi(
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
AS $$
DECLARE
  result json;
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
  -- Por mes
  por_mes AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT TO_CHAR(aco_dthconclusao::date, 'YYYY-MM') AS name, COUNT(*) AS acoes
      FROM filtered
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
$$;


-------------------------------------------------------------------------------
-- INDICES para novas RPCs (IF NOT EXISTS — idempotent)
-------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ordens_servico_dthabertura
  ON mirror.ordens_servico (os_dthabertura);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_fstatus
  ON mirror.ordens_servico (os_fstatus);

CREATE INDEX IF NOT EXISTS idx_carteira_clientes_idcliente
  ON mirror.crm_carteira_clientes (cli_idcliente);


-------------------------------------------------------------------------------
-- Reload PostgREST schema cache
-------------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
