-- Migration: RPCs para useInteligenciaBI (Fase 1)
-- Autor: @data-engineer (Dara)
-- Data: 2026-06-24
-- Dependencia: 20260624_expand_negocios_pedidos_rpcs.sql (existing RPCs)
-- Descrição: Extends rpc_pedidos_bi + rpc_servicos_bi with new aggregations,
--            creates rpc_inteligencia_esforco_bi and rpc_parque_renovacao_bi.
-- Nota: nomes de coluna sem underscore intermediario (banco vivo diverge da DDL).
--       Confirmado via RPCs em producao que funcionam.

-------------------------------------------------------------------------------
-- RPC 1: rpc_pedidos_bi (REPLACE — adds sharePorBanco + mixFaturamento)
-- Mantém TUDO da versão anterior + 2 novos campos no JSON
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
      p.pdo_financiamentobanco,
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
  ),
  -- NEW: Share por banco financiador (top 8, aprovados com financiamento)
  share_banco AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(pdo_financiamentobanco), ''), 'Nao informado') AS name,
        COALESCE(SUM(pdo_vlrfinanciado), 0)::numeric AS valor,
        COUNT(*) AS qtd
      FROM base
      WHERE is_aprovado AND pdo_vlrfinanciado > 0
      GROUP BY COALESCE(NULLIF(TRIM(pdo_financiamentobanco), ''), 'Nao informado')
      ORDER BY SUM(pdo_vlrfinanciado) DESC
      LIMIT 8
    ) sub
  ),
  -- NEW: Mix faturamento detalhado (financiado + recurso proprio + total aprovado)
  mix_faturamento AS (
    SELECT json_build_object(
      'financiado', COALESCE(SUM(pdo_vlrfinanciado) FILTER (WHERE is_aprovado), 0)::numeric,
      'recursoProprio', COALESCE(SUM(pdo_vlrrecursoproprio) FILTER (WHERE is_aprovado), 0)::numeric,
      'total', COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE is_aprovado), 0)::numeric
    ) AS val
    FROM base
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'porSituacao', (SELECT val FROM situacao),
    'mixPagamento', (SELECT val FROM mix),
    'porVendedor', (SELECT val FROM vendedores),
    'porCidade', (SELECT val FROM cidades),
    'porGrupoProduto', (SELECT val FROM grupo_produto),
    'porMarcaProduto', (SELECT val FROM marca_produto),
    'sharePorBanco', (SELECT val FROM share_banco),
    'mixFaturamento', (SELECT val FROM mix_faturamento)
  ) INTO result;

  RETURN result;
END;
$$;


-------------------------------------------------------------------------------
-- RPC 2: rpc_servicos_bi (REPLACE — adds slaPorFilial + slaPorTipoOS)
-- Mantém TUDO da versão anterior + 2 novos campos no JSON
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
      os.emp_cod_filial,
      os.tos_cod_tipo_os,
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
  ),
  -- NEW: SLA por filial (media dias resolucao por filial, top 10)
  sla_filial AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(emp_cod_filial), ''), 'Sem filial') AS name,
        ROUND(AVG(dias_resolucao)::numeric, 1) AS "diasMedio",
        COUNT(*) AS qtd
      FROM base
      WHERE dias_resolucao IS NOT NULL
      GROUP BY COALESCE(NULLIF(TRIM(emp_cod_filial), ''), 'Sem filial')
      ORDER BY AVG(dias_resolucao) DESC
      LIMIT 10
    ) sub
  ),
  -- NEW: SLA por tipo OS (media dias resolucao por tipo, top 10)
  sla_tipo AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(tos_cod_tipo_os), ''), 'Sem tipo') AS name,
        ROUND(AVG(dias_resolucao)::numeric, 1) AS "diasMedio",
        COUNT(*) AS qtd
      FROM base
      WHERE dias_resolucao IS NOT NULL
      GROUP BY COALESCE(NULLIF(TRIM(tos_cod_tipo_os), ''), 'Sem tipo')
      ORDER BY AVG(dias_resolucao) DESC
      LIMIT 10
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'porStatus', (SELECT val FROM por_status),
    'faixasResolucao', (SELECT val FROM faixas),
    'evolucaoAberturas', (SELECT val FROM evolucao),
    'situacaoOcorrencias', '[]'::json,
    'motivosPausa', '[]'::json,
    'causasAtendimento', '[]'::json,
    'slaPorFilial', (SELECT val FROM sla_filial),
    'slaPorTipoOS', (SELECT val FROM sla_tipo)
  ) INTO result;

  RETURN result;
