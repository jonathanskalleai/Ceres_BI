-------------------------------------------------------------------------------
-- rpc_acoes_em_andamento v2 — alinhar aliases do json_agg para camelCase
-------------------------------------------------------------------------------
-- Phase 0 do PRD v3 nao marcou este problema: a v1 retornava snake_case
-- (negocio_numero, valor_negociado, ultima_acao, data_ultima_acao,
-- dias_parado) mas o frontend declara camelCase (negocioNumero, valor,
-- ultimaAcao, dataUltimaAcao, diasParado). Sem transformacao no service,
-- todos os campos chegam como undefined no client.
--
-- Padrao ja aplicado em pedidos_ganhos v1 e negocios_perdidos v1:
-- aliases AS "campoCamelCase" na projection + ORDER BY identico no
-- json_agg. Em_andamento v1 ficou inconsistente (snake_case cru).
--
-- Fixo aqui mantendo a logica inalterada: mesmo CTE, mesmo filtro,
-- mesmo grão canônico, mesma exclusao de Repasse. So muda a forma
-- do JSON de retorno.
-------------------------------------------------------------------------------

SAVEPOINT migration_20260803_fix_rpc_acoes_em_andamento_aliases;

BEGIN;

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
AS $$
DECLARE
  v_limit int := GREATEST(COALESCE(p_limit, 50), 1);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN json_build_object(
    'rows', (
      SELECT COALESCE(
        json_agg(
          row_to_json(sub)
          ORDER BY sub."diasParado" DESC, sub."negocioNumero" ASC
        ),
        '[]'::json
      )
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
            a.aco_dthconclusao  AS ultima_acao,
            a.aco_tipocontato   AS tipo_contato
          FROM mirror.crm_acoes a
          WHERE a.ngo_nronegocio = ec.negocio_numero
            AND a.aco_dthconclusao IS NOT NULL
          ORDER BY a.aco_dthconclusao DESC
          LIMIT 1
        ) aco ON TRUE
        WHERE (p_vendedor IS NULL OR ec.consultor_negocio = p_vendedor)
          AND (p_cidade IS NULL OR ec.cidade_negocio = p_cidade)
        ORDER BY "diasParado" DESC, "negocioNumero" ASC
        LIMIT v_limit
        OFFSET v_offset
      ) sub
    ),
    'total', (
      SELECT COUNT(*)
      FROM em_andamento_canonicos ec
      WHERE (p_vendedor IS NULL OR ec.consultor_negocio = p_vendedor)
        AND (p_cidade IS NULL OR ec.cidade_negocio = p_cidade)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int)
  IS 'v2 — aliases do json_agg alinhados para camelCase (negocioNumero, valor, ultimaAcao, dataUltimaAcao, diasParado). Frontend declara camelCase; v1 retornava snake_case e campos chegavam como undefined. Mesma logica de negocio: 1 linha por negocio unico canonico, Em Andamento + sem Repasse.';

COMMIT;

DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'rpc_acoes_em_andamento') = 1,
    'POSTFLIGHT: funcao rpc_acoes_em_andamento nao foi criada';
  ASSERT (SELECT proowner FROM pg_proc WHERE proname = 'rpc_acoes_em_andamento')
         = (SELECT oid FROM pg_roles WHERE rolname='postgres'),
    'POSTFLIGHT: owner de rpc_acoes_em_andamento nao e postgres';
  ASSERT (SELECT COUNT(*) FROM information_schema.routine_privileges
    WHERE routine_name='rpc_acoes_em_andamento' AND grantee IN ('PUBLIC', 'anon')) = 0,
    'POSTFLIGHT: PUBLIC ou anon ainda tem EXECUTE em rpc_acoes_em_andamento';
  ASSERT (SELECT COUNT(*) FROM information_schema.routine_privileges
    WHERE routine_name='rpc_acoes_em_andamento' AND grantee='authenticated') >= 1,
    'POSTFLIGHT: authenticated nao tem EXECUTE em rpc_acoes_em_andamento';
END $$;

RELEASE SAVEPOINT migration_20260803_fix_rpc_acoes_em_andamento_aliases;
