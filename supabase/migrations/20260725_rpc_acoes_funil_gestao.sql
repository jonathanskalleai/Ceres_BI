-------------------------------------------------------------------------------
-- rpc_acoes_funil_gestao — agregados de gestao comercial da tela /bi/acoes.
--
-- Cobre os pedidos 1, 2, 7 e 8 do escopo de 9 indicadores:
--   funil               -> visitas -> oportunidades -> ganhos + as 2 razoes
--   rankingConsultores  -> 1 array com 4 criterios (ordenacao e CLIENT-SIDE)
--   diasParados         -> MEDIANA de dias sem acao em negocio 'Em Andamento'
--
-- Orcamento: <= 150ms. Payload alvo: < 2KB (cardinalidade LIMITADA — ~20
-- consultores). As listas de clientes (cardinalidade ILIMITADA: carteira tem
-- 8.731 clientes) ficam em rpc_acoes_gestao_listas, PAGINADAS. Acoplar
-- cardinalidade ilimitada a agregado foi a licao do rpc_acoes_bi v3.
--
-- ===========================================================================
-- SEMANTICA (confirmada com o usuario — NAO reinterpretar)
-- ===========================================================================
--
-- Visita       = crm_acoes.aco_tipocontato = 'Visita'.
--                NAO e aco_tipoacao (esse e o ASSUNTO: Prospeccao Maq,
--                Pos-Vendas...). Medido: 19.059 no total, 3.679 no ano corrente.
--
-- Oportunidade = negocio COMERCIAL DISTINTO tocado por >= 1 acao do periodo.
--                Mesma CTE dos 3 cards de valor do rpc_acoes_bi v4:
--                acao.ngo_nronegocio -> negocios_dedup -> funil comercial.
--
-- Fechamento   = desses, ngo_conclusao = 'Ganho' (status ATUAL).
--
-- POR QUE NAO ngo_datafechamento: medido no banco vivo — o funil VENDAS tem
-- 151 negocios 'Ganho' e ZERO com ngo_datafechamento no ano corrente (so
-- REPASSE DE MAQUINA preenche, 62/78). O campo e inutilizavel para "fechou no
-- periodo". Consequencia HONESTA e que precisa estar no card: um Ganho de 2024
-- tocado por uma acao em 2026 CONTA no periodo de 2026.
--
-- ===========================================================================
-- ATRIBUICAO HIBRIDA no ranking (E1 — medida, nao opcional)
-- ===========================================================================
--
--   visitas + oportunidades  -> aco_vendedor        (quem EXECUTOU a acao)
--   ganhos  + valorGanho     -> crm_negocios.ngo_vendedores
--                               -> mirror.usuarios.usr_codusuario
--                               -> usr_nomeusuario  (a quem o negocio PERTENCE)
--
-- Motivo medido no banco vivo (ano corrente): dos 48 ganhos comerciais tocados,
-- 5 (10,4%) foram tocados por MAIS DE UM consultor. Atribuir o ganho por acao
-- somaria 53 fechamentos contra os 48 do card — o ranking inflaria e a soma
-- deixaria de bater com o funil acima dele, na mesma tela.
--
-- ngo_vendedores e um codigo UNICO (medido: 0 registros com separador
-- , ; ou |), e casa 44/44 com usuarios.usr_codusuario.
--
-- CUSTO desta escolha, exposto em `meta` de proposito (falha por omissao e a
-- pior falha possivel em BI):
--   - ganhosSemAtribuicao: ganho comercial sem ngo_vendedores (medido: 1 de 48).
--     Ele CONTA no funil e NAO aparece em nenhuma linha do ranking.
--   - somaGanhosRanking != funil.ganhos e ESPERADO por isso. O front deve
--     mostrar a diferenca no rodape, nunca esconder.
--   - taxaConversao MISTURA as duas atribuicoes (ganhos do lado-negocio /
--     oportunidades do lado-acao). Serve para comparar consultores ENTRE SI;
--     nao e uma taxa auditavel em valor absoluto. Pode passar de 100% se um
--     consultor tem ganho atribuido em negocio que ele nao tocou no periodo.
--
-- ===========================================================================
-- LEITURA DAS RAZOES (legenda obrigatoria no card — E6)
-- ===========================================================================
-- oportPorFechamento (13,77 medido) NAO e taxa de conversao: e artefato de
-- JANELA. O ciclo de venda de maquina agricola e 6-18 meses, entao a
-- oportunidade aberta em 2026 ainda nao teve chance de fechar. So e comparavel
-- ENTRE consultores, nunca em valor absoluto.
--
-- Divisao por zero retorna NULL (nao 0, nao erro) — o front exibe "—".
-- Zero oportunidades e ausencia de dado, nao "razao igual a zero".
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
  -- Mesma lista fechada do rpc_acoes_bi v4. Funis nao-comerciais (MARKETING,
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
  funil_agg AS (
    SELECT
      (SELECT COUNT(*) FROM filtered WHERE aco_tipocontato = 'Visita') AS visitas,
      (SELECT COUNT(*) FROM negocios_tocados) AS oportunidades,
      (SELECT COUNT(*) FROM negocios_tocados WHERE ngo_conclusao = 'Ganho') AS ganhos
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
  -- RANKING — lado NEGOCIO (ganhos, valor) por ngo_vendedores -> usuarios
  neg_side AS (
    SELECT
      u.usr_nomeusuario AS consultor,
      COUNT(*) FILTER (WHERE t.ngo_conclusao = 'Ganho') AS ganhos,
      COALESCE(SUM(t.ngo_vlrtotalnegociado) FILTER (WHERE t.ngo_conclusao = 'Ganho'), 0) AS valor_ganho
    FROM negocios_tocados t
    JOIN mirror.usuarios u ON u.usr_codusuario = t.ngo_vendedores
    WHERE t.ngo_vendedores IS NOT NULL AND t.ngo_vendedores <> ''
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
  meta_agg AS (
    SELECT
      (SELECT COUNT(*) FROM filtered
         WHERE aco_vendedor IS NULL OR aco_vendedor = '') AS acoes_sem_consultor,
      (SELECT COUNT(*) FROM negocios_tocados t
         WHERE t.ngo_conclusao = 'Ganho'
           AND NOT EXISTS (
             SELECT 1 FROM mirror.usuarios u
             WHERE u.usr_codusuario = t.ngo_vendedores
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
  'Agregados de gestao comercial /bi/acoes: funil visita->oportunidade->ganho, rankingConsultores (atribuicao HIBRIDA: visitas/oport por aco_vendedor, ganhos/valor por ngo_vendedores->usuarios) e diasParados (MEDIANA). Razoes retornam NULL quando o denominador e zero. meta.ganhosSemAtribuicao explica por que somaGanhosRanking != funil.ganhos.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text)
  TO anon, authenticated, service_role;
