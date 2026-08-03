-------------------------------------------------------------------------------
-- rpc_acoes_negocios_perdidos v2 (CORRECTIVE)
-- QA Report: FALHA 2 — column sub.data_fechamento does not exist
-- HINT: Perhaps you meant "dataFechamento"
-- Fix: corrigir alias dataFechamento no ORDER BY json_agg + CTEs externos
-- Data: 2026-08-03
--
-- PROBLEMA
--   1) json_agg(row_to_json(sub) ORDER BY sub.data_fechamento) referencia
--      data_fechamento (snake_case), mas o JSON key e dataFechamento (camelCase)
--      por causa do alias AS "dataFechamento".
--   2) CTE negocios_canonicos definido no subquery rows mas referenciado
--      no bloco total.
--
-- CORRECAO
--   1) ORDER BY sub."dataFechamento" DESC, sub."negocioNumero" ASC
--   2) Mover CTEs para nivel externo de json_build_object
-------------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_acoes_negocios_perdidos(
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
  v_limit  int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN (
    WITH negocios_base AS (
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
    negocios_canonicos AS (
      SELECT
        b.ngo_numero,
        b.ngo_conclusao,
        b.ngo_funil,
        b.ngo_datafechamento,
        b.ngo_vlrtotalnegociado,
        b.ngo_vendedores,
        b.cli_idcliente,
        NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
        mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
      FROM negocios_base b
      LEFT JOIN mirror.usuarios u
        ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
    ),
    perdidos_periodo AS (
      SELECT
        nc.ngo_numero         AS negocio_numero,
        nc.ngo_datafechamento AS data_fechamento,
        nc.ngo_vlrtotalnegociado AS valor_negociado,
        nc.consultor_negocio  AS consultor,
        nc.cidade_negocio     AS cidade,
        nc.cli_idcliente
      FROM negocios_canonicos nc
      WHERE nc.ngo_conclusao = 'Perdido'
        AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
        AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
        AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
    )
    SELECT json_build_object(
      'rows', (
        SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub."dataFechamento" DESC, sub."negocioNumero" ASC), '[]'::json)
        FROM (
          SELECT
            pp.negocio_numero     AS "negocioNumero",
            pp.data_fechamento    AS "dataFechamento",
            pp.valor_negociado   AS "valorPerdido",
            pp.consultor,
            pp.cidade,
            COALESCE(
              (SELECT cc.cli_nome
               FROM mirror.crm_carteira_clientes cc
               WHERE cc.cli_idcliente = pp.cli_idcliente
               ORDER BY cc.cli_idcliente
               LIMIT 1),
              '<sem cadastro>'
            ) AS cliente
          FROM perdidos_periodo pp
          ORDER BY pp.data_fechamento DESC, pp.negocio_numero ASC
          LIMIT v_limit
          OFFSET v_offset
        ) sub
      ),
      'total', (
        SELECT COUNT(DISTINCT nc.ngo_numero)
        FROM negocios_canonicos nc
        WHERE nc.ngo_conclusao = 'Perdido'
          AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
          AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
          AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
          AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text, int, int) IS
  'Drill-down de negocios perdidos para /bi/acoes v1. Fonte: negocios_canonicos com ngo_conclusao=Perdido, ngo_datafechamento na janela, sem REPASSE. Grao: 1 linha por negocio. Cliente via subquery LIMIT 1. Total = COUNT(DISTINCT ngo_numero). GRANT: authenticated+service_role apenas.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text, int, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text, int, int)
  TO authenticated, service_role;

COMMIT;

DO $$
DECLARE
  fn_name text := 'rpc_acoes_negocios_perdidos';
  row_count int;
BEGIN
  SELECT COUNT(*) INTO row_count FROM pg_proc WHERE proname = fn_name;
  IF row_count = 0 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % not found', fn_name; END IF;
  SELECT COUNT(*) INTO row_count FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner WHERE p.proname = fn_name AND r.rolname = 'postgres';
  IF row_count = 0 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % owner not postgres', fn_name; END IF;
  SELECT COUNT(*) INTO row_count FROM information_schema.routine_privileges WHERE routine_name = fn_name AND grantee IN ('PUBLIC','anon') AND privilege_type='EXECUTE';
  IF row_count > 0 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % has EXECUTE for PUBLIC/anon', fn_name; END IF;
  SELECT COUNT(*) INTO row_count FROM information_schema.routine_privileges WHERE routine_name = fn_name AND grantee IN ('authenticated','service_role') AND privilege_type='EXECUTE';
  IF row_count < 2 THEN RAISE EXCEPTION 'POSTFLIGHT FAILED: % missing EXECUTE for authenticated', fn_name; END IF;
END $$;