END;
$$;


-------------------------------------------------------------------------------
-- RPC 3: rpc_inteligencia_esforco_bi
-- Win rate por vendedor + visitas por negocio ganho
-- Dedup negocios por ngo_numero, classifica ganho/perdido via ngo_conclusao
-- JOIN com crm_acoes (tipo_contato = visita) para medir esforco real
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_inteligencia_esforco_bi(
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
  WITH deduped_negocios AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_vendedores,
      n.ngo_vlrtotalnegociado,
      n.ngo_datafechamento,
      n.ngo_funil,
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        ELSE 'andamento'
      END AS status_class
    FROM mirror.crm_negocios n
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (p_funis IS NULL OR n.ngo_funil = ANY(p_funis))
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  -- Win rate por vendedor (top 10 por volume)
  win_rate AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        ngo_vendedores AS name,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos,
        COUNT(*) FILTER (WHERE status_class = 'perdido') AS perdidos,
        CASE WHEN COUNT(*) > 0
          THEN ROUND((COUNT(*) FILTER (WHERE status_class = 'ganho')::numeric / COUNT(*)) * 100, 1)
          ELSE 0
        END AS "winRate",
        COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE status_class = 'ganho'), 0)::numeric AS "valorGanho"
      FROM deduped_negocios
      WHERE ngo_vendedores IS NOT NULL
      GROUP BY ngo_vendedores
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) sub
  ),
  -- Visitas por negocio ganho (JOIN crm_acoes tipo_contato com visita)
  ganhos_com_visitas AS (
    SELECT
      dn.ngo_vendedores AS vendedor,
      dn.ngo_numero,
      COUNT(a.aco_id_acao) AS visitas
    FROM deduped_negocios dn
    LEFT JOIN mirror.crm_acoes a
      ON a.ngo_nro_negocio = dn.ngo_numero
      AND LOWER(COALESCE(a.aco_tipo_contato, '')) LIKE '%visit%'
    WHERE dn.status_class = 'ganho'
    GROUP BY dn.ngo_vendedores, dn.ngo_numero
  ),
  visitas_por_ganho AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        vendedor AS name,
        ROUND(AVG(visitas)::numeric, 1) AS "mediaVisitas",
        COUNT(*) AS "negociosGanhos",
        SUM(visitas)::int AS "totalVisitas"
      FROM ganhos_com_visitas
      WHERE vendedor IS NOT NULL
      GROUP BY vendedor
      HAVING COUNT(*) >= 2
      ORDER BY AVG(visitas) DESC
      LIMIT 10
    ) sub
  ),
  -- KPIs de esforço resumidos
  esforco_kpis AS (
    SELECT json_build_object(
      'totalNegocios', (SELECT COUNT(*) FROM deduped_negocios),
      'ganhos', (SELECT COUNT(*) FROM deduped_negocios WHERE status_class = 'ganho'),
      'perdidos', (SELECT COUNT(*) FROM deduped_negocios WHERE status_class = 'perdido'),
      'winRateGeral', CASE
        WHEN (SELECT COUNT(*) FROM deduped_negocios WHERE status_class IN ('ganho','perdido')) > 0
        THEN ROUND(
          (SELECT COUNT(*) FROM deduped_negocios WHERE status_class = 'ganho')::numeric /
          (SELECT COUNT(*) FROM deduped_negocios WHERE status_class IN ('ganho','perdido')) * 100, 1)
        ELSE 0
      END,
      'mediaVisitasPorGanho', COALESCE(
        (SELECT ROUND(AVG(visitas)::numeric, 1) FROM ganhos_com_visitas), 0)
    ) AS val
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM esforco_kpis),
    'winRatePorVendedor', (SELECT val FROM win_rate),
    'visitasPorNegocioGanho', (SELECT val FROM visitas_por_ganho)
  ) INTO result;

  RETURN result;
END;
$$;


