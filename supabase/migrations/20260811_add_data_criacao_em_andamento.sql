-------------------------------------------------------------------------------
-- Drill-down "Em Andamento": data de criação do negócio.
--
-- A tabela já mostrava a última ação e sua data. Como ela reúne negócios
-- abertos que foram trabalhados no período — inclusive negociações antigas —
-- a data de cadastro do negócio torna essa diferença visível ao gestor.
-------------------------------------------------------------------------------

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
      n.ngo_datacadastro, n.ngo_vlrtotalnegociado, n.ngo_vendedores, n.cli_idcliente,
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
      nc.produto, nc.observacao_negocio, nc.ngo_datacadastro,
      nc.ngo_vlrtotalnegociado AS valor_negociado,
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
      ec.valor_negociado AS valor,
      ec.ngo_datacadastro AS "dataCadastroNegocio",
      ua.tipo_contato AS "ultimaAcao", ua.ultima_acao AS "dataUltimaAcao",
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

COMMENT ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) IS
  'Drill-down de negócios em andamento tocados no período, com produto, observação, última ação e data de cadastro do negócio.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
