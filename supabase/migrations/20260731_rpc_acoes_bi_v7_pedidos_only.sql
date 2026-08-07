-------------------------------------------------------------------------------
-- rpc_acoes_bi v7  (supersede 20260731_rpc_acoes_bi_v6_funis_all.sql)
--
-- MUDANCAS EM RELACAO A v6
--
-- 1) REMOCAO DO FILTRO DE ACAO DA CTE pedidos_periodo
--    Ate a v6: pedidos_periodo filtrava por
--    `EXISTS (SELECT 1 FROM mirror.crm_acoes a WHERE a.ngo_nronegocio = pd.ngo_numero ...)`
--    Isso trazia pedidos APROVADOS em QUALQUER data (2025-12, 2026-02, etc)
--    desde que o negocio correspondente tivesse sido tocado por acao no periodo.
--
--    PROBLEMA IDENTIFICADO: cliente validou 13 pedidos aprovados com
--    pdo_dthaprovacao entre 01/07 e 23/07/2026. A logica de acao expadia
--    demais, incluindo pedidos de meses anteriores que nao saem no relatorio.
--
--    SOLUCAO v7: pedidos_periodo filtra APENAS por pdo_dthaprovacao no
--    periodo + vendedor + cidade. SEM JOIN, SEM EXISTS com acoes/negocios.
--
-- 2) REMOCAO DO JOIN COM negocios_dedup EM valores_status
--    A CTE valores_status agora agrega direto de pedidos_periodo, sem JOIN.
--
-- 3) REMOCAO DE CTEs ORBAFAS
--    negocios_tocados nao e mais referenciada por nenhuma CTE.
--    Removida para nao criar confusao.
--
-- RATIONALE:
--    Cliente validou que o valor correto e R$ 1.660.540 (13 pedidos) quando
--    filtramos apenas por pdo_dthaprovacao no periodo, SEM filtro de acao.
--    Essa e a semantica correta para "valor/pedidos GANHOS no periodo".
--
-- CTE ALTERADA: pedidos_periodo (filtro de acao removido)
-- CTE REESCRITA: valores_status (sem JOIN com negocios_dedup)
-- CTE REMOVIDA: negocios_tocados
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
      -- cidade unificada da tela: cidade do CLIENTE, com fallback na filial
      -- (fallback e inerte hoje: 0 acoes do mes sem match na carteira)
      COALESCE(cc.cli_cidade, a.emp_cidade) AS cidade,
      a.aco_tipocontato,
      a.aco_tipoacao,
      a.cli_nome,
      a.cli_idcliente,
      a.aco_dthconclusao,
      a.aco_dthabertura,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    -- LATERAL + LIMIT 1: 1 linha de carteira por acao (anti fan-out, vide cabecalho)
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
      -- p_cidade agora casa com a cidade do CLIENTE (era emp_cidade ate a v3)
      AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
  ),
  -- Negocios deduplicados por ngo_numero (a tabela esta no grao negocio x produto).
  -- Traz ngo_conclusao e ngo_funil (novos na v4) para o recorte dos 3 cards.
  -- NOTA: nao e mais usada por pedidos_periodo (v7), mantida para extensibilidade.
  negocios_dedup AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_vlrtotalnegociado,
      n.ngo_conclusao,
      n.ngo_funil
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  -- ---------------------------------------------------------------------------
  -- CTE v5: pedidos_dedup
  -- Deduplicacao de pedidos por pdo_codigointerno. Segue o padrao de
  -- rpc_pedidos_bi (20260627_pedidos_por_data_ganho.sql).
  -- Ordena por pdo_dthaprovacao DESC para manter a versao mais recente do
  -- pedido quando ha duplicatas (mesmo codigo, datas diferentes).
  -- ---------------------------------------------------------------------------
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
  -- ---------------------------------------------------------------------------
  -- CTE ALTERADA v7: pedidos_periodo
  --
  -- PEDIDOS APROVADOS NO PERIODO — SEM FILTRO DE ACAO, SEM FILTRO DE FUNIL.
  --
  -- v6 (INCORRETO): filtrava por EXISTS com acoes/negocios_tocados, o que
  -- trazia pedidos APROVADOS em qualquer data desde que o negocio tivesse
  -- acao no periodo.
  --
  -- v7 (CORRIGIDO): filtra apenas por pdo_dthaprovacao::date no periodo.
  -- Filtros de vendedor e cidade mantidos para consistencia com o painel.
  -- SEM JOIN, SEM EXISTS com crm_acoes ou crm_negocios.
  --
  -- Validacao: cliente confirmou 13 pedidos / R$ 1.660.540 entre 01/07 e
  -- 23/07/2026 com este filtro.
  -- ---------------------------------------------------------------------------
  pedidos_periodo AS (
    SELECT pd.*
    FROM pedidos_dedup pd
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR pd.pdo_vendedor = p_vendedor)
      AND (p_cidade IS NULL OR pd.pdo_cidadeufentrega = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE REESCRITA v7: valores_status
  -- AGORA agrega direto de pedidos_periodo, SEM JOIN com negocios_dedup.
  -- Campos JSON mantidos para nao quebrar o frontend.
  --
  -- Mapeamento de pdo_situacaopedido:
  --   Aprovado               -> valorGanho / negociosGanho
  --   Cancelado              -> valorPerdido / negociosPerdido
  --   Aberto / Aguardando Aprovacao / Sem Situacao -> valorAberto / negociosAberto
  --   Outro / NULL           -> negociosOutrosStatus (controle)
  -- ---------------------------------------------------------------------------
  valores_status AS (
    SELECT
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE pdo_situacaopedido = 'Aprovado'), 0) AS valor_ganho,
      COUNT(*) FILTER (WHERE pdo_situacaopedido = 'Aprovado') AS neg_ganho,
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE pdo_situacaopedido = 'Cancelado'), 0) AS valor_perdido,
      COUNT(*) FILTER (WHERE pdo_situacaopedido = 'Cancelado') AS neg_perdido,
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE pdo_situacaopedido IN ('Aberto', 'Aguardando Aprovação', 'Sem Situação')), 0) AS valor_aberto,
      COUNT(*) FILTER (WHERE pdo_situacaopedido IN ('Aberto', 'Aguardando Aprovação', 'Sem Situação')) AS neg_aberto,
      COUNT(*) AS neg_total,
      COALESCE(SUM(pdo_vlrpedido), 0) AS valor_total,
      COUNT(*) FILTER (
        WHERE pdo_situacaopedido IS NULL
           OR pdo_situacaopedido NOT IN ('Aprovado', 'Cancelado', 'Aberto', 'Aguardando Aprovação', 'Sem Situação')
      ) AS neg_outros
    FROM pedidos_periodo
  ),
  -- KPIs
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
  -- Tempo medio: AVG(conclusao - abertura) em dias. E a DURACAO da acao,
  -- nao o tempo ate o 1o contato (rotulo corrigido no frontend).
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
      -- controle: total dos negocios comerciais tocados e sobra fora dos 3 status.
      -- negociosTocados = negociosAberto+negociosGanho+negociosPerdido+negociosOutros.
      'negociosTocados', (SELECT neg_total FROM valores_status),
      'valorTocado', (SELECT valor_total FROM valores_status),
      'negociosOutrosStatus', (SELECT neg_outros FROM valores_status),
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
  -- Por cidade do CLIENTE (top 15) — sem fan-out: usa a cidade ja resolvida em filtered
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
  -- Por mes — ANO ATUAL fixo (ignora p_from/p_to de proposito)
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
  -- Lista de anos disponiveis
  lista_anos AS (
    SELECT COALESCE(json_agg(sub.ano ORDER BY sub.ano DESC), '[]'::json) AS val
    FROM (
      SELECT DISTINCT TO_CHAR(aco_dthconclusao::date, 'YYYY') AS ano
      FROM filtered
    ) sub
  ),
  -- Heatmap consultor x cidade do CLIENTE (top 50) — sem fan-out
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
  -- Clientes mais atendidos — ANO ATUAL fixo (ignora p_from/p_to), top 15.
  -- Fan-out da carteira corrigido aqui tambem (era LEFT JOIN direto na v3).
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
