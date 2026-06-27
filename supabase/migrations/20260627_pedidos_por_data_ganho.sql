-- Migration: rpc_pedidos_bi conta pedidos pela DATA DE GANHO do negocio
-- Autor: @data-engineer (Dara)
-- Data: 2026-06-27
-- Motivo (requisito do cliente): a tela /bi/pedidos deve contar os pedidos pela
--   data em que o NEGOCIO virou GANHO (pedido OK/assinado), NAO pela data do
--   pedido (pdo_dthpedido). Coluna correta confirmada em runtime contra o banco
--   vivo: mirror.crm_negocios.ngo_datafechamento (861 negocios ganhos, 0 NULL).
--
-- Mudancas vs versao do 20260626 (rpc_pedidos_bi):
--   a. Dedupe do negocio: crm_negocios tem ngo_numero DUPLICADO (238 grupos). O
--      INNER JOIN direto multiplicava linhas de pedido (fan-out) inflando
--      contagem/faturamento. Trocado por JOIN contra subselect DISTINCT ON
--      (ngo_numero) ordenado por ngo_datafechamento DESC (a versao ganha mais
--      recente vence) — segue o padrao DISTINCT ON da rpc_negocios_bi, mas com
--      criterio de ordenacao proprio (datafechamento, nao datacadastro).
--      Smoke test (read-only, banco vivo): pedidos de negocio ganho passam de
--      832 linhas (join sem dedupe) para 749 (DISTINCT ON) -> 83 linhas de
--      fan-out eliminadas.
--   b. Filtro de data: WHERE n.ngo_datafechamento::date BETWEEN p_from AND p_to
--      (era p.pdo_dthpedido::date). Demais filtros mantidos.
--   c. Evolucao mensal agrupada por ngo_datafechamento (era pdo_dthpedido).
--   d. grupo_produto/marca_produto: CORRIGIDO bug herdado do 20260626 — agrupavam
--      por pdo_codigointerno (ID do PEDIDO), entao o 'name' saia como id de pedido,
--      nao grupo/marca. Agora agregam de mirror.crm_pedidos_item (pdo_itemgrupo /
--      pdo_itemmarca), join via pdo_codigointerno -> base. Saida {name, valor, qtd}
--      conforme PedidosGrupoProdutoItem/PedidosMarcaProdutoItem (src/types/biRpc.ts).
--      Chaves json porGrupoProduto/porMarcaProduto mantidas.
--
-- Impacto medido em junho/2026 (smoke test read-only contra banco vivo):
--   BEFORE (por pdo_dthpedido): 18 pedidos / R$ 2.570.040,00 (aprovados)
--   AFTER  (por ngo_datafechamento, dedupe): 22 pedidos / R$ 3.107.540,00
--   Mudanca de numeros esperada e aprovada pelo usuario.
--
-- Assinatura inalterada -> CREATE OR REPLACE substitui in-place (sem DROP).
-- ROLLBACK: re-aplicar o corpo de rpc_pedidos_bi do 20260626_filtro_cidade_vendedor_rpcs.sql.

