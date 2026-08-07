-------------------------------------------------------------------------------
-- rpc_acoes_funil_gestao v5  (supersede 20260731_rpc_acoes_funil_gestao_v4_pedidos_only.sql)
--
-- MUDANCAS EM RELACAO A v4
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
-- 2) CTE `parados` MANTEM c_funis_comerciais (semantica separada)
--    diasParados mede dias sem acao em negocio Em Andamento COMERCIAL.
--    Semantica nao muda — REPASSE DE MAQUINA pode continuar contando
--    como oportunidade em andamento, mas nao conta como "ganho".
--
-- 3) CTE `funil_agg.ganhos` agora conta pedidos_periodo (ja filtrados para
--    Aprovado + Ganho + !REPASSE).
--
-- RATIONALE:
--    Cliente validou que quer EXCLUIR REPASSE DE MAQUINA do "ganhou"
--    (semantica: REPASSE = revenda de usados, nao venda nova).
--    Validacao contra planilha: 13 pedidos / R$ 1.660.540 ate 23/07.
--    Hoje (31/07) retorna 15 (2 foram aprovados apos o print do cliente).
--
-- CTE ALTERADA: pedidos_periodo (JOIN crm_negocios + filtro REPASSE)
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
      AND (p_cidade IS NULL
           OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
  ),
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
  -- CTE v5: pedidos_periodo — FILTRO DEFINITIVO DO CLIENTE
  -- pedido Aprovado + negocio Ganho + funil != REPASSE DE MAQUINA
  -- Validado contra planilha: 13 pedidos / R$ 1.660.540 ate 23/07/2026
  -- ---------------------------------------------------------------------------
  pedidos_periodo AS MATERIALIZED (
    SELECT pd.*
    FROM pedidos_dedup pd
    JOIN mirror.crm_negocios nd ON nd.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND pd.pdo_situacaopedido = 'Aprovado'
      AND nd.ngo_conclusao = 'Ganho'
      AND nd.ngo_funil != 'REPASSE DE MAQUINA'
  ),
  funil_agg AS (
    SELECT
      (SELECT COUNT(*) FROM filtered WHERE aco_tipocontato = 'Visita') AS visitas,
      (SELECT COUNT(DISTINCT ngo_nronegocio) FROM filtered
       WHERE ngo_nronegocio IS NOT NULL) AS oportunidades,
      (SELECT COUNT(*) FROM pedidos_periodo) AS ganhos
  ),
  acao_side AS (
    SELECT
      f.aco_vendedor AS consultor,
      COUNT(*) FILTER (WHERE f.aco_tipocontato = 'Visita') AS visitas,
      COUNT(DISTINCT f.ngo_nronegocio) FILTER (WHERE f.ngo_nronegocio IS NOT NULL) AS oportunidades
    FROM filtered f
    WHERE f.aco_vendedor IS NOT NULL AND f.aco_vendedor <> ''
    GROUP BY f.aco_vendedor
  ),
  neg_side AS (
    SELECT
      u.usr_nomeusuario AS consultor,
      COUNT(*) AS ganhos,
      COALESCE(SUM(pp.pdo_vlrpedido), 0) AS valor_ganho
    FROM pedidos_periodo pp
    JOIN negocios_dedup nd ON nd.ngo_numero = pp.ngo_numero
    JOIN mirror.usuarios u ON u.usr_codusuario = nd.ngo_vendedores
    WHERE nd.ngo_vendedores IS NOT NULL AND nd.ngo_vendedores <> ''
      AND u.usr_nomeusuario IS NOT NULL AND u.usr_nomeusuario <> ''
    GROUP BY u.usr_nomeusuario
  ),
  ranking AS (
    SELECT
      COALESCE(a.consultor, n.consultor) AS consultor,
      COALESCE(a.visitas, 0) AS visitas,
      COALESCE(a.oportunidades, 0) AS oportunidades,
      COALESCE(n.ganhos, 0) AS ganhos,
      COALESCE(n.valor_ganho, 0) AS valor_ganho,
      ROUND(COALESCE(n.ganhos, 0)::numeric * 100
            / NULLIF(COALESCE(a.oportunidades, 0), 0), 1) AS taxa_conversao
    FROM acao_side a
    FULL OUTER JOIN neg_side n ON n.consultor = a.consultor
    WHERE (p_vendedor IS NULL OR COALESCE(a.consultor, n.consultor) = p_vendedor)
  ),
  parados AS (
    SELECT t.ngo_numero, MAX(a.aco_dthconclusao::date) AS ultima_acao
    FROM (
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
  meta_agg AS (
    SELECT
      (SELECT COUNT(*) FROM filtered
         WHERE aco_vendedor IS NULL OR aco_vendedor = '') AS acoes_sem_consultor,
      (SELECT COUNT(*) FROM pedidos_periodo pp
         WHERE NOT EXISTS (
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
  'Agregados de gestao comercial /bi/acoes v5: funil visita->oportunidade->ganho (GANHOS de pedidos APROVADOS com negocio Ganho, EXCLUINDO REPASSE DE MAQUINA), rankingConsultores (atribuicao HIBRIDA: ganhos/valor por ngo_vendedores), diasParados (MEDIANA). Validado com cliente: R$ 1.660.540 ate 23/07/2026 (13 pedidos).';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text)
  TO anon, authenticated, service_role;