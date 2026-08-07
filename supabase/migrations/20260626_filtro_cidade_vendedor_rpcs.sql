-- Migration: Propagar filtros p_cidade/p_vendedor para RPCs de BI
-- Autor: @dev (Dex)
-- Data: 2026-06-26
-- Motivo: Painel BI precisa filtrar todos os cards por cidade e vendedor.
-- Base: funcoes VIVAS do banco (nao a versao antiga do 20260623).
-- Diferencas vs migration anterior: v_to LEAST fix, ngo_datacadastro no WHERE,
--   ORDER BY com ctid, CTEs velocidade+duracao_total, JOIN crm_negocios em pedidos,
--   pdo_codigointerno, CTEs grupo_produto+marca_produto.

-------------------------------------------------------------------------------
-- DROP old signatures to avoid overloads (CREATE OR REPLACE does NOT replace
-- if the argument list changes — it creates a new overload instead).
-------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_negocios_bi(date, date, text[]);
DROP FUNCTION IF EXISTS public.rpc_pedidos_bi(date, date);
DROP FUNCTION IF EXISTS public.rpc_servicos_bi(date, date);
DROP FUNCTION IF EXISTS public.rpc_admin_bi();

-------------------------------------------------------------------------------
-- RPC 1: rpc_negocios_bi
-- Adiciona: p_cidade (emp_cidade), p_vendedor (ngo_vendedores)
-- Base LIVE: v_to LEAST, ngo_datacadastro, ORDER BY ctid, CTEs velocidade+duracao_total
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_negocios_bi(
  p_from date,
  p_to date,
  p_funis text[] DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_vendedor text DEFAULT NULL
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
$$;


-------------------------------------------------------------------------------
-- RPC 2: rpc_pedidos_bi
-- Adiciona: p_cidade (emp_cidade), p_vendedor (pdo_vendedor)
-- Base LIVE: JOIN crm_negocios, filtro ngo_conclusao ganho, pdo_codigointerno,
--   CTEs grupo_produto + marca_produto
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_pedidos_bi(
  p_from date,
  p_to date,
  p_cidade text DEFAULT NULL,
  p_vendedor text DEFAULT NULL
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
  -- Por grupo de produto (top 10, aprovados)
  grupo_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT pdo_codigointerno AS name, COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS value
      FROM base
      WHERE is_aprovado AND pdo_codigointerno IS NOT NULL
      GROUP BY pdo_codigointerno
      ORDER BY SUM(pdo_vlrpedido) DESC
      LIMIT 10
    ) sub
  ),
  -- Por marca (top 10, aprovados)
  marca_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT pdo_codigointerno AS name, COUNT(*) AS value
      FROM base
      WHERE is_aprovado AND pdo_codigointerno IS NOT NULL
      GROUP BY pdo_codigointerno
      ORDER BY COUNT(*) DESC
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
-- RPC 3: rpc_servicos_bi — adiciona p_cidade (emp_cidade), sem vendedor
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_servicos_bi(
  p_from date,
  p_to date,
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
  -- Evolucao aberturas
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
-- RPC 4: rpc_admin_bi — adiciona p_cidade (cli_cidade), sem vendedor
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_admin_bi(
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
      AND (p_cidade IS NULL OR c.cli_cidade = p_cidade)
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
