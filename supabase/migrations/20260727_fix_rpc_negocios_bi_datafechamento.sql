-- Fix: rpc_negocios_bi filtrava por ngo_datacadastro (data de criacao) em vez de
-- ngo_datafechamento (data de fechamento). Resultado: negocios fechados no periodo
-- nao apareciam se cadastrados fora dele. 6 ocorrencias corrigidas nas CTEs
-- deduped, deduped_evo e evo.

CREATE OR REPLACE FUNCTION public.rpc_negocios_bi(
  p_from date,
  p_to date,
  p_funis text[] DEFAULT NULL::text[],
  p_cidade text DEFAULT NULL::text,
  p_vendedor text DEFAULT NULL::text
)
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
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND v_to
      AND (p_funis IS NULL OR n.ngo_funil = ANY(p_funis))
      AND (p_cidade IS NULL OR n.emp_cidade = p_cidade)
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
    ORDER BY n.ngo_numero, n.ngo_datafechamento DESC NULLS LAST, n.ngo_vlrtotalnegociado DESC NULLS LAST, n.ctid
  ),
  -- Janela de evolucao: 12 meses rolling, mesmos predicados NAO-data do deduped
  deduped_evo AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_datafechamento,
      n.ngo_vlrtotalnegociado
    FROM mirror.crm_negocios n
    WHERE n.ngo_datafechamento::date BETWEEN v_evo_from AND v_evo_to
      AND (p_funis IS NULL OR n.ngo_funil = ANY(p_funis))
      AND (p_cidade IS NULL OR n.emp_cidade = p_cidade)
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
    ORDER BY n.ngo_numero, n.ngo_datafechamento DESC NULLS LAST, n.ngo_vlrtotalnegociado DESC NULLS LAST, n.ctid
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
      WHERE ngo_etapa IS NOT NULL AND ngo_etapa != ''
      GROUP BY ngo_etapa
    ) sub
  ),
  -- Por origem
  origem AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.qtd DESC), '[]'::json) AS val
    FROM (
      SELECT ngo_formaentrada AS name, COUNT(*) AS qtd
      FROM deduped
      WHERE ngo_formaentrada IS NOT NULL AND ngo_formaentrada != ''
      GROUP BY ngo_formaentrada
    ) sub
  ),
  -- Motivos de perda
  motivos AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.qtd DESC), '[]'::json) AS val
    FROM (
      SELECT ngo_motivoperda AS motivo, COUNT(*) AS qtd
      FROM deduped
      WHERE status_class = 'perdido' AND ngo_motivoperda IS NOT NULL AND ngo_motivoperda != ''
      GROUP BY ngo_motivoperda
    ) sub
  ),
  -- Evolucao mensal (janela propria de 12 meses)
  evo AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.mes), '[]'::json) AS val
    FROM (
      SELECT to_char(date_trunc('month', ngo_datafechamento), 'YYYY-MM') AS mes,
             COUNT(*) AS qtd,
             SUM(ngo_vlrtotalnegociado)::numeric AS valor
      FROM deduped_evo
      GROUP BY 1
    ) sub
  ),
  -- Ranking por consultor
  ranking AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT ngo_vendedores AS consultor, COUNT(*) AS qtd, SUM(ngo_vlrtotalnegociado)::numeric AS valor
      FROM deduped
      WHERE ngo_vendedores IS NOT NULL AND ngo_vendedores != ''
      GROUP BY ngo_vendedores
    ) sub
  ),
  -- Velocidade do funil (tempo medio por etapa para ganhos)
  velocidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.dias_medio DESC), '[]'::json) AS val
    FROM (
      SELECT
        fe.etapa_dscstatusnegocio AS etapa,
        COUNT(d.ngo_numero) AS qtd,
        COALESCE(AVG(d.ngo_ciclovendas), 0)::numeric AS dias_medio
      FROM mirror.crm_funil_etapa fe
      LEFT JOIN deduped d ON d.ngo_etapa = fe.etapa_dscstatusnegocio AND d.status_class = 'ganho'
      WHERE fe.funil_dsc = ANY(COALESCE(p_funis, ARRAY['VENDAS']))
      GROUP BY fe.etapa_dscstatusnegocio
    ) sub
  ),
  -- Duracao media total (ciclo de todos ganhos)
  duracao AS (
    SELECT COALESCE(AVG(ngo_ciclovendas), 0)::numeric AS val
    FROM deduped
    WHERE status_class = 'ganho' AND ngo_ciclovendas > 0
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'funilPorEtapa', (SELECT val FROM funil),
    'porOrigem', (SELECT val FROM origem),
    'motivosPerda', (SELECT val FROM motivos),
    'evolucaoMensal', (SELECT val FROM evo),
    'rankingConsultor', (SELECT val FROM ranking),
    'velocidadeFunil', (SELECT val FROM velocidade),
    'duracaoMediaTotal', (SELECT val FROM duracao)
  ) INTO result;

  RETURN result;
END;
$function$;
