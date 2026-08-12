-------------------------------------------------------------------------------
-- Produto e observacao do negocio nos drill-downs de /bi/acoes
--
-- crm_negocios possui uma linha por produto. Todas as RPCs abaixo preservam o
-- grao original (acao, pedido ou negocio) agregando PRD_DscProduto por
-- ngo_numero. NGO_ObsNegocio vem da linha canonica mais recente do negocio.
-------------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_acoes_detalhe(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 2000,
  p_offset int DEFAULT 0,
  p_status text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH config AS (
    SELECT LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000)::int AS limite,
           GREATEST(COALESCE(p_offset, 0), 0)::int AS deslocamento
  ),
  negocios_dedup AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_etapa,
      n.ngo_vlrtotalnegociado,
      n.ngo_conclusao,
      n.ngo_funil,
      NULLIF(BTRIM(n.ngo_obsnegocio), '') AS observacao_negocio
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
  ),
  produtos_por_negocio AS MATERIALIZED (
    SELECT
      n.ngo_numero,
      STRING_AGG(
        DISTINCT NULLIF(BTRIM(n.prd_dscproduto), ''),
        ' · ' ORDER BY NULLIF(BTRIM(n.prd_dscproduto), '')
      ) AS produto
    FROM mirror.crm_negocios n
    JOIN negocios_dedup nd ON nd.ngo_numero = n.ngo_numero
    GROUP BY n.ngo_numero
  ),
  negocios_enriquecidos AS MATERIALIZED (
    SELECT nd.*, ppn.produto
    FROM negocios_dedup nd
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = nd.ngo_numero
  ),
  filtered AS MATERIALIZED (
    SELECT
      a.aco_idacao, a.aco_dthconclusao, a.aco_vendedor, a.cli_nome,
      COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) AS cidade,
      a.aco_tipoacao, a.aco_tipocontato, a.aco_atividadeexecutada, a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
  ),
  joined AS MATERIALIZED (
    SELECT
      f.*, ne.ngo_etapa, ne.produto, ne.observacao_negocio,
      ne.ngo_vlrtotalnegociado, ne.ngo_conclusao, ne.ngo_funil
    FROM filtered f
    LEFT JOIN negocios_enriquecidos ne
      ON ne.ngo_numero = f.ngo_nronegocio
      AND f.ngo_nronegocio IS NOT NULL AND f.ngo_nronegocio <> ''
    WHERE p_status IS NULL
       OR (
         ne.ngo_numero IS NOT NULL
         AND ne.ngo_conclusao = p_status
         AND ne.ngo_funil IN ('VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA')
       )
  ),
  deduped AS MATERIALIZED (
    SELECT *
    FROM (
      SELECT j.*,
        CASE WHEN p_status IS NOT NULL THEN ROW_NUMBER() OVER (
          PARTITION BY j.ngo_nronegocio ORDER BY j.aco_dthconclusao DESC, j.aco_idacao DESC
        ) ELSE 1 END AS rn
      FROM joined j
    ) x
    WHERE x.rn = 1
  ),
  paginado AS (
    SELECT
      d.aco_dthconclusao, d.aco_idacao,
      json_build_object(
        'data', TO_CHAR(d.aco_dthconclusao::date, 'DD/MM/YYYY'),
        'dataIso', TO_CHAR(d.aco_dthconclusao, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'consultor', d.aco_vendedor,
        'cliente', d.cli_nome,
        'cidade', d.cidade,
        'tipoAcao', d.aco_tipoacao,
        'tipoContato', d.aco_tipocontato,
        'observacao', d.aco_atividadeexecutada,
        'etapa', d.ngo_etapa,
        'produto', d.produto,
        'valor', d.ngo_vlrtotalnegociado,
        'status', d.ngo_conclusao,
        'observacaoNegocio', d.observacao_negocio
      ) AS row_json
    FROM deduped d
    ORDER BY d.aco_dthconclusao DESC, d.aco_idacao DESC
    LIMIT (SELECT limite FROM config)
    OFFSET (SELECT deslocamento FROM config)
  )
  SELECT json_build_object(
    'rows', COALESCE((SELECT json_agg(p.row_json ORDER BY p.aco_dthconclusao DESC, p.aco_idacao DESC) FROM paginado p), '[]'::json),
    'total', (SELECT COUNT(*) FROM deduped)
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_acoes_pedidos_ganhos(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
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
      p.pdo_codigointerno, p.pdo_vlrpedido, p.pdo_dthaprovacao, p.pdo_situacaopedido, p.ngo_numero
    FROM mirror.crm_pedidos p
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.ngo_vendedores, n.cli_idcliente,
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
    SELECT nb.*, ppn.produto, NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade_negocio
    FROM negocios_base nb
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = nb.ngo_numero
    LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(nb.ngo_vendedores, '')
  ),
  pedidos_periodo AS MATERIALIZED (
    SELECT pd.pdo_codigointerno AS pedido_codigo, pd.pdo_vlrpedido AS valor_pedido,
      pd.pdo_dthaprovacao AS pedido_data, pd.ngo_numero AS negocio_numero,
      nc.consultor_negocio AS consultor, nc.cidade_negocio AS cidade, nc.cli_idcliente,
      nc.produto, nc.observacao_negocio
    FROM pedidos_dedup pd
    JOIN negocios_canonicos nc ON nc.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND pd.pdo_situacaopedido = 'Aprovado'
      AND nc.ngo_conclusao = 'Ganho'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
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
        SELECT p.pedido_codigo AS "pedidoCodigo", p.negocio_numero AS "negocioNumero",
          p.valor_pedido AS "valorPedido", p.pedido_data AS "dataAprovacao", p.consultor, p.cidade,
          p.produto AS produto, p.observacao_negocio AS "observacaoNegocio",
          COALESCE((SELECT cc.cli_nome FROM mirror.crm_carteira_clientes cc WHERE cc.cli_idcliente = p.cli_idcliente ORDER BY cc.cli_idcliente LIMIT 1), '<sem cadastro>') AS cliente
        FROM paginado p
      ) sub
    ), '[]'::json),
    'total', (SELECT COUNT(*) FROM pedidos_periodo)
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_acoes_negocios_perdidos(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
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
      n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.ngo_datafechamento,
      n.ngo_vlrtotalnegociado, n.ngo_vendedores, n.cli_idcliente,
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
    SELECT nb.*, ppn.produto, NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade_negocio
    FROM negocios_base nb
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = nb.ngo_numero
    LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(nb.ngo_vendedores, '')
  ),
  perdidos_periodo AS MATERIALIZED (
    SELECT nc.ngo_numero AS negocio_numero, nc.ngo_datafechamento AS data_fechamento,
      nc.ngo_vlrtotalnegociado AS valor_negociado, nc.consultor_negocio AS consultor,
      nc.cidade_negocio AS cidade, nc.cli_idcliente, nc.produto, nc.observacao_negocio
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao = 'Perdido'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  paginado AS (
    SELECT pp.* FROM perdidos_periodo pp
    ORDER BY pp.data_fechamento DESC, pp.negocio_numero ASC
    LIMIT (SELECT limite FROM config)
    OFFSET (SELECT deslocamento FROM config)
  )
  SELECT json_build_object(
    'rows', COALESCE((
      SELECT json_agg(row_to_json(sub) ORDER BY sub."dataFechamento" DESC, sub."negocioNumero" ASC)
      FROM (
        SELECT p.negocio_numero AS "negocioNumero", p.data_fechamento AS "dataFechamento",
          p.valor_negociado AS "valorPerdido", p.consultor, p.cidade,
          p.produto AS produto, p.observacao_negocio AS "observacaoNegocio",
          COALESCE((SELECT cc.cli_nome FROM mirror.crm_carteira_clientes cc WHERE cc.cli_idcliente = p.cli_idcliente ORDER BY cc.cli_idcliente LIMIT 1), '<sem cadastro>') AS cliente
        FROM paginado p
      ) sub
    ), '[]'::json),
    'total', (SELECT COUNT(*) FROM perdidos_periodo)
  );
$$;

CREATE OR REPLACE FUNCTION public.rpc_acoes_em_andamento(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
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
  acoes_periodo AS MATERIALIZED (
    SELECT DISTINCT a.ngo_nronegocio, a.aco_vendedor, a.cli_idcliente
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  ),
  negocios_do_periodo AS MATERIALIZED (
    SELECT ap.ngo_nronegocio AS negocio_numero, ap.cli_idcliente, MAX(ap.aco_vendedor) AS ultimo_vendedor
    FROM acoes_periodo ap
    WHERE ap.ngo_nronegocio IS NOT NULL AND ap.ngo_nronegocio <> ''
    GROUP BY ap.ngo_nronegocio, ap.cli_idcliente
  ),
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.ngo_etapa,
      n.ngo_vlrtotalnegociado, n.ngo_vendedores, n.cli_idcliente,
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
    SELECT nb.*, ppn.produto, NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade_negocio
    FROM negocios_base nb
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = nb.ngo_numero
    LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(nb.ngo_vendedores, '')
  ),
  em_andamento_canonicos AS MATERIALIZED (
    SELECT nc.ngo_numero AS negocio_numero, nc.ngo_etapa AS etapa,
      nc.produto, nc.observacao_negocio, nc.ngo_vlrtotalnegociado AS valor_negociado,
      nc.cli_idcliente, nc.consultor_negocio, nc.cidade_negocio
    FROM negocios_do_periodo ndp
    JOIN negocios_canonicos nc ON nc.ngo_numero = ndp.negocio_numero
    WHERE nc.ngo_conclusao = 'Em Andamento'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
  ),
  linhas AS MATERIALIZED (
    SELECT
      ec.negocio_numero AS "negocioNumero",
      COALESCE((SELECT cc.cli_nome FROM mirror.crm_carteira_clientes cc WHERE cc.cli_idcliente = ec.cli_idcliente ORDER BY cc.cli_idcliente LIMIT 1), '<sem cadastro>') AS cliente,
      ec.cidade_negocio AS cidade, ec.consultor_negocio AS consultor, ec.etapa,
      ec.produto AS produto, ec.observacao_negocio AS "observacaoNegocio",
      ec.valor_negociado AS valor, ua.tipo_contato AS "ultimaAcao", ua.ultima_acao AS "dataUltimaAcao",
      (CURRENT_DATE - ua.ultima_acao::date)::int AS "diasParado"
    FROM em_andamento_canonicos ec
    JOIN LATERAL (
      SELECT a.aco_dthconclusao AS ultima_acao, a.aco_tipocontato AS tipo_contato
      FROM mirror.crm_acoes a
      WHERE a.ngo_nronegocio = ec.negocio_numero AND a.aco_dthconclusao IS NOT NULL
      ORDER BY a.aco_dthconclusao DESC
      LIMIT 1
    ) ua ON TRUE
  ),
  paginado AS (
    SELECT l.* FROM linhas l
    ORDER BY l."diasParado" DESC, l."negocioNumero" ASC
    LIMIT (SELECT limite FROM config)
    OFFSET (SELECT deslocamento FROM config)
  )
  SELECT json_build_object(
    'rows', COALESCE((SELECT json_agg(row_to_json(p) ORDER BY p."diasParado" DESC, p."negocioNumero" ASC) FROM paginado p), '[]'::json),
    'total', (SELECT COUNT(*) FROM linhas)
  );
$$;

COMMENT ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int, text) IS
  'Tabela de acoes com produto agregado por negocio (PRD_DscProduto) e observacao do negocio (NGO_ObsNegocio), sem alterar o grao ou a paginacao.';
COMMENT ON FUNCTION public.rpc_acoes_pedidos_ganhos(date, date, text, text, int, int) IS
  'Drill-down de pedidos ganhos com produto agregado por negocio (PRD_DscProduto) e NGO_ObsNegocio.';
COMMENT ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text, int, int) IS
  'Drill-down de negocios perdidos com produto agregado por negocio (PRD_DscProduto) e NGO_ObsNegocio.';
COMMENT ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) IS
  'Drill-down de negocios em andamento com produto agregado por negocio (PRD_DscProduto) e NGO_ObsNegocio.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(date, date, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(date, date, text, text, int, int) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text, int, int) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) TO authenticated, service_role;

COMMIT;
