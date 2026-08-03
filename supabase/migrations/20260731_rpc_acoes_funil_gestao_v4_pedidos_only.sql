-------------------------------------------------------------------------------
-- rpc_acoes_funil_gestao v4  (supersede 20260731_rpc_acoes_funil_gestao_v3.sql)
--
-- MUDANCAS EM RELACAO A v3
--
-- 1) REMOCAO DO FILTRO DE ACAO DA CTE pedidos_periodo
--    Ate a v3: pedidos_periodo filtrava por
--    `EXISTS (SELECT 1 FROM mirror.crm_acoes a WHERE a.ngo_nronegocio = pd.ngo_numero ...)`
--    Isso trazia pedidos APROVADOS em QUALQUER data (2025-12, 2026-02, etc)
--    desde que o negocio correspondente tivesse sido tocado por acao no periodo.
--
--    PROBLEMA IDENTIFICADO: cliente validou 13 pedidos aprovados com
--    pdo_dthaprovacao entre 01/07 e 23/07/2026. A logica de acao expadia
--    demais, incluindo pedidos de meses anteriores.
--
--    SOLUCAO v4: pedidos_periodo filtra APENAS por pdo_dthaprovacao no
--    periodo. SEM JOIN, SEM EXISTS com acoes/negocios.
--
-- 2) REMOCAO DA CTE negocios_tocados
--    Nao e mais referenciada por nenhuma CTE. Removida para nao criar
--    confusao com a nova logica de pedidos.
--
-- 3) RANKING (neg_side) MANTEM atribuicao hibrida
--    O JOIN com negocios_dedup permanece para pegar ngo_vendedores (dono do
--    negocio). Isso permite atribuir ganhos por vendedor dono do negocio.
--
-- RATIONALE:
--    Cliente validou que o valor correto e R$ 1.660.540 (13 pedidos) quando
--    filtramos apenas por pdo_dthaprovacao no periodo, SEM filtro de acao.
--
-- CTE ALTERADA: pedidos_periodo (filtro de acao removido)
-- CTE REMOVIDA: negocios_tocados
-- CTEs INALTERADAS: filtered, negocios_dedup, pedidos_dedup, funil_agg,
--   acao_side, neg_side, ranking, parados, parados_agg, meta_agg
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_funil_gestao(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
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
  WITH filtered AS MATERIALIZED (
    SELECT
      a.aco_vendedor,
      a.aco_tipocontato,
      a.ngo_nronegocio,
      a.cli_idcliente
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      -- fn_cli_cidade centraliza a resolucao de cidade do CLIENTE (DRY, ja
      -- usada por rpc_acoes_bi/detalhe/risco). Quando p_cidade IS NULL o
      -- planner elimina a clausula inteira — custo zero no caso comum.
      AND (p_cidade IS NULL
           OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
  ),
  -- crm_negocios esta no grao negocio x produto: SEM este DISTINCT ON o mesmo
  -- negocio conta N vezes. MATERIALIZED de proposito — e reusado por neg_side
  -- para atribuicao hibrida (ganhos por ngo_vendedores).
  negocios_dedup AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vendedores,
      n.ngo_vlrtotalnegociado
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  -- ---------------------------------------------------------------------------
  -- CTE v2: pedidos_dedup
  -- Deduplicacao de pedidos por pdo_codigointerno. Segue o padrao de
  -- rpc_pedidos_bi (20260627_pedidos_por_data_ganho.sql) e rpc_acoes_bi v5.
  -- Ordena por pdo_dthaprovacao DESC para manter a versao mais recente do
  -- pedido quando ha duplicatas (mesmo codigo, datas diferentes).
  -- ---------------------------------------------------------------------------
  pedidos_dedup AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_dthaprovacao,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  -- ---------------------------------------------------------------------------
  -- CTE ALTERADA v4: pedidos_periodo
  --
  -- PEDIDOS APROVADOS NO PERIODO — SEM FILTRO DE ACAO, SEM FILTRO DE FUNIL.
  --
  -- v3 (INCORRETO): filtrava por EXISTS com acoes/negocios_tocados, o que
  -- trazia pedidos APROVADOS em qualquer data desde que o negocio tivesse
  -- acao no periodo.
  --
  -- v4 (CORRIGIDO): filtra apenas por pdo_dthaprovacao::date no periodo.
  -- SEM JOIN, SEM EXISTS com crm_acoes ou crm_negocios.
  --
  -- Validacao: cliente confirmou 13 pedidos / R$ 1.660.540 entre 01/07 e
  -- 23/07/2026 com este filtro.
  -- ---------------------------------------------------------------------------
  pedidos_periodo AS MATERIALIZED (
    SELECT pd.*
    FROM pedidos_dedup pd
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
  ),
  -- ---------------------------------------------------------------------------
  -- CTE REESCRITA v2: funil_agg
  -- visitas + oportunidades mantidas da v1 (vindas de acao/negocio).
  -- GANHOS agora vem de pedidos_periodo (pedidos Aprovados no periodo).
  -- ---------------------------------------------------------------------------
  funil_agg AS (
    SELECT
      (SELECT COUNT(*) FROM filtered WHERE aco_tipocontato = 'Visita') AS visitas,
      -- oportunidades: COUNT(DISTINCT ngo_numero) de filtered
      -- (negocios tocados por acao no periodo, sem filtro de funil)
      (SELECT COUNT(DISTINCT ngo_nronegocio) FROM filtered
       WHERE ngo_nronegocio IS NOT NULL) AS oportunidades,
      (SELECT COUNT(*) FROM pedidos_periodo WHERE pdo_situacaopedido = 'Aprovado') AS ganhos
  ),
  -- ---------------------------------------------------------------------
  -- RANKING — lado ACAO (visitas, oportunidades) por aco_vendedor
  -- aco_vendedor e string VAZIA em 10.010 de 40.365 acoes (25%). Excluir aqui
  -- e obrigatorio: agrupar sem tratar cria uma linha fantasma "" no topo do
  -- ranking. O total excluido vai em meta.acoesSemConsultor.
  -- ---------------------------------------------------------------------
  acao_side AS (
    SELECT
      f.aco_vendedor AS consultor,
      COUNT(*) FILTER (WHERE f.aco_tipocontato = 'Visita') AS visitas,
      COUNT(DISTINCT f.ngo_nronegocio) FILTER (WHERE f.ngo_nronegocio IS NOT NULL) AS oportunidades
    FROM filtered f
    WHERE f.aco_vendedor IS NOT NULL AND f.aco_vendedor <> ''
    GROUP BY f.aco_vendedor
  ),
  -- ---------------------------------------------------------------------------
  -- CTE REESCRITA v4: neg_side (ranking — ganhos e valor)
  -- Atribuicao hibrida: GANHOS sao atribuidos por ngo_vendedores (dono do
  -- negocio), nao por pdo_vendedor do pedido. JOIN com negocios_dedup
  -- permanece para fazer essa atribuicao.
  --
  -- IMPORTANTE: neg_side filtra por pedidos_periodo que ja tem a data
  -- correta (pdo_dthaprovacao no periodo), entao nao ha mais expansao.
  -- ---------------------------------------------------------------------------
  neg_side AS (
    SELECT
      u.usr_nomeusuario AS consultor,
      COUNT(*) FILTER (WHERE pp.pdo_situacaopedido = 'Aprovado') AS ganhos,
      COALESCE(SUM(pp.pdo_vlrpedido) FILTER (WHERE pp.pdo_situacaopedido = 'Aprovado'), 0) AS valor_ganho
    FROM pedidos_periodo pp
    JOIN negocios_dedup nd ON nd.ngo_numero = pp.ngo_numero
    JOIN mirror.usuarios u ON u.usr_codusuario = nd.ngo_vendedores
    WHERE nd.ngo_vendedores IS NOT NULL AND nd.ngo_vendedores <> ''
      AND u.usr_nomeusuario IS NOT NULL AND u.usr_nomeusuario <> ''
    GROUP BY u.usr_nomeusuario
  ),
  -- FULL OUTER: um consultor pode ter ganho atribuido sem ter acao no periodo
  -- (e vice-versa). INNER JOIN aqui perderia linhas em silencio.
  ranking AS (
    SELECT
      COALESCE(a.consultor, n.consultor) AS consultor,
      COALESCE(a.visitas, 0) AS visitas,
      COALESCE(a.oportunidades, 0) AS oportunidades,
      COALESCE(n.ganhos, 0) AS ganhos,
      COALESCE(n.valor_ganho, 0) AS valor_ganho,
      -- NULL (nao 0) quando nao ha denominador — o front exibe "—"
      ROUND(COALESCE(n.ganhos, 0)::numeric * 100
            / NULLIF(COALESCE(a.oportunidades, 0), 0), 1) AS taxa_conversao
    FROM acao_side a
    FULL OUTER JOIN neg_side n ON n.consultor = a.consultor
    WHERE (p_vendedor IS NULL OR COALESCE(a.consultor, n.consultor) = p_vendedor)
  ),
  -- ---------------------------------------------------------------------
  -- diasParados (E6) — MEDIANA, nao media: a distribuicao tem cauda longa
  -- (medido ano corrente: mediana 81 dias, media 85). O unico indicador da
  -- tela que aponta receita JA levantada e parada.
  -- Escopo: negocios COMERCIAIS 'Em Andamento' tocados no periodo filtrado.
  -- SEMANTICA NAO MUDA: depende de negocio + acao, nao de pedido.
  -- Esta CTE NAO e afetada pela remocao do filtro de acao de pedidos_periodo.
  -- ---------------------------------------------------------------------
  parados AS (
    SELECT t.ngo_numero, MAX(a.aco_dthconclusao::date) AS ultima_acao
    FROM (
      -- negocios comerciais em andamento, tocados por acao no periodo
      SELECT DISTINCT ON (n.ngo_numero)
        n.ngo_numero,
        n.ngo_conclusao,
        n.ngo_funil
      FROM mirror.crm_negocios n
      JOIN filtered f ON f.ngo_nronegocio = n.ngo_numero
      WHERE n.ngo_numero IS NOT NULL
        AND n.ngo_funil = ANY (ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MÁQUINA'])
        AND n.ngo_conclusao = 'Em Andamento'
      ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
    ) t
    JOIN mirror.crm_acoes a ON a.ngo_nronegocio = t.ngo_numero
    WHERE a.aco_dthconclusao IS NOT NULL
    GROUP BY t.ngo_numero
  ),
  parados_agg AS (
    SELECT
      COUNT(*) AS negocios_abertos,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (CURRENT_DATE - ultima_acao))::int AS mediana,
      AVG(CURRENT_DATE - ultima_acao)::int AS media
    FROM parados
  ),
  -- ---------------------------------------------------------------------------
  -- CTE ATUALIZADA v4: meta_agg
  -- acoes_sem_consultor: inalterado (vindo de acao).
  -- ganhos_sem_atribuicao: pedidos aprovados sem ngo_vendedores.
  -- ---------------------------------------------------------------------------
  meta_agg AS (
    SELECT
      (SELECT COUNT(*) FROM filtered
         WHERE aco_vendedor IS NULL OR aco_vendedor = '') AS acoes_sem_consultor,
      (SELECT COUNT(*) FROM pedidos_periodo pp
         WHERE pp.pdo_situacaopedido = 'Aprovado'
           AND NOT EXISTS (
             SELECT 1 FROM mirror.crm_negocios n
             JOIN mirror.usuarios u ON u.usr_codusuario = n.ngo_vendedores
             WHERE n.ngo_numero = pp.ngo_numero
               AND n.ngo_vendedores IS NOT NULL AND n.ngo_vendedores <> ''
               AND u.usr_nomeusuario IS NOT NULL AND u.usr_nomeusuario <> ''
           )) AS ganhos_sem_atribuicao,
      (SELECT COALESCE(SUM(ganhos), 0) FROM ranking) AS soma_ganhos_ranking
  )
  SELECT json_build_object(
    'funil', json_build_object(
      'visitas',       (SELECT visitas FROM funil_agg),
      'oportunidades', (SELECT oportunidades FROM funil_agg),
      'ganhos',        (SELECT ganhos FROM funil_agg),
      'visitasPorOportunidade',
        (SELECT ROUND(visitas::numeric / NULLIF(oportunidades, 0), 2) FROM funil_agg),
      'oportPorFechamento',
        (SELECT ROUND(oportunidades::numeric / NULLIF(ganhos, 0), 2) FROM funil_agg)
    ),
    'rankingConsultores', COALESCE((
      SELECT json_agg(row_to_json(sub) ORDER BY sub."visitas" DESC, sub."consultor")
      FROM (
        SELECT
          consultor,
          visitas,
          oportunidades,
          ganhos,
          valor_ganho    AS "valorGanho",
          taxa_conversao AS "taxaConversao"
        FROM ranking
      ) sub
    ), '[]'::json),
    'diasParados', json_build_object(
      'mediana',         (SELECT mediana FROM parados_agg),
      'media',           (SELECT media FROM parados_agg),
      'negociosAbertos', (SELECT negocios_abertos FROM parados_agg)
    ),
    'meta', json_build_object(
      'acoesSemConsultor',   (SELECT acoes_sem_consultor FROM meta_agg),
      'ganhosSemAtribuicao', (SELECT ganhos_sem_atribuicao FROM meta_agg),
      'somaGanhosRanking',   (SELECT soma_ganhos_ranking FROM meta_agg)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text) IS
  'Agregados de gestao comercial /bi/acoes v4: funil visita->oportunidade->ganho (GANHOS de TODOS os pedidos aprovados no periodo, SEM filtro de acao), rankingConsultores (atribuicao HIBRIDA: ganhos/valor por ngo_vendedores) e diasParados (MEDIANA). Validado com cliente: R$ 1.660.540 ate 23/07/2026 (13 pedidos).';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text)
  TO anon, authenticated, service_role;