CREATE OR REPLACE FUNCTION public.rpc_pedidos_bi(
  p_from date,
  p_to date,
  p_cidade text DEFAULT NULL,
  p_vendedor text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH negocios_dedup AS (
    -- 1 linha por negocio (padrao DISTINCT ON da rpc_negocios_bi). Criterio de
    -- ordenacao proprio: a versao ganha mais recente por ngo_datafechamento vence
    -- (ngo_dataatualizacao e ctid como desempates estaveis).
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_datafechamento
    FROM mirror.crm_negocios n
    ORDER BY n.ngo_numero,
             n.ngo_datafechamento DESC NULLS LAST,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.ctid
  ),
  base AS (
    SELECT
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_vlrfinanciado,
      p.pdo_vlrrecursoproprio,
      n.ngo_datafechamento,
      p.pdo_vendedor,
      p.pdo_cidadeufentrega,
      p.pdo_codigointerno,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%cancel%' AS is_cancelado
    FROM mirror.crm_pedidos p
    INNER JOIN negocios_dedup n ON n.ngo_numero = p.ngo_numero
    WHERE n.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%'
      AND (p_cidade IS NULL OR p.emp_cidade = p_cidade)
      AND (p_vendedor IS NULL OR p.pdo_vendedor = p_vendedor)
  ),
  -- KPIs
  kpi_agg AS (
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE is_aprovado), 0) AS faturamento,
      CASE WHEN COUNT(*) FILTER (WHERE is_aprovado) > 0
        THEN ROUND(SUM(pdo_vlrpedido) FILTER (WHERE is_aprovado) / COUNT(*) FILTER (WHERE is_aprovado), 2)
        ELSE 0
      END AS ticket_medio,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE is_aprovado)::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END AS percent_aprovado,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE pdo_vlrfinanciado > 0)::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END AS percent_financiado,
      COALESCE(SUM(pdo_vlrpedido) FILTER (WHERE is_cancelado), 0) AS valor_cancelado
    FROM base
  ),
  kpis AS (
    SELECT json_build_object(
      'total', total,
      'faturamento', faturamento,
      'ticketMedio', ticket_medio,
      'percentAprovado', percent_aprovado,
      'percentFinanciado', percent_financiado,
      'valorCancelado', valor_cancelado
    ) AS val FROM kpi_agg
  ),
  -- Evolucao mensal (aprovados only) — por data de ganho do negocio
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datafechamento::date, 'YYYY-MM') AS name,
        COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS faturamento,
        COUNT(*) AS qtd
      FROM base
      WHERE is_aprovado
      GROUP BY TO_CHAR(ngo_datafechamento::date, 'YYYY-MM')
    ) sub
  ),
  -- Por situacao
  situacao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        pdo_situacaopedido AS name,
        COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS valor,
        COUNT(*) AS qtd
      FROM base
      WHERE pdo_situacaopedido IS NOT NULL
      GROUP BY pdo_situacaopedido
    ) sub
  ),
  -- Mix pagamento (Recurso Proprio vs Financiado)
  mix AS (
    SELECT json_build_array(
      json_build_object('name', 'Recurso Proprio', 'value', COALESCE(SUM(pdo_vlrrecursoproprio) FILTER (WHERE is_aprovado), 0)::numeric),
      json_build_object('name', 'Financiado', 'value', COALESCE(SUM(pdo_vlrfinanciado) FILTER (WHERE is_aprovado), 0)::numeric)
    ) AS val
    FROM base
  ),
  -- Por vendedor (top 10, aprovados)
  vendedores AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT pdo_vendedor AS name, COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS value
      FROM base
      WHERE is_aprovado AND pdo_vendedor IS NOT NULL
      GROUP BY pdo_vendedor
      ORDER BY SUM(pdo_vlrpedido) DESC
      LIMIT 10
    ) sub
  ),
  -- Por cidade (top 10, aprovados)
  cidades AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT pdo_cidadeufentrega AS name, COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS value
      FROM base
      WHERE is_aprovado AND pdo_cidadeufentrega IS NOT NULL
      GROUP BY pdo_cidadeufentrega
      ORDER BY SUM(pdo_vlrpedido) DESC
      LIMIT 10
    ) sub
  ),
  -- Por grupo de produto (top 10) — itens de pedidos VENDIDOS (negocio ganho na
  -- janela + aprovado). Fonte: mirror.crm_pedidos_item; vinculo via pdo_codigointerno.
  -- valor = SUM(qtde * vlr unitario) (nao ha total pre-calculado na tabela de itens).
  grupo_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        i.pdo_itemgrupo AS name,
        COALESCE(SUM(COALESCE(i.pdo_itemqtde, 0) * COALESCE(i.pdo_itemvlrunitario, 0)), 0)::numeric AS valor,
        COALESCE(SUM(i.pdo_itemqtde), 0)::numeric AS qtd
      FROM mirror.crm_pedidos_item i
      INNER JOIN base b ON b.pdo_codigointerno = i.pdo_codigointerno
      WHERE b.is_aprovado AND i.pdo_itemgrupo IS NOT NULL
      GROUP BY i.pdo_itemgrupo
      ORDER BY valor DESC
      LIMIT 10
    ) sub
  ),
  -- Por marca (top 10) — mesma fonte/escopo, agrupado por marca do item.
  marca_produto AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        i.pdo_itemmarca AS name,
        COALESCE(SUM(COALESCE(i.pdo_itemqtde, 0) * COALESCE(i.pdo_itemvlrunitario, 0)), 0)::numeric AS valor,
        COALESCE(SUM(i.pdo_itemqtde), 0)::numeric AS qtd
      FROM mirror.crm_pedidos_item i
      INNER JOIN base b ON b.pdo_codigointerno = i.pdo_codigointerno
      WHERE b.is_aprovado AND i.pdo_itemmarca IS NOT NULL
      GROUP BY i.pdo_itemmarca
      ORDER BY valor DESC
      LIMIT 10
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'evolucaoMensal', (SELECT val FROM evolucao),
    'porSituacao', (SELECT val FROM situacao),
    'mixPagamento', (SELECT val FROM mix),
    'porVendedor', (SELECT val FROM vendedores),
    'porCidade', (SELECT val FROM cidades),
    'porGrupoProduto', (SELECT val FROM grupo_produto),
    'porMarcaProduto', (SELECT val FROM marca_produto)
  ) INTO result;

  RETURN result;
END;
$$;