-------------------------------------------------------------------------------
-- RPC 4: rpc_parque_renovacao_bi
-- Identifica maquinas com potencial de renovacao (ano < ano_atual - cutoff)
-- Classifica por marca propria vs concorrencia
-- Retorna top 15 marcas + segmentacao nossa/concorrencia
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_parque_renovacao_bi(
  p_cutoff_anos integer DEFAULT 5
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_ano_corte integer;
BEGIN
  v_ano_corte := EXTRACT(YEAR FROM CURRENT_DATE)::integer - p_cutoff_anos;

  WITH parque_antigo AS (
    SELECT
      p.pqm_marca,
      p.pqm_grupo,
      p.pqm_modelo,
      p.pqm_ano,
      COALESCE(p.pqm_qtd_maquinas, 1) AS qtd,
      CASE
        WHEN UPPER(COALESCE(p.pqm_marca, '')) IN ('CASE', 'CASE IH', 'NEW HOLLAND', 'IVECO')
        THEN true
        ELSE false
      END AS is_nossa_marca
    FROM mirror.cliente_parque_maquinas p
    WHERE p.pqm_ano IS NOT NULL
      AND p.pqm_ano ~ '^\d{4}$'
      AND p.pqm_ano::integer <= v_ano_corte
  ),
  -- Top 15 marcas com mais maquinas antigas
  por_marca AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(pqm_marca), ''), 'Sem marca') AS name,
        SUM(qtd)::int AS "totalMaquinas",
        ROUND(AVG(pqm_ano::numeric), 0)::int AS "anoMedio",
        COUNT(DISTINCT pqm_modelo) AS "modelos"
      FROM parque_antigo
      GROUP BY COALESCE(NULLIF(TRIM(pqm_marca), ''), 'Sem marca')
      ORDER BY SUM(qtd) DESC
      LIMIT 15
    ) sub
  ),
  -- Segmentacao: nossas marcas vs concorrencia
  segmentacao AS (
    SELECT json_build_object(
      'nossasMarcas', json_build_object(
        'total', COALESCE(SUM(qtd) FILTER (WHERE is_nossa_marca), 0)::int,
        'marcas', (
          SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
          FROM (
            SELECT
              pqm_marca AS name,
              SUM(qtd)::int AS "totalMaquinas"
            FROM parque_antigo
            WHERE is_nossa_marca
            GROUP BY pqm_marca
            ORDER BY SUM(qtd) DESC
          ) s
        )
      ),
      'concorrencia', json_build_object(
        'total', COALESCE(SUM(qtd) FILTER (WHERE NOT is_nossa_marca), 0)::int,
        'marcas', (
          SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
          FROM (
            SELECT
              COALESCE(NULLIF(TRIM(pqm_marca), ''), 'Sem marca') AS name,
              SUM(qtd)::int AS "totalMaquinas"
            FROM parque_antigo
            WHERE NOT is_nossa_marca
            GROUP BY COALESCE(NULLIF(TRIM(pqm_marca), ''), 'Sem marca')
            ORDER BY SUM(qtd) DESC
            LIMIT 10
          ) s
        )
      )
    ) AS val
    FROM parque_antigo
  ),
  -- KPIs gerais
  parque_kpis AS (
    SELECT json_build_object(
      'totalMaquinasAntigas', COALESCE(SUM(qtd), 0)::int,
      'anoCorte', v_ano_corte,
      'percentNossaMarca', CASE
        WHEN SUM(qtd) > 0
        THEN ROUND((SUM(qtd) FILTER (WHERE is_nossa_marca)::numeric / SUM(qtd)) * 100, 1)
        ELSE 0
      END,
      'marcasDistintas', COUNT(DISTINCT pqm_marca)::int
    ) AS val
    FROM parque_antigo
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM parque_kpis),
    'porMarca', (SELECT val FROM por_marca),
    'segmentacao', (SELECT val FROM segmentacao)
  ) INTO result;

  RETURN result;
END;
$$;


-------------------------------------------------------------------------------
-- Indexes for new RPCs (IF NOT EXISTS — idempotent)
-------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_acoes_ngo_nro_negocio
  ON mirror.crm_acoes (ngo_nro_negocio);

CREATE INDEX IF NOT EXISTS idx_acoes_tipo_contato
  ON mirror.crm_acoes (aco_tipo_contato);

CREATE INDEX IF NOT EXISTS idx_parque_ano
  ON mirror.cliente_parque_maquinas (pqm_ano);

CREATE INDEX IF NOT EXISTS idx_pedidos_financiamento_banco
  ON mirror.crm_pedidos (pdo_financiamentobanco);


-------------------------------------------------------------------------------
-- Reload PostgREST schema cache
-------------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
