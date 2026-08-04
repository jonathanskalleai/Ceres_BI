-------------------------------------------------------------------------------
-- rpc_acoes_em_andamento v2 — CTEs canonicos no nivel externo + aliases camelCase
-------------------------------------------------------------------------------
-- Problemas resolvidos:
--   1) v1 tinha CTEs inline em 2 niveis (rows + total) sem compartilhamento.
--   2) Projection retornava snake_case (negocio_numero, valor_negociado,
--      ultima_acao, data_ultima_acao, dias_parado) mas o service/tabela
--      declaravam camelCase — todos os campos chegavam undefined.
--
-- Solucao: consolidar os CTEs no nivel externo de json_build_object
-- (visiveis para rows E total) e renomear aliases para camelCase.
-- Logica de negocio intocada: 1 linha por negocio canonico Em Andamento,
-- sem Repasse, ordenado por diasParado DESC.
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
DECLARE
  v_limit  int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN (
    WITH
      acoes_periodo AS (
        SELECT DISTINCT a.ngo_nronegocio, a.aco_vendedor, a.cli_idcliente
        FROM mirror.crm_acoes a
        WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
          AND a.aco_dthconclusao IS NOT NULL
          AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      ),
      negocios_do_periodo AS (
        SELECT DISTINCT ON (ap.ngo_nronegocio)
          ap.ngo_nronegocio AS negocio_numero,
          ap.cli_idcliente,
          MAX(ap.aco_vendedor) AS ultimo_vendedor
        FROM acoes_periodo ap
        WHERE ap.ngo_nronegocio IS NOT NULL AND ap.ngo_nronegocio <> ''
        GROUP BY ap.ngo_nronegocio, ap.cli_idcliente
      ),
      filtered_dedup AS (
        SELECT ndp.negocio_numero, ndp.cli_idcliente, ndp.ultimo_vendedor
        FROM negocios_do_periodo ndp
      ),
      negocios_base AS (
        SELECT DISTINCT ON (n.ngo_numero)
          n.ngo_numero,
          n.ngo_conclusao,
          n.ngo_funil,
          n.ngo_etapa,
          n.ngo_vlrtotalnegociado,
          n.ngo_vendedores,
          n.cli_idcliente
        FROM mirror.crm_negocios n
        WHERE n.ngo_numero IS NOT NULL
        ORDER BY n.ngo_numero,
                 n.ngo_dataatualizacao DESC NULLS LAST,
                 n.dthregistro DESC NULLS LAST
      ),
      negocios_canonicos AS (
        SELECT
          b.ngo_numero,
          b.ngo_conclusao,
          b.ngo_funil,
          b.ngo_etapa,
          b.ngo_vlrtotalnegociado,
          b.ngo_vendedores,
          b.cli_idcliente,
          NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
          mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
        FROM negocios_base b
        LEFT JOIN mirror.usuarios u
          ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
      ),
      em_andamento_canonicos AS (
        SELECT DISTINCT ON (nc.ngo_numero)
          nc.ngo_numero              AS negocio_numero,
          nc.ngo_etapa               AS etapa,
          nc.ngo_vlrtotalnegociado   AS valor_negociado,
          nc.ngo_conclusao            AS conclusao,
          nc.ngo_funil               AS funil,
          nc.cli_idcliente,
          nc.consultor_negocio,
          nc.cidade_negocio
        FROM filtered_dedup fd
        JOIN negocios_canonicos nc ON nc.ngo_numero = fd.negocio_numero
        WHERE nc.ngo_conclusao = 'Em Andamento'
          AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
          AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
        ORDER BY nc.ngo_numero
      )
    SELECT json_build_object(
      'rows', COALESCE(
        (SELECT json_agg(row_to_json(sub) ORDER BY sub."diasParado" DESC, sub."negocioNumero" ASC)
         FROM (
           SELECT
             ec.negocio_numero            AS "negocioNumero",
             COALESCE(
               (SELECT cc.cli_nome
                FROM mirror.crm_carteira_clientes cc
                WHERE cc.cli_idcliente = ec.cli_idcliente
                ORDER BY cc.cli_idcliente
                LIMIT 1),
               '<sem cadastro>'
             )                             AS cliente,
             ec.cidade_negocio             AS cidade,
             ec.consultor_negocio          AS consultor,
             ec.etapa                      AS etapa,
             ec.valor_negociado            AS "valor",
             aco.tipo_contato              AS "ultimaAcao",
             aco.ultima_acao               AS "dataUltimaAcao",
             (CURRENT_DATE - aco.ultima_acao::date)::int AS "diasParado"
           FROM em_andamento_canonicos ec
           JOIN LATERAL (
             SELECT
               a.aco_dthconclusao AS ultima_acao,
               a.aco_tipocontato  AS tipo_contato
             FROM mirror.crm_acoes a
             WHERE a.ngo_nronegocio = ec.negocio_numero
               AND a.aco_dthconclusao IS NOT NULL
             ORDER BY a.aco_dthconclusao DESC
             LIMIT 1
           ) aco ON TRUE
           WHERE (p_vendedor IS NULL OR ec.consultor_negocio = p_vendedor)
           ORDER BY "diasParado" DESC, "negocioNumero" ASC
           LIMIT v_limit
           OFFSET v_offset
         ) sub),
        '[]'::json
      ),
      'total', (
        SELECT COUNT(*)
        FROM em_andamento_canonicos ec
        WHERE (p_vendedor IS NULL OR ec.consultor_negocio = p_vendedor)
      )
    )
  );
END;
$fn$;

COMMENT ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int)
  IS 'v2 — CTEs canonicos consolidados no nivel externo de json_build_object; aliases do json_agg em camelCase (negocioNumero, valor, ultimaAcao, dataUltimaAcao, diasParado). Mesma logica de negocio: 1 linha por negocio canonico Em Andamento, sem Repasse, ordenado por diasParado DESC.';

-- Garantir grants corretos (REVOKE + GRANT padrao)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) TO authenticated, service_role;
