-- ============================================================
-- Migration: 20260820_rpc_negocios_bi_expandido.sql
-- Story: EPIC-NEGOCIOS-DASHBOARD-V2
-- Data: 2026-08-20
-- Demanda: RPC com 15 blocos nomeados para aba "Negocios & Funil"
-- Fonte: mirror.crm_negocios (view completa, 91 colunas)
-- ============================================================

-- PREFLIGHT: rollback definitions/ACLs previas para permitir re-run
SAVEPOINT migration_20260820_rpc_negocios_bi_expandido;

BEGIN;

-- ============================================================
-- RPC: rpc_negocios_bi_expandido
-- Retorna JSON com 15 blocos analiticos para dashboard expandido
-- Filtro temporal: ngo_data_fechamento (padrao do sistema)
-- Dedup: DISTINCT ON (ngo_numero) + ordenacao por atualizacao DESC
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_negocios_bi_expandido(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
SET statement_timeout = '60s'
AS $$
  -- ============================================================
  -- CTE BASE: negocios_canonicos
  -- 1 linha por ngo_numero (DISTINCT ON), join com consultor
  -- Usado por TODOS os 15 blocos
  -- ============================================================
  WITH negocios_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_etapa,
      n.ngo_vlrtotalnegociado AS valor,
      n.ngo_probabilidade,
      n.ngo_dataprevisao,
      n.ngo_motivoperda,
      n.ngo_motivoganho,
      n.ngo_formaentrada,
      n.ngo_vendedores,
      n.ngo_datacadastro,
      n.ngo_datafechamento,
      n.ngo_ciclovendas,
      n.cli_idcliente,
      n.cli_nome,
      n.cli_cidade,
      n.cli_uf,
      n.cli_tipocliente,
      n.prd_marcaproduto,
      n.prd_dscproduto,
      n.prd_grupoproduto,
      n.prd_condicaoproduto,
      n.orc_tipo,
      n.orc_banco,
      n.orc_valor,
      n.usa_valor,
      n.usa_estadodescricao,
      n.ngo_obsnegocio,
      NULLIF(BTRIM(u.usr_nomeusuario), '') AS consultor
    FROM mirror.crm_negocios n
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(BTRIM(n.ngo_vendedores), '')
    WHERE n.ngo_numero IS NOT NULL
      AND n.ngo_numero <> ''
    ORDER BY
      n.ngo_numero,
      n.ngo_dataatualizacao DESC NULLS LAST,
      n.dthregistro DESC NULLS LAST
  ),

  -- ============================================================
  -- CTE FILTRADA: negocios_ganhos (regra: ngo_conclusao = 'Ganho')
  -- Blocos 1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15
  -- ============================================================
  negocios_ganhos AS MATERIALIZED (
    SELECT nc.*
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao = 'Ganho'
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
  ),

  -- ============================================================
  -- CTE FILTRADA: negocios_fechados (Ganho OU Perdido)
  -- Blocos 2, 4, 9, 11, 12, 14, 15
  -- ============================================================
  negocios_fechados AS MATERIALIZED (
    SELECT nc.*
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao IN ('Ganho', 'Perdido')
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
  ),

  -- ============================================================
  -- BLOCO 1: faturamentoPorMarca
  -- TOP 12 marcas por valor ganho
  -- ============================================================
  bloco1_faturamento_por_marca AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(prd_marcaproduto), ''), 'Sem marca') AS marca,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(valor), 0)::numeric AS valor
      FROM negocios_ganhos
      GROUP BY 1
      ORDER BY valor DESC
      LIMIT 12
    ) sub
  ),

  -- ============================================================
  -- BLOCO 2: valorPorCondicaoPagamento
  -- Ticket medio + taxa conversao por orc_tipo
  -- ============================================================
  bloco2_valor_por_condicao_pagamento AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor_total DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(orc_tipo), ''), 'Nao informada') AS condicao,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(valor), 0)::numeric AS valor_total,
        CASE
          WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(valor), 0) / COUNT(*), 2)
          ELSE 0
        END::numeric AS ticket_medio,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE ngo_conclusao IN ('Ganho','Perdido')) > 0
            THEN COUNT(*)::numeric FILTER (WHERE ngo_conclusao = 'Ganho')
                 / COUNT(*) FILTER (WHERE ngo_conclusao IN ('Ganho','Perdido')) * 100
            ELSE 0
          END, 1
        ) AS taxa_conversao
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
    ) sub
  ),

  -- ============================================================
  -- BLOCO 3: heatmapEtapaIdade
  -- Carteira atual em andamento: ngo_etapa x faixas etarias
  -- SNAPSHOT: sem filtro de data, todos os Em Andamento
  -- ============================================================
  bloco3_heatmap_etapa_idade AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.etapa, sub.ordem_faixa), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(ngo_etapa), ''), 'Sem etapa') AS etapa,
        faixa_idade,
        CASE faixa_idade
          WHEN '0-30 dias'     THEN 1
          WHEN '31-60 dias'    THEN 2
          WHEN '61-90 dias'    THEN 3
          WHEN '91-180 dias'   THEN 4
          ELSE 5
        END AS ordem_faixa,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(valor), 0)::numeric AS valor
      FROM (
        SELECT
          ngo_etapa,
          CURRENT_DATE - ngo_datacadastro::date AS dias_desde_cadastro,
          CASE
            WHEN CURRENT_DATE - ngo_datacadastro::date <= 30  THEN '0-30 dias'
            WHEN CURRENT_DATE - ngo_datacadastro::date <= 60  THEN '31-60 dias'
            WHEN CURRENT_DATE - ngo_datacadastro::date <= 90  THEN '61-90 dias'
            WHEN CURRENT_DATE - ngo_datacadastro::date <= 180 THEN '91-180 dias'
            ELSE '180+ dias'
          END AS faixa_idade,
          valor
        FROM negocios_canonicos
        WHERE ngo_conclusao = 'Em Andamento'
          AND UPPER(BTRIM(COALESCE(ngo_funil, ''))) IN ('VENDAS', 'VENDAS AP')
          AND (p_vendedor IS NULL OR consultor = p_vendedor)
          AND (p_cidade IS NULL OR cli_cidade = p_cidade)
      ) sub
      GROUP BY 1, 2
    ) sub
  ),

  -- ============================================================
  -- BLOCO 4: taxaFechamentoPorMotivoGanho
  -- TOP 10 motivos de ganho
  -- ============================================================
  bloco4_taxa_fechamento_motivo_ganho AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor_ganho DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(ngo_motivoganho), ''), 'Nao informado') AS motivo,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') AS ganhos,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)::numeric AS valor_ganho,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN COUNT(*)::numeric FILTER (WHERE ngo_conclusao = 'Ganho') / COUNT(*) * 100
            ELSE 0
          END, 1
        ) AS taxa_conversao
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
      ORDER BY valor_ganho DESC
      LIMIT 10
    ) sub
  ),

  -- ============================================================
  -- BLOCO 5: rankingProdutosReceitaGanha
  -- TOP 10 prd_dsc_produto por valor ganho
  -- ============================================================
  bloco5_ranking_produtos_receita AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor_ganho DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(prd_dscproduto), ''), 'Nao informado') AS produto,
        COALESCE(NULLIF(BTRIM(prd_marcaproduto), ''), 'Sem marca') AS marca,
        COALESCE(NULLIF(BTRIM(prd_grupoproduto), ''), 'Sem grupo') AS grupo,
        COUNT(*)::int AS negocios,
        COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') AS ganhos,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)::numeric AS valor_ganho,
        COALESCE(SUM(valor), 0)::numeric AS valor_total
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1, 2, 3
      ORDER BY valor_ganho DESC
      LIMIT 10
    ) sub
  ),

  -- ============================================================
  -- BLOCO 6: distribuicaoPorGrupoProduto
  -- Tree-map data: prd_grupo_produto
  -- ============================================================
  bloco6_distribuicao_grupo_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor_total DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(prd_grupoproduto), ''), 'Sem grupo') AS grupo,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)::numeric AS valor_ganho,
        COALESCE(SUM(valor), 0)::numeric AS valor_total
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
      ORDER BY valor_total DESC
    ) sub
  ),

  -- ============================================================
  -- BLOCO 7: waterfallMensalGanhoPerdido
  -- 12 meses rolling: date_trunc('month', ngo_data_fechamento)
  -- ============================================================
  bloco7_waterfall_mensal AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.mes), '[]'::json) AS dados
    FROM (
      SELECT
        date_trunc('month', ngo_datafechamento)::date AS mes,
        TO_CHAR(date_trunc('month', ngo_datafechamento), 'YYYY-MM') AS name,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)::numeric AS ganho,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Perdido'), 0)::numeric AS perda,
        (COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)
         - COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Perdido'), 0))::numeric AS liquido
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date >= (CURRENT_DATE - INTERVAL '12 months')::date
        AND nc.ngo_datafechamento::date <= CURRENT_DATE
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
    ) sub
  ),

  -- ============================================================
  -- BLOCO 8: valorPorCidade
  -- TOP 30 cli_cidade por valor ganho
  -- ============================================================
  bloco8_valor_por_cidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor_ganho DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(cli_cidade), ''), 'Sem cidade') AS cidade,
        COALESCE(NULLIF(BTRIM(cli_uf), ''), '--') AS uf,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)::numeric AS valor_ganho
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1, 2
      ORDER BY valor_ganho DESC
      LIMIT 30
    ) sub
  ),

  -- ============================================================
  -- BLOCO 9: taxaPerdaPorBanco
  -- TOP 10 orc_banco com taxa de perda
  -- ============================================================
  bloco9_taxa_perda_banco AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.taxa_perda DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(orc_banco), ''), 'Sem banco') AS banco,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ngo_conclusao = 'Perdido') AS perdidos,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Perdido'), 0)::numeric AS valor_perdido,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN COUNT(*)::numeric FILTER (WHERE ngo_conclusao = 'Perdido') / COUNT(*) * 100
            ELSE 0
          END, 1
        ) AS taxa_perda
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
      ORDER BY taxa_perda DESC
      LIMIT 10
    ) sub
  ),

  -- ============================================================
  -- BLOCO 10: palavrasChaveObservacao
  -- TOP 20 termos de ngo_obs_negocio
  -- Regex: [A-Za-z]{4,} + stop-words PT-BR
  -- ============================================================
  bloco10_palavras_chave AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.freq DESC), '[]'::json) AS dados
    FROM (
      SELECT
        LOWER(w.word) AS termo,
        COUNT(*)::int AS freq,
        SUM(nc.valor)::numeric AS valor
      FROM negocios_canonicos nc,
        LATERAL unnest(
          REGEXP_MATCHES(
            COALESCE(nc.ngo_obsnegocio, ''),
            '[A-Za-zÀ-ÿ]{4,}', 'g'
          )
        ) AS w(word)
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND LENGTH(w.word) > 3
        -- Stop-words basicas em Portugues
        AND LOWER(w.word) NOT IN (
          'que', 'para', 'como', 'mais', 'esse', 'essa', 'este', 'esta',
          'porque', 'quando', 'onde', 'quem', 'qual', 'muito', 'vamos',
          'apos', 'ante', 'sobre', 'entre', 'forma', 'temos', 'sendo',
          'ainda', 'pode', 'podem', 'sao', 'tem', 'so', 'ja', 'so',
          'aqui', 'ali', 'onde', 'nada', 'tudo', 'cada', 'outro', 'outra',
          'outros', 'outras', 'mesmo', 'mesma', 'mesmos', 'mesmas',
          'valor', 'negocio', 'cliente', 'produto', 'venda', 'vendas',
          'nivel', 'sendo', 'tendo', 'fazendo', 'fez', 'fazer', 'feita',
          'feito', 'podendo', 'queria', 'gostaria', 'precisa', 'preciso',
          'todos', 'todas', 'alguns', 'algumas', 'dentre', 'atraves'
        )
      GROUP BY 1
      ORDER BY freq DESC
      LIMIT 20
    ) sub
  ),

  -- ============================================================
  -- BLOCO 11: ticketMedioPorFormaEntrada
  -- ngo_forma_entrada com ticket medio e taxa conversao
  -- ============================================================
  bloco11_ticket_medio_forma_entrada AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.ticket_medio DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(ngo_formaentrada), ''), 'Nao informada') AS forma,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)::numeric AS valor_ganho,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') > 0
            THEN COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)
                 / COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho')
            ELSE 0
          END, 2
        )::numeric AS ticket_medio,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE ngo_conclusao IN ('Ganho','Perdido')) > 0
            THEN COUNT(*)::numeric FILTER (WHERE ngo_conclusao = 'Ganho')
                 / COUNT(*) FILTER (WHERE ngo_conclusao IN ('Ganho','Perdido')) * 100
            ELSE 0
          END, 1
        ) AS taxa_conversao
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
    ) sub
  ),

  -- ============================================================
  -- BLOCO 12: cicloVendasPorEtapa
  -- AVG(ngo_ciclo_vendas) por ngo_etapa
  -- Separado em ganho / perdido / geral
  -- ============================================================
  bloco12_ciclo_vendas_etapa AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.ciclo_medio_geral DESC NULLS LAST), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(ngo_etapa), ''), 'Sem etapa') AS etapa,
        COUNT(*)::int AS negocios,
        ROUND(
          AVG(ngo_ciclovendas) FILTER (WHERE ngo_conclusao = 'Ganho'), 1
        ) AS ciclo_medio_ganhos,
        ROUND(
          AVG(ngo_ciclovendas), 1
        ) AS ciclo_medio_geral,
        ROUND(
          AVG(ngo_ciclovendas) FILTER (WHERE ngo_conclusao = 'Perdido'), 1
        ) AS ciclo_medio_perdas
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND ngo_ciclovendas IS NOT NULL
        AND ngo_ciclovendas > 0
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
    ) sub
  ),

  -- ============================================================
  -- BLOCO 13: usadoRecebidoPorMes
  -- usa_valor por mes (area temporal)
  -- ============================================================
  bloco13_usado_por_mes AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.mes), '[]'::json) AS dados
    FROM (
      SELECT
        date_trunc('month', ngo_datafechamento)::date AS mes,
        TO_CHAR(date_trunc('month', ngo_datafechamento), 'YYYY-MM') AS name,
        COUNT(*) FILTER (WHERE COALESCE(usa_valor, 0) > 0)::int AS negocios_com_usado,
        COALESCE(SUM(usa_valor) FILTER (
          WHERE ngo_conclusao = 'Ganho' AND COALESCE(usa_valor, 0) > 0
        ), 0)::numeric AS valor_usado_ganho,
        COALESCE(SUM(usa_valor), 0)::numeric AS valor_usado_total
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date >= (CURRENT_DATE - INTERVAL '12 months')::date
        AND nc.ngo_datafechamento::date <= CURRENT_DATE
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
    ) sub
  ),

  -- ============================================================
  -- BLOCO 14: volumePorTipoCliente
  -- cli_tipo_cliente (PF/PJ) com ticket medio ganho
  -- ============================================================
  bloco14_volume_tipo_cliente AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor_total DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(cli_tipocliente), ''), 'Nao classificado') AS tipo,
        COUNT(*)::int AS negocios,
        COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') AS ganhos,
        COALESCE(SUM(valor), 0)::numeric AS valor_total,
        COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)::numeric AS valor_ganho,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') > 0
            THEN COALESCE(SUM(valor) FILTER (WHERE ngo_conclusao = 'Ganho'), 0)
                 / COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho')
            ELSE 0
          END, 2
        )::numeric AS ticket_medio_ganho
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
    ) sub
  ),

  -- ============================================================
  -- BLOCO 15: probabilidadeVsResultado
  -- Scatter: ngo_probabilidade (1-5) vs taxa conversao real
  -- ============================================================
  bloco15_probabilidade_vs_resultado AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.estrelas), '[]'::json) AS dados
    FROM (
      SELECT
        GREATEST(COALESCE(NULLIF(BTRIM(ngo_probabilidade::text), '')::int, 0), 0) AS estrelas,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') AS ganhos,
        COUNT(*) FILTER (WHERE ngo_conclusao = 'Perdido') AS perdas,
        COALESCE(SUM(valor), 0)::numeric AS valor_total,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN COUNT(*)::numeric FILTER (WHERE ngo_conclusao = 'Ganho') / COUNT(*) * 100
            ELSE 0
          END, 1
        ) AS taxa_conversao_real
      FROM negocios_canonicos nc
      WHERE nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND ngo_probabilidade IS NOT NULL
        AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
        AND (p_cidade IS NULL OR nc.cli_cidade = p_cidade)
      GROUP BY 1
      ORDER BY 1
    ) sub
  )

  -- ============================================================
  -- JSON FINAL: 15 blocos nomeados + _meta
  -- ============================================================
  SELECT json_build_object(
    'faturamentoPorMarca',          (SELECT dados FROM bloco1_faturamento_por_marca),
    'valorPorCondicaoPagamento',    (SELECT dados FROM bloco2_valor_por_condicao_pagamento),
    'heatmapEtapaIdade',            (SELECT dados FROM bloco3_heatmap_etapa_idade),
    'taxaFechamentoPorMotivoGanho', (SELECT dados FROM bloco4_taxa_fechamento_motivo_ganho),
    'rankingProdutosReceitaGanha',  (SELECT dados FROM bloco5_ranking_produtos_receita),
    'distribuicaoPorGrupoProduto',  (SELECT dados FROM bloco6_distribuicao_grupo_produto),
    'waterfallMensalGanhoPerdido',  (SELECT dados FROM bloco7_waterfall_mensal),
    'valorPorCidade',               (SELECT dados FROM bloco8_valor_por_cidade),
    'taxaPerdaPorBanco',            (SELECT dados FROM bloco9_taxa_perda_banco),
    'palavrasChaveObservacao',      (SELECT dados FROM bloco10_palavras_chave),
    'ticketMedioPorFormaEntrada',   (SELECT dados FROM bloco11_ticket_medio_forma_entrada),
    'cicloVendasPorEtapa',          (SELECT dados FROM bloco12_ciclo_vendas_etapa),
    'usadoRecebidoPorMes',          (SELECT dados FROM bloco13_usado_por_mes),
    'volumePorTipoCliente',          (SELECT dados FROM bloco14_volume_tipo_cliente),
    'probabilidadeVsResultado',     (SELECT dados FROM bloco15_probabilidade_vs_resultado),
    '_meta', json_build_object(
      'generated_at', now(),
      'p_from', p_from,
      'p_to', p_to,
      'p_vendedor', p_vendedor,
      'p_cidade', p_cidade,
      'version', '1.0.0'
    )
  )
