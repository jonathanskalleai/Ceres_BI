-- Migration: 3 reliability fixes for BI RPCs
-- Autor: @data-engineer (Dara)
-- Data: 2026-06-25
-- Branch: perf/bi-quick-wins
--
-- Fix #1: Clamp p_to at CURRENT_DATE — prevents future-date ranges from showing
--         partial data as "drops" in charts.
-- Fix #2: Stable dedup tiebreaker — adds ngo_vlrtotalnegociado DESC + ctid to
--         ORDER BY in DISTINCT ON, preventing non-deterministic row selection.
-- Fix #3: taxaConversao join by code — resolves aco_vendedor (name) to
--         usr_codusuario via mirror.usuarios, then joins on code instead of
--         fragile UPPER(TRIM(name)) comparison.
--
-- Applies to: rpc_negocios_bi, rpc_negocios_crm

-------------------------------------------------------------------------------
-- RPC 1: rpc_negocios_bi (Fix #1 + Fix #2)
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
  v_to date := LEAST(p_to, CURRENT_DATE);  -- Fix #1: clamp future dates
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
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND v_to  -- Fix #1: v_to
      AND (p_funis IS NULL OR n.ngo_funil = ANY(p_funis))
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST, n.ngo_vlrtotalnegociado DESC NULLS LAST, n.ctid  -- Fix #2: stable tiebreaker
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
-- RPC 2: rpc_negocios_crm (Fix #1 + Fix #2 + Fix #3)
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_negocios_crm(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
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
  v_to date := LEAST(p_to, CURRENT_DATE);  -- Fix #1: clamp future dates
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
  -- Evolucao mensal: { mes, total, valor, ganhos }
  -- -----------------------------------------------------------------------
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.mes), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datacadastro::date, 'YYYY-MM') AS mes,
        COUNT(*) AS total,
        COALESCE(SUM(valor_efetivo), 0)::numeric AS valor,
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos
      FROM deduped
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
$$;

-------------------------------------------------------------------------------
-- Reload PostgREST schema cache
-------------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
