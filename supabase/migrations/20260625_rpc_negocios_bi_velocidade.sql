-- Migration: Add velocidadeFunil + duracaoMediaTotal to rpc_negocios_bi
-- Autor: @dev (Dex)
-- Data: 2026-06-25
-- Branch: perf/bi-quick-wins
--
-- Fixes ComercialSection crash: agg.velocidadeFunil.map() on undefined.
-- Adds 2 new CTEs (velocidade_funil) and 2 fields to the JSON output.
-- All existing CTEs and logic are preserved intact from 20260625_fix_rpc_data_reliability.sql.

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
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND v_to
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
  ),
  -- NEW: Velocidade do funil — tempo medio por etapa
  velocidade_funil AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub."diasMedio" DESC), '[]'::json) AS val
    FROM (
      SELECT
        ngo_etapa AS name,
        ROUND(AVG(COALESCE(ngo_ciclovendas, 0)))::int AS "diasMedio",
        COUNT(*) AS qtd
      FROM deduped
      WHERE ngo_etapa IS NOT NULL AND ngo_ciclovendas > 0
      GROUP BY ngo_etapa
      ORDER BY "diasMedio" DESC
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'funilPorEtapa', (SELECT val FROM funil),
    'porOrigem', (SELECT val FROM origens),
    'motivosPerda', (SELECT val FROM motivos),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'rankingConsultor', (SELECT val FROM ranking),
    'velocidadeFunil', (SELECT val FROM velocidade_funil),
    'duracaoMediaTotal', COALESCE((SELECT ROUND(AVG(ngo_ciclovendas))::int FROM deduped WHERE ngo_ciclovendas > 0), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
