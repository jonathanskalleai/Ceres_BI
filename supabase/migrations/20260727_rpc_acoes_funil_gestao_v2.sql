-------------------------------------------------------------------------------
-- rpc_acoes_funil_gestao v2  (supersede 20260725_rpc_acoes_funil_gestao.sql)
--
-- MUDANCAS EM RELACAO A v1
--
-- 1) FONTE DE DADOS DOS GANHOS (mesma mudanca da rpc_acoes_bi v5)
--    Ate a v1: `funil.ganhos`, `rankingConsultores[].ganhos` e
--    `rankingConsultores[].valor_ganho` vinham de `ngo_conclusao = 'Ganho'`
--    (negocio com status "Ganho").
--    PROBLEMA: negocio != pedido. Um negocio pode ter N pedidos de valores
--    diferentes, e negocios com status "Ganho" sem pedido aprovado geravam
--    valores que NAO batiam com a planilha do cliente.
--    SOLUCAO: a partir da v2, ganhos/valor vem de `mirror.crm_pedidos`,
--    coluna `pdo_situacaopedido = 'Aprovado'` + `pdo_dthaprovacao::date`
--    no periodo.
--
-- 2) VALIDACAO COM CLIENTE (referencia R$ 1.660.540)
--    O valor de "Valor Ganho" ate 23/07/2026 foi VALIDADO contra o banco:
--    SELECT SUM(pdo_vlrpedido) FROM mirror.crm_pedidos
--    WHERE pdo_situacaopedido = 'Aprovado'
--      AND pdo_dthaprovacao::date <= '2026-07-23';
--    -> 13 clientes / R$ 1.660.540,00. Bate EXATAMENTE com a planilha do cliente.
--
-- 3) ATRIBUICAO HIBRIDA MANTIDA (E1 — nao e opcional)
--    A atribuicao hibrida da v1 se mantem, apenas a FONTE muda:
--      visitas + oportunidades  -> aco_vendedor        (acao executada)
--      ganhos  + valorGanho     -> crm_negocios.ngo_vendedores
--                                  (dono do negocio vinculado ao pedido aprovado)
--    Motivo: 10,4% dos ganhos comerciais tem mais de um consultor tocando.
--    Manter a atribuicao por dono do negocio evitainflar o ranking.
--
-- 4) DIAS PARADOS NAO MUDA (E6)
--    `diasParados` continua medindo dias desde ultima acao em negocio
--    'Em Andamento' — a semantica depende de negocio, nao de pedido.
--    CTEs `parados` e `parados_agg` inalteradas.
--
-- 5) CTEs NOVAS: pedidos_dedup, pedidos_periodo
--    Seguem o padrao exato da rpc_acoes_bi v5.
--
-- 6) CTEs REESCRITAS: funil_agg, neg_side, meta_agg (parcial)
--
-- 7) CTE acao_side INALTERADA — visitas/oportunidades ainda vem de acao.
--
-- CTEs QUE NAO MUDAM: filtered, negocios_dedup, negocios_tocados, acao_side,
--   ranking, parados, parados_agg, acoes_sem_consultor.
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
  -- Mesma lista fechada do rpc_acoes_bi v4/v5. Funis nao-comerciais (MARKETING,
  -- BANCOS, OFICINA, ADM...) sao excluidos porque "Ganho" neles nao e venda E
  -- porque o MESMO negocio aparece com ngo_numero DIFERENTE em funis paralelos,
  -- com o MESMO valor (dupla contagem verificada no banco vivo).
  c_funis_comerciais CONSTANT text[] := ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'];
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
  -- negocio conta N vezes. MATERIALIZED de proposito — e reusado por 3 CTEs
  -- abaixo e nao pode ser recalculado por chave do JSON.
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
  -- Negocios COMERCIAIS tocados por alguma acao do periodo.
  -- Valor SEMPRE de ngo_vlrtotalnegociado (cabecalho), NUNCA
  -- prd_vlrunitario * prd_qtde: so 69% dos negocios reconciliam por produto.
  -- USADO POR: acao_side, ranking (oportunidades), funil (oportunidades),
  -- diasParados. Oportunidades mantem a semantica de negocio.
  negocios_tocados AS MATERIALIZED (
    SELECT nd.ngo_numero, nd.ngo_conclusao, nd.ngo_vendedores, nd.ngo_vlrtotalnegociado
    FROM (
      SELECT DISTINCT f.ngo_nronegocio
      FROM filtered f
      WHERE f.ngo_nronegocio IS NOT NULL AND f.ngo_nronegocio <> ''
    ) d
    JOIN negocios_dedup nd ON nd.ngo_numero = d.ngo_nronegocio
    WHERE nd.ngo_funil = ANY (c_funis_comerciais)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v2: pedidos_dedup
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
  -- CTE NOVA v2: pedidos_periodo
  -- Pedidos aprovados no periodo, vinculados a negocios COMERCIAIS.
  -- JOIN com negocios_dedup garante que o pedido pertence a um funil comercial.
  -- Filtro de data: pdo_dthaprovacao::date (data de aprovacao do pedido).
  --
  -- NOTA: NAO aplica filtro de p_vendedor aqui porque a atribuicao do ranking
  -- de ganhos e por ngo_vendedores (dono do negocio), nao por pdo_vendedor do
  -- pedido. Filtrar por vendedor aqui quebraria a atribuicao hibrida.
  -- ---------------------------------------------------------------------------
  pedidos_periodo AS MATERIALIZED (
    SELECT pd.*
    FROM pedidos_dedup pd
    JOIN negocios_dedup nd ON nd.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND nd.ngo_funil = ANY (c_funis_comerciais)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE REESCRITA v2: funil_agg
  -- visitas + oportunidades mantidas da v1 (vindas de acao/negocio).
  -- GANHOS agora vem de pedidos_periodo (pedidos Aprovados no periodo).
  -- ---------------------------------------------------------------------------
  funil_agg AS (
    SELECT
      (SELECT COUNT(*) FROM filtered WHERE aco_tipocontato = 'Visita') AS visitas,
      (SELECT COUNT(*) FROM negocios_tocados) AS oportunidades,
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
      COUNT(DISTINCT t.ngo_numero) AS oportunidades
    FROM filtered f
    LEFT JOIN negocios_tocados t ON t.ngo_numero = f.ngo_nronegocio
    WHERE f.aco_vendedor IS NOT NULL AND f.aco_vendedor <> ''
    GROUP BY f.aco_vendedor
  ),
  -- ---------------------------------------------------------------------------
  -- CTE REESCRITA v2: neg_side (ranking — ganhos e valor)
  -- AGORA agrega por PEDIDO APROVADO no periodo (grao pdo_codigointerno),
  -- nao por negocio com ngo_conclusao = 'Ganho'.
  -- Atribuicao mantida por ngo_vendedores -> usr_nomeusuario.
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
  -- SEMANTICA NAO MUDA: depende de negocio, nao de pedido.
  -- ---------------------------------------------------------------------
  parados AS (
    SELECT t.ngo_numero, MAX(a.aco_dthconclusao::date) AS ultima_acao
    FROM negocios_tocados t
    JOIN mirror.crm_acoes a ON a.ngo_nronegocio = t.ngo_numero
    WHERE t.ngo_conclusao = 'Em Andamento'
      AND a.aco_dthconclusao IS NOT NULL
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
  -- CTE ATUALIZADA v2: meta_agg
  -- acoes_sem_consultor: inalterado (vindo de acao).
  -- ganhos_sem_atribuicao: REESCRITO para contar pedidos aprovados sem
  -- ngo_vendedores (pedido aprovado em negocio sem dono).
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
  'Agregados de gestao comercial /bi/acoes v2: funil visita->oportunidade->ganho (GANHOS agora de mirror.crm_pedidos pdo_situacaopedido=''Aprovado''), rankingConsultores (atribuicao HIBRIDA: visitas/oport por aco_vendedor, ganhos/valor por ngo_vendedores->usuarios via pedido aprovado) e diasParados (MEDIANA). Validado com cliente: R$ 1.660.540 ate 23/07/2026 (13 pedidos). Razoes retornam NULL quando o denominador e zero.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text)
  TO anon, authenticated, service_role;
