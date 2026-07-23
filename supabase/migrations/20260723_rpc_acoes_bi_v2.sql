-------------------------------------------------------------------------------
-- rpc_acoes_bi v2
-- Adds: kpis.valorNegociado, kpis.tempoMedioContato, porVendedorCidade ranking
-- Uses DISTINCT ON(ngo_numero) subquery to avoid fan-out from crm_negocios
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
      a.aco_dthconclusao,
      a.aco_dthabertura,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR a.emp_cidade = p_cidade)
  ),
  -- Deduplicated negocios (avoid fan-out from product rows)
  negocios_dedup AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_vlrtotalnegociado
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
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
  -- Valor negociado: SUM of linked negocios (distinct ngo_numero per acao)
  valor_neg AS (
    SELECT COALESCE(SUM(nd.ngo_vlrtotalnegociado), 0) AS valor
    FROM (
      SELECT DISTINCT f.ngo_nronegocio
      FROM filtered f
      WHERE f.ngo_nronegocio IS NOT NULL
        AND f.ngo_nronegocio <> ''
    ) distinct_ngo
    JOIN negocios_dedup nd ON nd.ngo_numero = distinct_ngo.ngo_nronegocio
  ),
  -- Tempo medio contato: AVG days between abertura and conclusao
  tempo_medio AS (
    SELECT COALESCE(
      AVG(EXTRACT(EPOCH FROM (aco_dthconclusao - aco_dthabertura)) / 86400)::int,
      0
    ) AS dias
    FROM filtered
    WHERE aco_dthabertura IS NOT NULL
      AND aco_dthconclusao IS NOT NULL
      AND aco_dthconclusao > aco_dthabertura
  ),
  kpis AS (
    SELECT json_build_object(
      'totalAcoes', (SELECT total_acoes FROM kpi_agg),
      'cidades', (SELECT cidades FROM kpi_agg),
      'consultores', (SELECT consultores FROM kpi_agg),
      'visitas', (SELECT visitas FROM kpi_agg),
      'clientes', (SELECT clientes FROM kpi_agg),
      'tiposAcaoDistintos', (SELECT tipos_acao_distintos FROM kpi_agg),
      'valorNegociado', (SELECT valor FROM valor_neg),
      'tempoMedioContato', (SELECT dias FROM tempo_medio)
    ) AS val
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
  -- Por dia da semana
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
  ),
  -- Ranking por vendedor+cidade (top 50)
  por_vendedor_cidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        aco_vendedor AS vendedor,
        emp_cidade AS cidade,
        COUNT(*) AS acoes,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(aco_tipocontato, '')) LIKE '%visita%') AS visitas
      FROM filtered
      WHERE aco_vendedor IS NOT NULL AND emp_cidade IS NOT NULL
      GROUP BY aco_vendedor, emp_cidade
      ORDER BY COUNT(*) DESC
      LIMIT 50
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
    'listaAnos', (SELECT val FROM lista_anos),
    'porVendedorCidade', (SELECT val FROM por_vendedor_cidade)
  ) INTO result;

  RETURN result;
END;
$$;
