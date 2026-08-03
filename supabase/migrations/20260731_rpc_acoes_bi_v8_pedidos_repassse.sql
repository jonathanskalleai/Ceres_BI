-------------------------------------------------------------------------------
-- rpc_acoes_bi v8  (supersede 20260731_rpc_acoes_bi_v7_pedidos_only.sql)
--
-- MUDANCAS EM RELACAO A v7
--
-- 1) FILTRO DEFINITIVO DO CLIENTE NA CTE pedidos_periodo
--    Apos investigacao com 13 pedidos da planilha do cliente (R$ 1.660.540
--    ate 23/07/2026), o filtro correto foi descoberto:
--
--      pdo_situacaopedido = 'Aprovado'
--      AND ngo_conclusao  = 'Ganho'      -- JOIN com crm_negocios
--      AND ngo_funil     != 'REPASSE DE MAQUINA'  -- exclui revenda de usados
--      AND pdo_dthaprovacao::date BETWEEN p_from AND p_to
--
-- 2) CTE valores_status SETADA PARA 0 EM PERDIDO/ABERTO
--    pedidos_periodo JA vem filtrado para Aprovado. Cancelado e Aberto
--    nao tem pedidos no filtro atual. Setar 0 explicito para manter shape.
--
-- RATIONALE:
--    Cliente validou que quer EXCLUIR REPASSE DE MAQUINA do "ganhou" (semantica:
--    REPASSE = revenda de usados, nao venda nova). Validacao contra planilha:
--    13 pedidos / R$ 1.660.540 ate 23/07. Hoje (31/07) retorna 15 (2 foram
--    aprovados apos o print do cliente: 2678 MANNFRED e 2679 RAFAEL).
--
-- CTE ALTERADA: pedidos_periodo (JOIN crm_negocios + filtro REPASSE)
-- CTE REESCRITA: valores_status (perdido/aberto = 0)
-- CTEs INALTERADAS: filtered, negocios_dedup, pedidos_dedup, kpi_agg,
--   tempo_medio, kpis, por_vendedor, por_cidade, por_mes, por_dia,
--   por_tipo_acao, por_tipo_contato, lista_anos, por_vendedor_cidade,
--   clientes_atendidos
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
      COALESCE(cc.cli_cidade, a.emp_cidade) AS cidade,
      a.aco_tipocontato,
      a.aco_tipoacao,
      a.cli_nome,
      a.cli_idcliente,
      a.aco_dthconclusao,
      a.aco_dthabertura,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    LEFT JOIN LATERAL (
      SELECT c.cli_cidade
      FROM mirror.crm_carteira_clientes c
      WHERE c.cli_idcliente = a.cli_idcliente
        AND c.cli_cidade IS NOT NULL
        AND c.cli_cidade <> ''
      LIMIT 1
    ) cc ON TRUE
    WHERE (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
  ),
  -- CTE NOVA v8: pedidos_dedup
  pedidos_dedup AS (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_dthaprovacao,
      p.ngo_numero,
      p.pdo_vendedor,
      p.pdo_cidadeufentrega
    FROM mirror.crm_pedidos p
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  -- CTE v8: pedidos_periodo — FILTRO DEFINITIVO
  -- pedido Aprovado + negocio Ganho + funil != REPASSE DE MAQUINA
  pedidos_periodo AS (
    SELECT pd.*
    FROM pedidos_dedup pd
    JOIN mirror.crm_negocios nd ON nd.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND pd.pdo_situacaopedido = 'Aprovado'
      AND nd.ngo_conclusao = 'Ganho'
      AND nd.ngo_funil != 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR pd.pdo_vendedor = p_vendedor)
      AND (p_cidade IS NULL OR pd.pdo_cidadeufentrega = p_cidade)
  ),
  -- CTE REESCRITA v8: valores_status (perdido/aberto = 0)
  valores_status AS (
    SELECT
      COALESCE(SUM(pdo_vlrpedido), 0) AS valor_ganho,
      COUNT(*) AS neg_ganho,
      0::numeric AS valor_perdido,
      0::int AS neg_perdido,
      0::numeric AS valor_aberto,
      0::int AS neg_aberto,
      COUNT(*) AS neg_total,
      COALESCE(SUM(pdo_vlrpedido), 0) AS valor_total,
      0::int AS neg_outros
    FROM pedidos_periodo
  ),
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_acoes,
      COUNT(DISTINCT cidade) FILTER (WHERE cidade IS NOT NULL AND cidade <> '') AS cidades,
      COUNT(DISTINCT aco_vendedor) FILTER (WHERE aco_vendedor IS NOT NULL) AS consultores,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(aco_tipocontato, '')) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT cli_nome) FILTER (WHERE cli_nome IS NOT NULL) AS clientes,
      COUNT(DISTINCT aco_tipoacao) FILTER (WHERE aco_tipoacao IS NOT NULL) AS tipos_acao_distintos
    FROM filtered
  ),
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
      'valorAberto', (SELECT valor_aberto FROM valores_status),
      'negociosAberto', (SELECT neg_aberto FROM valores_status),
      'valorGanho', (SELECT valor_ganho FROM valores_status),
      'negociosGanho', (SELECT neg_ganho FROM valores_status),
      'valorPerdido', (SELECT valor_perdido FROM valores_status),
      'negociosPerdido', (SELECT neg_perdido FROM valores_status),
      'negociosTocados', (SELECT neg_total FROM valores_status),
      'valorTocado', (SELECT valor_total FROM valores_status),
      'negociosOutrosStatus', (SELECT neg_outros FROM valores_status),
      'tempoMedioContato', (SELECT dias FROM tempo_medio)
    ) AS val
  ),
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
  por_cidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT f.cidade AS name, COUNT(*) AS acoes
      FROM filtered f
      WHERE f.cidade IS NOT NULL AND f.cidade <> ''
      GROUP BY f.cidade
      ORDER BY COUNT(*) DESC
      LIMIT 15
    ) sub
  ),
  por_mes AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM') AS name, COUNT(*) AS acoes
      FROM mirror.crm_acoes a
      LEFT JOIN LATERAL (
        SELECT c.cli_cidade
        FROM mirror.crm_carteira_clientes c
        WHERE c.cli_idcliente = a.cli_idcliente
          AND c.cli_cidade IS NOT NULL
          AND c.cli_cidade <> ''
        LIMIT 1
      ) cc ON TRUE
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
        AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
      GROUP BY TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM')
    ) sub
  ),
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
  lista_anos AS (
    SELECT COALESCE(json_agg(sub.ano ORDER BY sub.ano DESC), '[]'::json) AS val
    FROM (
      SELECT DISTINCT TO_CHAR(aco_dthconclusao::date, 'YYYY') AS ano
      FROM filtered
    ) sub
  ),
  por_vendedor_cidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        f.aco_vendedor AS vendedor,
        f.cidade AS cidade,
        COUNT(*) AS acoes,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(f.aco_tipocontato, '')) LIKE '%visita%') AS visitas
      FROM filtered f
      WHERE f.aco_vendedor IS NOT NULL AND f.cidade IS NOT NULL AND f.cidade <> ''
      GROUP BY f.aco_vendedor, f.cidade
      ORDER BY COUNT(*) DESC
      LIMIT 50
    ) sub
  ),
  clientes_atendidos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        a.cli_nome AS cliente,
        COALESCE(cc.cli_cidade, a.emp_cidade) AS cidade,
        COUNT(*) AS acoes,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.aco_tipocontato, '')) LIKE '%visita%') AS visitas
      FROM mirror.crm_acoes a
      LEFT JOIN LATERAL (
        SELECT c.cli_cidade
        FROM mirror.crm_carteira_clientes c
        WHERE c.cli_idcliente = a.cli_idcliente
          AND c.cli_cidade IS NOT NULL
          AND c.cli_cidade <> ''
        LIMIT 1
      ) cc ON TRUE
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND a.cli_nome IS NOT NULL AND a.cli_nome <> ''
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
        AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
      GROUP BY a.cli_nome, COALESCE(cc.cli_cidade, a.emp_cidade)
      ORDER BY COUNT(*) DESC
      LIMIT 15
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
    'porVendedorCidade', (SELECT val FROM por_vendedor_cidade),
    'clientesMaisAtendidos', (SELECT val FROM clientes_atendidos)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text) TO anon, authenticated, service_role;