-------------------------------------------------------------------------------
-- rpc_acoes_bi v5  (supersede 20260724_rpc_acoes_bi_v4.sql)
--
-- MUDANCAS EM RELACAO A v4
--
-- 1) FONTES DE DADOS DOS 3 CARDS DE VALOR
--    Ate a v4: `valorAberto/valorGanho/valorPerdido` vinham de
--    `mirror.crm_negocios.ngo_conclusao` (Ganho / Perdido / Em Andamento).
--    PROBLEMA: negocio != pedido. Um negocio pode ter N pedidos (ex: Dalvan
--    Girardi, ngo_numero 2653 + 2657). Contar negocio infla ou ignora pedidos.
--    SOLUCAO: a partir da v5, os 3 valores vem de `mirror.crm_pedidos`, coluna
--    `pdo_situacaopedido` (Aprovado / Cancelado / Aberto / Aguardando Aprovacao).
--
-- 2) VALIDACAO COM CLIENTE (referencia R$ 1.660.540)
--    O valor de "Valor Ganho" ate 23/07/2026 foi VALIDADO contra o banco:
--    SELECT SUM(pdo_vlrpedido) FROM mirror.crm_pedidos
--    WHERE pdo_situacaopedido = 'Aprovado'
--      AND pdo_dthaprovacao::date <= '2026-07-23';
--    -> 13 clientes / R$ 1.660.540,00. Bate EXATAMENTE com a planilha do cliente.
--
-- 3) RELACAO PEDIDO -> NEGOCIO
--    Pedido pode se vincular a mais de um negocio (1:N). Ao derivar status do
--    pedido, o JOIN com negocios_dedup garante que o pedido seja associado a
--    um negocio COMERCIAL (c_funis_comerciais). Se o pedido nao tiver match
--    com nenhum negocio comercial, fica de fora do calculo de valores.
--
-- 4) FILTRO DE DATA
--    Usa `pdo_dthaprovacao::date` (data de aprovacao do pedido), NAO
--    `pdo_dthpedido` nem `ngo_datafechamento`. O cliente confirmou que a data
--    de aprovacao e o marco correto para reconhecimento de receita.
--
-- 5) PADRAO DE DEDUPE DE PEDIDOS
--    Segue o padrao de `rpc_pedidos_bi` (20260627_pedidos_por_data_ganho.sql):
--    DISTINCT ON (pdo_codigointerno) ORDER BY pdo_dthaprovacao DESC NULLS LAST.
--    Evita fan-out quando o mesmo pedido aparece varias vezes na mirror.
--
-- 6) CTE valores_status REESCRITA
--    Agora agrega a partir de `pedidos_periodo` (grao PEDIDO), nao de
--    `negocios_tocados` (grao NEGOCIO). Campos JSON mantidos:
--    valorAberto, valorGanho, valorPerdido, negociosAberto, negociosGanho,
--    negociosPerdido, negociosTocados, valorTocado, negociosOutrosStatus.
--
--    Mapeamento de pdo_situacaopedido -> KPI:
--      Aprovado               -> valorGanho / negociosGanho
--      Cancelado              -> valorPerdido / negociosPerdido
--      Aberto / Aguardando Aprovacao / Sem Situacao -> valorAberto / negociosAberto
--      Outro / NULL           -> negociosOutrosStatus (controle)
--
-- CTEs NOVAS: pedidos_dedup, pedidos_periodo
-- CTE REESCRITA: valores_status
-- DEMAIS CTEs: inalterados (filtered, negocios_dedup, negocios_tocados,
--   kpi_agg, tempo_medio, kpis, por_vendedor, por_cidade, por_mes, por_dia,
--   por_tipo_acao, por_tipo_contato, lista_anos, por_vendedor_cidade,
--   clientes_atendidos)
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

  -- ---------------------------------------------------------------------------
  -- FUNIS COMERCIAIS — lista fechada usada nos 3 cards de valor.
  --
  -- Somente estes funis representam VENDA. Os demais funis existentes hoje
  -- (MARKETING, BANCOS, OFICINA, ADM, Adm AP, Logistica AP) sao excluidos porque:
  --
  --   a) "Ganho" neles NAO significa venda: em MARKETING significa NPS
  --      respondido, em BANCOS significa financiamento aprovado, em OFICINA
  --      significa OS concluida. Somar isso como receita infla o card de Ganho
  --      (medido em julho/2026: +R$ 1,56 M de MARKETING, +R$ 1,55 M de BANCOS,
  --      +R$ 0,71 M de OFICINA).
  --
  --   b) DUPLA CONTAGEM: o MESMO negocio aparece com ngo_numero DIFERENTE em
  --      funis paralelos, com o MESMO valor. Exemplos verificados no banco vivo:
  --      DIEGO LUIZ BADIA R$ 2.000.000 em MARKETING e em VENDAS; ANTON HERING
  --      R$ 250.000 em 3 negocios. Sem o filtro, o valor e contado 2-3x.
  --
  -- RISCO CONHECIDO (registrar na doc da feature): se o ERP criar um funil
  -- comercial NOVO (ex: "Vendas Pecas"), ele fica invisivel nos 3 cards em
  -- silencio. Query de auditoria para detectar isso (rodar periodicamente):
  --   SELECT ngo_funil, SUM(ngo_vlrtotalnegociado) FROM mirror.crm_negocios
  --   WHERE ngo_funil <> ALL (ARRAY['VENDAS','Vendas AP','REPASSE DE MAQUINA'])
  --   GROUP BY 1;
  -- ---------------------------------------------------------------------------
  c_funis_comerciais CONSTANT text[] := ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'];
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
  -- Negocios COMERCIAIS tocados por alguma acao do periodo.
  -- Valor SEMPRE de ngo_vlrtotalnegociado (cabecalho do negocio) — NUNCA
  -- prd_vlrunitario * prd_qtde: so 69% dos negocios reconciliam por produto e ha
  -- caso real de negocio de R$ 66.000 com produto 0.00 (MARCELO FERNANDES,
  -- negocio 25062710152718485), que sumiria do card de Perdido.
  negocios_tocados AS (
    SELECT nd.ngo_numero, nd.ngo_vlrtotalnegociado, nd.ngo_conclusao
    FROM (
      SELECT DISTINCT f.ngo_nronegocio
      FROM filtered f
      WHERE f.ngo_nronegocio IS NOT NULL
        AND f.ngo_nronegocio <> ''
    ) distinct_ngo
    JOIN negocios_dedup nd ON nd.ngo_numero = distinct_ngo.ngo_nronegocio
    WHERE nd.ngo_funil = ANY (c_funis_comerciais)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v5: pedidos_dedup
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
  -- CTE NOVA v5: pedidos_periodo
  -- Pedidos aprovados no periodo, vinculados a negocios COMERCIAIS.
  -- JOIN com negocios_dedup garante que o pedido pertence a um funil comercial.
  -- Filtro de data: pdo_dthaprovacao::date (data de aprovacao do pedido).
  -- ---------------------------------------------------------------------------
  pedidos_periodo AS (
    SELECT pd.*
    FROM pedidos_dedup pd
    JOIN negocios_dedup nd ON nd.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND nd.ngo_funil = ANY (c_funis_comerciais)
      AND (p_vendedor IS NULL OR pd.pdo_vendedor = p_vendedor)
      AND (p_cidade IS NULL OR pd.pdo_cidadeufentrega = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE REESCRITA v5: valores_status
  -- AGORA agrega por PEDIDO (grao pdo_codigointerno), nao por NEGOCIO.
  -- Fonte: pedidos_periodo (v5).
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
