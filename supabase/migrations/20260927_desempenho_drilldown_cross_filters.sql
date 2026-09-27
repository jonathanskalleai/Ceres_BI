-------------------------------------------------------------------------------
-- Drill-down do Desempenho de Vendas: filtros cruzados no mesmo grão do visual
--
-- A tela principal já filtra produto/origem/banco/motivo no PostgreSQL, mas as
-- listas nominais usavam apenas período/vendedor/cidade/funil. Isso fazia um
-- clique no gráfico alterar os cards e deixar o modal com outra coorte.
--
-- As funções têm nomes próprios para não alterar nem sobrecarregar os RPCs
-- vigentes. O frontend só as chama quando existe um filtro cruzado ativo;
-- consultas sem esse filtro continuam no caminho já publicado e cacheado.
-------------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_acoes_pedidos_ganhos_filtrado(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_funis text[] DEFAULT NULL,
  p_produto text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_banco text DEFAULT NULL,
  p_condicao text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH config AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000)::int AS limite,
           GREATEST(COALESCE(p_offset, 0), 0)::int AS deslocamento
  ),
  pedidos_dedup AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_vlrpedido,
      p.pdo_vlrfinanciado,
      p.pdo_financiamentobanco,
      p.pdo_vendedor,
      p.pdo_cidadeufentrega,
      p.emp_cidade,
      p.pdo_dthaprovacao,
      p.pdo_situacaopedido,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vendedores,
      n.cli_idcliente,
      n.cli_cidade,
      n.emp_cidade,
      n.ngo_formaentrada,
      n.prd_condicaoproduto,
      n.prd_dscproduto,
      n.prd_marcaproduto,
      n.prd_grupoproduto,
      NULLIF(BTRIM(n.ngo_obsnegocio), '') AS observacao_negocio
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
  ),
  -- Primeiro reduzimos para a coorte temporal/status/funil. O agregado de
  -- produtos e a função de cidade só devem rodar para negócios candidatos;
  -- calcular isso para todo o CRM era o gargalo do drill-down filtrado.
  pedidos_periodo_base AS MATERIALIZED (
    SELECT
      pd.pdo_codigointerno AS pedido_codigo,
      pd.pdo_vlrpedido AS valor_pedido,
      pd.pdo_dthaprovacao AS pedido_data,
      pd.ngo_numero AS negocio_numero,
      COALESCE(NULLIF(BTRIM(pd.pdo_vendedor), ''), nc.consultor_negocio, 'Não Informado') AS consultor,
      nc.cidade_negocio AS cidade,
      nc.cli_idcliente,
      nc.observacao_negocio,
      COALESCE(NULLIF(BTRIM(pd.pdo_vendedor), ''), 'Não Informado') AS vendedor_pedido,
      COALESCE(
        NULLIF(BTRIM(pd.pdo_cidadeufentrega), ''),
        NULLIF(BTRIM(pd.emp_cidade), ''),
        nc.cidade_negocio,
        'Não Informada'
      ) AS cidade_entrega,
      COALESCE(NULLIF(BTRIM(pd.pdo_financiamentobanco), ''), 'Não Informado') AS banco,
      pd.pdo_vlrfinanciado,
      pd.pdo_financiamentobanco,
      nc.ngo_formaentrada AS origem_raw,
      nc.prd_condicaoproduto AS condicao_raw,
      nc.prd_dscproduto AS produto_descricao_raw,
      nc.prd_marcaproduto AS produto_marca_raw,
      nc.prd_grupoproduto AS produto_grupo_raw,
      nc.ngo_vendedores,
      nc.consultor_negocio,
      nc.cidade_negocio
    FROM pedidos_dedup pd
    JOIN (
      SELECT nb.*,
        NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
        mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade_negocio
      FROM negocios_base nb
      LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(nb.ngo_vendedores, '')
    ) nc ON nc.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND pd.pdo_situacaopedido = 'Aprovado'
      AND nc.ngo_conclusao = 'Ganho'
      AND CASE
        WHEN p_funis IS NOT NULL AND array_length(p_funis, 1) > 0 THEN nc.ngo_funil = ANY(p_funis)
        ELSE nc.ngo_funil <> 'REPASSE DE MAQUINA'
      END
      AND (
        p_vendedor IS NULL
        OR nc.consultor_negocio = p_vendedor
      )
      AND (
        p_cidade IS NULL
        OR nc.cidade_negocio = p_cidade
      )
  ),
  produtos_por_negocio AS MATERIALIZED (
    SELECT n.ngo_numero,
      STRING_AGG(DISTINCT NULLIF(BTRIM(n.prd_dscproduto), ''), ' · ' ORDER BY NULLIF(BTRIM(n.prd_dscproduto), '')) AS produto
    FROM mirror.crm_negocios n
    JOIN (SELECT DISTINCT negocio_numero FROM pedidos_periodo_base) candidatos
      ON candidatos.negocio_numero = n.ngo_numero
    GROUP BY n.ngo_numero
  ),
  pedidos_periodo AS MATERIALIZED (
    SELECT ppb.*,
      ppn.produto,
      COALESCE(NULLIF(BTRIM(ppb.origem_raw), ''), 'Não Informada') AS origem,
      COALESCE(NULLIF(BTRIM(ppb.condicao_raw), ''), 'Novo') AS condicao,
      COALESCE(NULLIF(BTRIM(ppb.produto_descricao_raw), ''), 'Produto Sem Descrição') AS produto_descricao,
      COALESCE(NULLIF(BTRIM(ppb.produto_marca_raw), ''), 'Outras') AS produto_marca,
      COALESCE(NULLIF(BTRIM(ppb.produto_grupo_raw), ''), 'Geral') AS produto_grupo
    FROM pedidos_periodo_base ppb
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = ppb.negocio_numero
    WHERE (
        p_produto IS NULL
        OR COALESCE(ppn.produto, '') ILIKE '%' || p_produto || '%'
        OR COALESCE(ppb.produto_descricao_raw, '') ILIKE '%' || p_produto || '%'
        OR COALESCE(ppb.produto_marca_raw, '') ILIKE '%' || p_produto || '%'
        OR COALESCE(ppb.produto_grupo_raw, '') ILIKE '%' || p_produto || '%'
        OR TRIM(SPLIT_PART(SPLIT_PART(COALESCE(ppb.produto_descricao_raw, ''), E'\n', 1), ' - Descricao', 1)) ILIKE '%' || p_produto || '%'
      )
      AND (p_origem IS NULL OR COALESCE(NULLIF(BTRIM(ppb.origem_raw), ''), 'Não Informada') ILIKE '%' || p_origem || '%')
      AND (p_condicao IS NULL OR COALESCE(NULLIF(BTRIM(ppb.condicao_raw), ''), 'Novo') ILIKE '%' || p_condicao || '%')
      AND (
        p_banco IS NULL
        OR (p_banco ILIKE '%próprio%' AND (COALESCE(ppb.pdo_vlrfinanciado, 0) = 0 OR COALESCE(NULLIF(BTRIM(ppb.pdo_financiamentobanco), ''), 'Não Informado') = 'Não Informado'))
        OR COALESCE(NULLIF(BTRIM(ppb.pdo_financiamentobanco), ''), 'Não Informado') ILIKE '%' || p_banco || '%'
      )
  ),
  paginado AS (
    SELECT pp.*
    FROM pedidos_periodo pp
    ORDER BY pp.pedido_data DESC, pp.negocio_numero ASC
    LIMIT (SELECT limite FROM config)
    OFFSET (SELECT deslocamento FROM config)
  )
  SELECT json_build_object(
    'rows', COALESCE((
      SELECT json_agg(row_to_json(sub) ORDER BY sub."dataAprovacao" DESC, sub."negocioNumero" ASC)
      FROM (
        SELECT p.pedido_codigo AS "pedidoCodigo",
          p.negocio_numero AS "negocioNumero",
          p.valor_pedido AS "valorPedido",
          p.pedido_data AS "dataAprovacao",
          p.consultor,
          p.cidade,
          p.produto,
          p.observacao_negocio AS "observacaoNegocio",
          COALESCE((
            SELECT cc.cli_nome
            FROM mirror.crm_carteira_clientes cc
            WHERE cc.cli_idcliente = p.cli_idcliente
            ORDER BY cc.cli_idcliente
            LIMIT 1
          ), '<sem cadastro>') AS cliente
        FROM paginado p
      ) sub
    ), '[]'::json),
    'total', (SELECT COUNT(*) FROM pedidos_periodo)
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_acoes_negocios_perdidos_filtrado(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_funis text[] DEFAULT NULL,
  p_produto text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_motivo_perda text DEFAULT NULL,
  p_condicao text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH config AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000)::int AS limite,
           GREATEST(COALESCE(p_offset, 0), 0)::int AS deslocamento
  ),
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_datafechamento,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores,
      n.cli_idcliente,
      n.cli_cidade,
      n.emp_cidade,
      n.ngo_formaentrada,
      n.ngo_motivoperda,
      n.prd_condicaoproduto,
      n.prd_dscproduto,
      n.prd_marcaproduto,
      n.prd_grupoproduto,
      NULLIF(BTRIM(n.ngo_obsnegocio), '') AS observacao_negocio
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
  ),
  produtos_por_negocio AS MATERIALIZED (
    SELECT n.ngo_numero,
      STRING_AGG(DISTINCT NULLIF(BTRIM(n.prd_dscproduto), ''), ' · ' ORDER BY NULLIF(BTRIM(n.prd_dscproduto), '')) AS produto
    FROM mirror.crm_negocios n
    JOIN negocios_base nb ON nb.ngo_numero = n.ngo_numero
    GROUP BY n.ngo_numero
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT nb.*,
      ppn.produto,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade_negocio,
      COALESCE(NULLIF(BTRIM(nb.ngo_formaentrada), ''), 'Não Informada') AS origem,
      COALESCE(NULLIF(BTRIM(nb.ngo_motivoperda), ''), 'Não Informado') AS motivo_perda,
      COALESCE(NULLIF(BTRIM(nb.prd_condicaoproduto), ''), 'Novo') AS condicao,
      COALESCE(NULLIF(BTRIM(nb.prd_dscproduto), ''), 'Produto Sem Descrição') AS produto_descricao,
      COALESCE(NULLIF(BTRIM(nb.prd_marcaproduto), ''), 'Outras') AS produto_marca,
      COALESCE(NULLIF(BTRIM(nb.prd_grupoproduto), ''), 'Geral') AS produto_grupo
    FROM negocios_base nb
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = nb.ngo_numero
    LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(nb.ngo_vendedores, '')
  ),
  perdidos_periodo AS MATERIALIZED (
    SELECT
      nc.ngo_numero AS negocio_numero,
      nc.ngo_datafechamento AS data_fechamento,
      nc.ngo_vlrtotalnegociado AS valor_negociado,
      nc.consultor_negocio AS consultor,
      nc.cidade_negocio AS cidade,
      nc.cli_idcliente,
      nc.produto,
      nc.observacao_negocio,
      nc.origem,
      nc.motivo_perda,
      nc.condicao,
      nc.produto_descricao,
      nc.produto_marca,
      nc.produto_grupo
    FROM negocios_canonicos nc
      WHERE nc.ngo_conclusao = 'Perdido'
      AND CASE
        WHEN p_funis IS NOT NULL AND array_length(p_funis, 1) > 0 THEN nc.ngo_funil = ANY(p_funis)
        ELSE nc.ngo_funil <> 'REPASSE DE MAQUINA'
      END
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (
        p_vendedor IS NULL
        OR nc.consultor_negocio = p_vendedor
      )
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
      AND (
        p_produto IS NULL
        OR COALESCE(nc.produto, '') ILIKE '%' || p_produto || '%'
        OR nc.produto_descricao ILIKE '%' || p_produto || '%'
        OR nc.produto_marca ILIKE '%' || p_produto || '%'
        OR nc.produto_grupo ILIKE '%' || p_produto || '%'
        OR TRIM(SPLIT_PART(SPLIT_PART(nc.produto_descricao, E'\n', 1), ' - Descricao', 1)) ILIKE '%' || p_produto || '%'
      )
      AND (p_origem IS NULL OR nc.origem ILIKE '%' || p_origem || '%')
      AND (p_motivo_perda IS NULL OR nc.motivo_perda ILIKE '%' || p_motivo_perda || '%')
      AND (p_condicao IS NULL OR nc.condicao ILIKE '%' || p_condicao || '%')
  ),
  paginado AS (
    SELECT pp.*
    FROM perdidos_periodo pp
    ORDER BY pp.data_fechamento DESC, pp.negocio_numero ASC
    LIMIT (SELECT limite FROM config)
    OFFSET (SELECT deslocamento FROM config)
  )
  SELECT json_build_object(
    'rows', COALESCE((
      SELECT json_agg(row_to_json(sub) ORDER BY sub."dataFechamento" DESC, sub."negocioNumero" ASC)
      FROM (
        SELECT p.negocio_numero AS "negocioNumero",
          p.data_fechamento AS "dataFechamento",
          p.valor_negociado AS "valorPerdido",
          p.consultor,
          p.cidade,
          p.produto,
          p.observacao_negocio AS "observacaoNegocio",
          COALESCE((
            SELECT cc.cli_nome
            FROM mirror.crm_carteira_clientes cc
            WHERE cc.cli_idcliente = p.cli_idcliente
            ORDER BY cc.cli_idcliente
            LIMIT 1
          ), '<sem cadastro>') AS cliente
        FROM paginado p
      ) sub
    ), '[]'::json),
    'total', (SELECT COUNT(*) FROM perdidos_periodo)
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_acoes_pedidos_ganhos_filtrado(date, date, text, text, integer, integer, text[], text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role, ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos_filtrado(date, date, text, text, integer, integer, text[], text, text, text, text)
  TO service_role, ceres_bi_api;

REVOKE ALL ON FUNCTION public.rpc_acoes_negocios_perdidos_filtrado(date, date, text, text, integer, integer, text[], text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role, ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos_filtrado(date, date, text, text, integer, integer, text[], text, text, text, text)
  TO service_role, ceres_bi_api;

COMMENT ON FUNCTION public.rpc_acoes_pedidos_ganhos_filtrado(date, date, text, text, integer, integer, text[], text, text, text, text) IS
  'Drill-down de pedidos ganhos com a mesma coorte de funil e filtros cruzados de produto, origem, banco e condição.';
COMMENT ON FUNCTION public.rpc_acoes_negocios_perdidos_filtrado(date, date, text, text, integer, integer, text[], text, text, text, text) IS
  'Drill-down de negócios perdidos com a mesma coorte de funil e filtros cruzados de produto, origem, motivo e condição.';

NOTIFY pgrst, 'reload schema';
COMMIT;
