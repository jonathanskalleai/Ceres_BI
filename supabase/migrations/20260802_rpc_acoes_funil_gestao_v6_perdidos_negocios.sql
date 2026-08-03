-------------------------------------------------------------------------------
-- rpc_acoes_funil_gestao v6
--   (supersede 20260731_rpc_acoes_funil_gestao_v5_pedidos_repassse.sql)
--
-- PROPOSITO
--   Mesmo contrato de tres fontes da rpc_acoes_bi v9, aplicado ao funil e ao
--   ranking de consultores:
--
--     Indicador      | Fonte                | Data de competencia  | Unidade
--     ---------------|----------------------|----------------------|------------------------
--     Oportunidades  | mirror.crm_acoes     | aco_dthconclusao     | negocio distinto
--     Ganhos         | mirror.crm_pedidos   | pdo_dthaprovacao     | pedido / pdo_vlrpedido
--     Perdidos       | mirror.crm_negocios  | ngo_datafechamento   | negocio / ngo_vlrtotalnegociado
--
--   Ganhos e Perdidos sao desfechos PARALELOS, NAO degraus consecutivos do
--   funil. Nao existe razao ganho/(ganho+perdido) aqui, e Perdidos NAO e um
--   quarto degrau abaixo de Ganhos: as reguas de valor sao diferentes
--   (R$ de pedido vs R$ negociado).
--
-- MUDANCAS EM RELACAO A v5
--
-- 1) negocios_dedup (DISTINCT ON ... ORDER BY ngo_datacadastro DESC) e
--    SUBSTITUIDA por negocios_canonicos:
--      DISTINCT ON (ngo_numero)
--      ORDER BY ngo_numero, ngo_dataatualizacao DESC NULLS LAST,
--               dthregistro DESC NULLS LAST
--    Uma unica regra canonica na funcao inteira. ngo_dataatualizacao e usada
--    SO como ordenacao tecnica para escolher a versao vigente do registro;
--    nenhuma clausula de periodo usa ngo_dataatualizacao nem ngo_datacadastro
--    (ngo_datacadastro deixou de ser referenciada nesta funcao).
--
-- 2) pedidos_periodo passa a fazer JOIN com negocios_canonicos. O join CRU com
--    mirror.crm_negocios da v5 produzia fan-out de LINHA DE PRODUTO. Medido no
--    banco vivo 2026-08-02T23:00Z, janela 2026:
--      join cru (v5):  125 linhas / 121 pedidos -> R$ 16.689.847,18
--      join canonico:  121 linhas / 121 pedidos -> R$ 15.130.847,18
--    Julho/2026 inalterado (26 ganhos, fan-out zero no mes).
--
-- 3) oportunidades viram OPORTUNIDADE LIQUIDA: negocio canonico tocado por acao
--    na janela, SEM 'REPASSE DE MAQUINA' e com ngo_conclusao='Em Andamento'.
--    Campo novo valorOportunidades = SUM(ngo_vlrtotalnegociado) do MESMO conjunto.
--    MUDANCA CONSCIENTE DE INDICADOR (julho/2026):
--      193 (v5)  ->  167 (so exclusao de REPASSE)  ->  112 (liquida)
--      valor:                R$ 20.099.809,30      ->  R$ 13.264.057,00
--    Metrica de ESTADO: mes fechado muda quando um negocio dele for concluido
--    depois. A UI precisa dizer isso; nao e instabilidade de carga.
--    Visitas NAO entram nesse recorte (item 4 abaixo).
--
-- 4) VISITAS NAO FILTRAM REPASSE (correcao do usuario, 2026-08-02). O recorte
--    de REPASSE DE MAQUINA vale para oportunidade, ganho e perdido — nunca para
--    a contagem de visitas. julho/2026 continua 546.
--
-- 5) CTE NOVA negocios_perdidos_periodo -> funil.perdidos e funil.valorPerdido.
--    Fonte NEGOCIO, data ngo_datafechamento, valor ngo_vlrtotalnegociado, sem
--    REPASSE. Nenhum pedido (nem Cancelado) alimenta Perdidos.
--
-- 6) FILTROS (fim do desfecho global)
--    p_vendedor -> ganhos e perdidos por DONO DO NEGOCIO
--                  (ngo_vendedores -> usuarios.usr_codusuario -> usr_nomeusuario).
--                  Na v5, p_vendedor nao filtrava pedidos_periodo: o card de
--                  ganho mostrava o TOTAL GLOBAL mesmo com consultor escolhido.
--    p_cidade   -> ganhos e perdidos por mirror.fn_cli_cidade(cli_idcliente).
--    Visitas/oportunidades continuam por aco_vendedor e pela cidade da acao
--    (quem EXECUTOU). A atribuicao segue HIBRIDA por design — sob filtro de
--    consultor o resultado NAO e conversao de coorte.
--
-- 7) meta.perdidosSemAtribuicao (NOVO) — espelho de ganhosSemAtribuicao.
--    Perdido cujo ngo_vendedores nao mapeia em usuarios nao aparece em nenhuma
--    linha de ranking. Sem esse campo o registro some em silencio quando o
--    usuario filtra por consultor. Medido 2026-08-02: 1 de 117 no ano de 2026;
--    0 de 313 em 2025; 0 de 7 em julho/2026.
--
-- 8) parados/diasParados: INALTERADA em relacao a v5, de proposito. Ver o bloco
--    de comentario na propria CTE: ngo_datacadastro ali e ordenacao de dedup e
--    NAO clausula de periodo; rebasear mudaria um indicador fora do escopo.
--
-- CTEs NOVAS:     negocios_base, negocios_canonicos, oportunidades_negocios,
--                 oportunidades_por_consultor, negocios_perdidos_periodo
-- CTE REMOVIDA:   negocios_dedup (substituida por negocios_canonicos)
-- CTEs ALTERADAS: pedidos_periodo, funil_agg, acao_side, neg_side, meta_agg
-- CTEs INALTERADAS: filtered, pedidos_dedup, ranking, parados, parados_agg
--
-- FOTOGRAFIA DE VALIDACAO (dado vivo, 2026-08-02T23:00Z — NAO virar fixture)
--   julho/2026: 112 oportunidades liquidas / R$ 13.264.057,00 (era 193 na v5),
--               546 visitas, 26 ganhos / R$ 2.753.425,30,
--               7 perdidos / R$ 1.060.000,00 (VENDAS 5 + ADM 2),
--               diasParados.negociosAbertos 112 (inalterado vs v5)
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
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v6: negocios_base — 1 linha por ngo_numero (substitui negocios_dedup).
  -- ngo_dataatualizacao aqui e ORDENACAO TECNICA, NUNCA janela de indicador.
  -- crm_negocios e denormalizada por linha de produto; o ngo_vlrtotalnegociado
  -- e o total do NEGOCIO repetido nas linhas, entao canonizar nao subconta
  -- negocio multi-produto.
  -- ---------------------------------------------------------------------------
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_datafechamento,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores,
      n.cli_idcliente
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v6: negocios_canonicos — base + atribuicao resolvida.
  -- usr_codusuario nao tem duplicata nao-nula (verificado 2026-08-02: 64
  -- codigos distintos, 0 duplicados) — o LEFT JOIN nao refaz fan-out.
  -- ---------------------------------------------------------------------------
  negocios_canonicos AS MATERIALIZED (
    SELECT
      b.ngo_numero,
      b.ngo_conclusao,
      b.ngo_funil,
      b.ngo_datafechamento,
      b.ngo_vlrtotalnegociado,
      b.cli_idcliente,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
    FROM negocios_base b
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
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
  -- CTE ALTERADA v6: pedidos_periodo — GANHOS.
  -- Regra de ganho inalterada; join canonico (cada venda conta uma vez) e
  -- p_vendedor/p_cidade passam a olhar o NEGOCIO.
  -- ---------------------------------------------------------------------------
  pedidos_periodo AS MATERIALIZED (
    SELECT
      pd.pdo_codigointerno,
      pd.pdo_vlrpedido,
      pd.ngo_numero,
      nc.consultor_negocio
    FROM pedidos_dedup pd
    JOIN negocios_canonicos nc ON nc.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND pd.pdo_situacaopedido = 'Aprovado'
      AND nc.ngo_conclusao = 'Ganho'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v6: negocios_perdidos_periodo — PERDIDOS.
  -- ---------------------------------------------------------------------------
  negocios_perdidos_periodo AS MATERIALIZED (
    SELECT
      nc.ngo_numero,
      nc.ngo_vlrtotalnegociado,
      nc.consultor_negocio
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao = 'Perdido'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v6: oportunidades_negocios — OPORTUNIDADE LIQUIDA.
  -- Negocio DISTINTO tocado por acao concluida na janela, canonico, sem REPASSE
  -- e AINDA EM ANDAMENTO. O ngo_conclusao='Em Andamento' e o desconto do que ja
  -- nao esta mais aberto: sem ele, um negocio ganho ou perdido continuava
  -- contando como oportunidade viva.
  --   julho/2026: 193 (v5) -> 167 (so REPASSE) -> 112 (liquida)
  --   valorOportunidades julho/2026: R$ 20.099.809,30 -> R$ 13.264.057,00
  --
  -- LEITURA DESCARTADA (nao reintroduzir): "descontar so o desfecho ocorrido
  -- DENTRO da janela" daria 133 / R$ 16.105.384,00 e contaria como aberta 21
  -- negocios ja concluidos ANTES de julho. O estado e do negocio hoje, nao do
  -- que aconteceu na janela.
  --
  -- CONSEQUENCIA A COMUNICAR NA UI: isto e metrica de ESTADO, logo e
  -- retroativamente instavel — um mes fechado MUDA quando um negocio daquele
  -- mes for concluido depois. Nao e bug; e a natureza do indicador.
  --
  -- DISTINCT sobre (ngo_numero, valor) e seguro para somar: negocios_canonicos
  -- ja tem 1 linha por ngo_numero, entao o valor e funcionalmente determinado
  -- pela chave e nao ha risco de somar o mesmo negocio duas vezes.
  -- ---------------------------------------------------------------------------
  oportunidades_negocios AS MATERIALIZED (
    SELECT DISTINCT nc.ngo_numero, nc.ngo_vlrtotalnegociado
    FROM filtered f
    JOIN negocios_canonicos nc ON nc.ngo_numero = f.ngo_nronegocio
    WHERE f.ngo_nronegocio IS NOT NULL
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.ngo_conclusao = 'Em Andamento'
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v6: oportunidades_por_consultor — o MESMO conjunto liquido, quebrado
  -- por quem executou a acao (aco_vendedor). Separada de proposito: um negocio
  -- tocado por 2 consultores rende 2 linhas aqui e UMA sozinha la em cima, entao
  -- somar a coluna do ranking NAO reproduz o card do funil.
  -- ---------------------------------------------------------------------------
  oportunidades_por_consultor AS MATERIALIZED (
    SELECT DISTINCT f.aco_vendedor, f.ngo_nronegocio
    FROM filtered f
    JOIN oportunidades_negocios o ON o.ngo_numero = f.ngo_nronegocio
    WHERE f.ngo_nronegocio IS NOT NULL
  ),
  funil_agg AS (
    SELECT
      -- Visitas NAO sofrem recorte de funil (correcao do usuario 2026-08-02):
      -- o recorte de REPASSE vale para oportunidade, ganho e perdido. Uma visita
      -- a um negocio de repasse foi uma visita de verdade. julho/2026 = 546.
      (SELECT COUNT(*) FROM filtered WHERE aco_tipocontato = 'Visita') AS visitas,
      (SELECT COUNT(*) FROM oportunidades_negocios) AS oportunidades,
      (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0)
         FROM oportunidades_negocios) AS valor_oportunidades,
      (SELECT COUNT(*) FROM pedidos_periodo) AS ganhos,
      (SELECT COUNT(*) FROM negocios_perdidos_periodo) AS perdidos,
      (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0)
         FROM negocios_perdidos_periodo) AS valor_perdido
  ),
  acao_side AS (
    SELECT
      f.aco_vendedor AS consultor,
      COUNT(*) FILTER (WHERE f.aco_tipocontato = 'Visita') AS visitas,
      (SELECT COUNT(DISTINCT o.ngo_nronegocio)
         FROM oportunidades_por_consultor o
        WHERE o.aco_vendedor = f.aco_vendedor) AS oportunidades
    FROM filtered f
    WHERE f.aco_vendedor IS NOT NULL AND f.aco_vendedor <> ''
    GROUP BY f.aco_vendedor
  ),
  neg_side AS (
    SELECT
      pp.consultor_negocio AS consultor,
      COUNT(*) AS ganhos,
      COALESCE(SUM(pp.pdo_vlrpedido), 0) AS valor_ganho
    FROM pedidos_periodo pp
    WHERE pp.consultor_negocio IS NOT NULL
    GROUP BY pp.consultor_negocio
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
  -- ---------------------------------------------------------------------------
  -- CTE INALTERADA v6: parados — IDENTICA a v5. NAO REBASEAR em
  -- negocios_canonicos. (Ja foi tentado nesta mesma entrega e revertido por
  -- decisao explicita do usuario em 2026-08-02.)
  --
  -- POR QUE O ngo_datacadastro FICA AQUI: ele e ORDENACAO DE DEDUP (qual linha
  -- do negocio sobrevive ao DISTINCT ON), NAO clausula de periodo. O criterio
  -- de aceite "nenhuma clausula de periodo usa ngo_datacadastro/
  -- ngo_dataatualizacao" continua valendo e continua respeitado: nenhum WHERE
  -- de janela usa esses campos em lugar nenhum desta funcao.
  --
  -- POR QUE NAO UNIFICAR AGORA: rebasear muda diasParados.negociosAbertos
  -- (medido: 531 -> 530 em 2026, 112 -> 111 em julho/2026). diasParados esta
  -- FORA do objetivo desta entrega — mexer nele aqui seria alterar um indicador
  -- de graca, no meio de uma mudanca que ja move oportunidade, ganho e perdido.
  -- Unificar as duas regras de dedup e demanda propria, com validacao propria.
  --
  -- Idem para 'REPASSE DE MÁQUINA' com acento no ARRAY abaixo: a base grava sem
  -- acento, entao esse elemento nunca casa. E bug real, é independente, e muda
  -- "Dias Parados" — migration propria, nao carona nesta.
  -- ---------------------------------------------------------------------------
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
      (SELECT COUNT(*) FROM pedidos_periodo
         WHERE consultor_negocio IS NULL) AS ganhos_sem_atribuicao,
      (SELECT COUNT(*) FROM negocios_perdidos_periodo
         WHERE consultor_negocio IS NULL) AS perdidos_sem_atribuicao,
      (SELECT COALESCE(SUM(ganhos), 0) FROM ranking) AS soma_ganhos_ranking
  )
  SELECT json_build_object(
    'funil', json_build_object(
      'visitas',            (SELECT visitas FROM funil_agg),
      'oportunidades',      (SELECT oportunidades FROM funil_agg),
      'valorOportunidades', (SELECT valor_oportunidades FROM funil_agg),
      'ganhos',             (SELECT ganhos FROM funil_agg),
      'perdidos',           (SELECT perdidos FROM funil_agg),
      'valorPerdido',       (SELECT valor_perdido FROM funil_agg),
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
      'acoesSemConsultor',     (SELECT acoes_sem_consultor FROM meta_agg),
      'ganhosSemAtribuicao',   (SELECT ganhos_sem_atribuicao FROM meta_agg),
      'perdidosSemAtribuicao', (SELECT perdidos_sem_atribuicao FROM meta_agg),
      'somaGanhosRanking',     (SELECT soma_ganhos_ranking FROM meta_agg)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text) IS
  'Agregados de gestao comercial /bi/acoes v6. Tres fontes separadas: OPORTUNIDADE LIQUIDA de crm_acoes (aco_dthconclusao, negocio canonico, sem REPASSE e ngo_conclusao=Em Andamento — julho/2026 caiu de 193 para 112 / R$ 13.264.057,00; e metrica de ESTADO, logo mes fechado muda quando o negocio for concluido depois), GANHOS de crm_pedidos Aprovado com negocio canonico Ganho (pdo_dthaprovacao), PERDIDOS de crm_negocios canonico (ngo_datafechamento, ngo_vlrtotalnegociado). Ganhos e Perdidos sao desfechos PARALELOS, nao degraus do funil — nao calcular razao entre eles. crm_negocios canonizado por DISTINCT ON (ngo_numero) ORDER BY ngo_dataatualizacao DESC, dthregistro DESC (elimina fan-out de linha de produto: 2026 caiu de 125 linhas/R$ 16.689.847,18 para 121 pedidos/R$ 15.130.847,18). p_vendedor/p_cidade passam a filtrar ganhos e perdidos pelo DONO do negocio e por fn_cli_cidade; visitas/oportunidades seguem aco_vendedor (atribuicao HIBRIDA por design). VISITAS nao sofrem recorte de REPASSE. Campos NOVOS: funil.valorOportunidades, funil.perdidos, funil.valorPerdido, meta.perdidosSemAtribuicao. CTE parados INALTERADA vs v5 (ngo_datacadastro ali e ordenacao de dedup, nao clausula de periodo — nao rebasear).';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text)
  TO anon, authenticated, service_role;