$$;

-- ============================================================
-- GRANT seguro: REVOKE + GRANT
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rpc_negocios_bi_expandido(date, date, text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_negocios_bi_expandido(date, date, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_negocios_bi_expandido(date, date, text, text) IS
  'Dashboard expandido de Negocios & Funil: 15 blocos analiticos. Fontes: mirror.crm_negocios com DISTINCT ON (ngo_numero). Filtro: ngo_datafechamento. Ganho: ngo_conclusao=Ganho. Cobertura: marcas, condicao pagamento, heatmap etapa/idade, motivos ganho, ranking produtos, grupos, waterfall mensal, cidades, bancos, palavras-chave, forma entrada, ciclo vendas, usado, tipo cliente, probabilidade vs resultado.';

COMMIT;

-- ============================================================
-- POSTFLIGHT: validações mecanicas
-- ============================================================
DO $$
DECLARE
  fn_name text := 'rpc_negocios_bi_expandido';
  row_count int;
BEGIN
  -- (a) Funcao existe
  SELECT count(*) INTO row_count
  FROM pg_proc
  WHERE proname = fn_name;
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % not found', fn_name;
  END IF;

  -- (b) Owner e postgres
  SELECT count(*) INTO row_count
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = fn_name
    AND r.rolname = 'postgres';
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % owner is not postgres', fn_name;
  END IF;

  -- (c) PUBLIC e anon SEM EXECUTE
  SELECT count(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('PUBLIC', 'anon')
    AND privilege_type = 'EXECUTE';
  IF row_count > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % still has EXECUTE for PUBLIC or anon', fn_name;
  END IF;

  -- (d) authenticated e service_role COM EXECUTE
  SELECT count(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('authenticated', 'service_role')
    AND privilege_type = 'EXECUTE';
  IF row_count < 2 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % missing EXECUTE for authenticated or service_role', fn_name;
  END IF;
END $$;

-- PostgREST reload (so depois do POSTFLIGHT passar)
NOTIFY pgrst, 'reload schema';

-- Release PREFLIGHT em sucesso
ROLLBACK TO SAVEPOINT migration_20260820_rpc_negocios_bi_expandido;
RELEASE SAVEPOINT migration_20260820_rpc_negocios_bi_expandido;

-- VALIDAÇÃO: rodar EXPLAIN ANALYZE em producao antes de declarar done.
-- Se algum bloco > 5s, reescrever com indices apropriados.
