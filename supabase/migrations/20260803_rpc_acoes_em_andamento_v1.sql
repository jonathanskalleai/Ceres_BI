-------------------------------------------------------------------------------
-- rpc_acoes_em_andamento v1
-- Story: 5-A
-- Data: 2026-08-03
--
-- PROPOSITO
--   Drill-down de oportunidades em andamento (negocios canonicos com
--   ngo_conclusao='Em Andamento' + tocados por acao na janela + sem REPASSE).
--   Contrato de 3 fontes: Oportunidade = acao concluida + negocio canonico +
--   em Andamento + sem REPASSE.
--
-- DECISAO
--   CTEs copiadas byte-a-byte de
--   supabase/migrations/20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql
--   linhas 125-139 (negocios_base), 145-158 (negocios_canonicos).
--   FILTERED deduplicado por ngo_numero ANTES do LATERAL JOIN (Codex HIGH 1).
--   Cliente resolvido via subquery (LIMIT 1), nao JOIN multiplicador.
--   ORDER BY deterministico antes de LIMIT/OFFSET.
-------------------------------------------------------------------------------

SAVEPOINT migration_20260803_rpc_acoes_em_andamento;

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
  v_limit  int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN json_build_object(
    'rows', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.dias_parado DESC, sub.negocio_numero ASC), '[]'::json)
      FROM (
        -- ================================================================
        -- filtered_dedup: todas as acoes do periodo, deduplicadas por ngo_numero
        -- GRAO: 1 linha por negocio (NAO por acao).
        -- Codex HIGH 1: deduplicacao ANTES do LATERAL JOIN.
        -- ================================================================
        WITH filtered_dedup AS (
          -- Primeiro: todas as acoes do periodo
          WITH acoes_periodo AS (
            SELECT DISTINCT
              a.ngo_nronegocio,
              a.aco_vendedor,
              a.cli_idcliente
            FROM mirror.crm_acoes a
            WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
              AND a.aco_dthconclusao IS NOT NULL
              AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
          ),
          -- Segundo: deduplica por ngo_numero (1 linha por negocio)
          -- MAX sobre aco_vendedor/cli_idcliente: ultimo vendedor no periodo e
          -- o mais recente semanticamente. Aceito pelo usuario.
          negocios_do_periodo AS (
            SELECT DISTINCT ON (ap.ngo_nronegocio)
              ap.ngo_nronegocio        AS negocio_numero,
              ap.cli_idcliente,
              MAX(ap.aco_vendedor)    AS ultimo_vendedor
            FROM acoes_periodo ap
            WHERE ap.ngo_nronegocio IS NOT NULL
              AND ap.ngo_nronegocio <> ''
            GROUP BY ap.ngo_nronegocio, ap.cli_idcliente
            ORDER BY ap.ngo_nronegocio
          )
          SELECT ndp.negocio_numero, ndp.cli_idcliente, ndp.ultimo_vendedor
          FROM negocios_do_periodo ndp
        ),
        -- ================================================================
        -- negocios_base — 1 linha por ngo_numero
        -- Copiado de 20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql:125-139
        -- ================================================================
        negocios_base AS (
          SELECT DISTINCT ON (n.ngo_numero)
            n.ngo_numero,
            n.ngo_conclusao,
            n.ngo_funil,
            n.ngo_vendedores,
            n.cli_idcliente
          FROM mirror.crm_negocios n
          WHERE n.ngo_numero IS NOT NULL
          ORDER BY n.ngo_numero,
                   n.ngo_dataatualizacao DESC NULLS LAST,
                   n.dthregistro DESC NULLS LAST
        ),
        -- ================================================================
        -- negocios_canonicos — base + atribuicao resolvida
        -- Copiado de 20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql:145-158
        -- ================================================================
        negocios_canonicos AS (
          SELECT
            b.ngo_numero,
            b.ngo_conclusao,
            b.ngo_funil,
            b.ngo_vendedores,
            b.cli_idcliente,
            NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
            mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
          FROM negocios_base b
          LEFT JOIN mirror.usuarios u
            ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
        ),
        -- ================================================================
        -- CTE canônico: 1 linha por negocio Em Andamento, sem REPASSE
        -- Resolvido ANTES de qualquer paginacao ou join com acoes.
        -- ================================================================
        em_andamento_canonicos AS (
          SELECT DISTINCT ON (nc.ngo_numero)
            nc.ngo_numero                AS negocio_numero,
            nc.ngo_etapa                AS etapa,
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
        ),
        -- ================================================================
        -- CTE final: LATERAL JOIN para ultima acao
        -- Seguro porque ja estamos em 1 linha por negocio (apos filtered_dedup).
        -- ================================================================
        resultado AS (
          SELECT
            ec.negocio_numero,
            ec.etapa,
            ec.valor_negociado,
            ec.conclusao,
            ec.consultor_negocio,
            ec.cidade_negocio,
            aco.ultima_acao,
            aco.tipo_contato,
            (CURRENT_DATE - aco.ultima_acao::date)::int AS dias_parado,
            -- Cliente resolvido via subquery (SEM JOIN multiplicador)
            COALESCE(
              (SELECT cc.cli_nome
               FROM mirror.crm_carteira_clientes cc
               WHERE cc.cli_idcliente = ec.cli_idcliente
               ORDER BY cc.cli_idcliente
               LIMIT 1),
              '<sem cadastro>'
            ) AS cliente
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
        )
        -- ORDEM DETERMINISTICA ANTES DE LIMIT/OFFSET
        SELECT
          negocio_numero,
          cliente,
          cidade_negocio     AS cidade,
          consultor_negocio  AS consultor,
          etapa,
          valor_negociado   AS valor_negociado,
          tipo_contato      AS ultima_acao,
          ultima_acao       AS data_ultima_acao,
          dias_parado
        FROM resultado
        ORDER BY
          dias_parado DESC,
          negocio_numero ASC
        LIMIT v_limit
        OFFSET v_offset
      ) sub
    ),
    'total', (
      -- Total conta do CTE canônico (grão correto, sem multiplicacao)
      SELECT COUNT(DISTINCT nc.ngo_numero)
      FROM filtered_dedup fd
      JOIN negocios_canonicos nc ON nc.ngo_numero = fd.negocio_numero
      WHERE nc.ngo_conclusao = 'Em Andamento'
        AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
        AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
        AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) IS
  'Drill-down de oportunidades em andamento para /bi/acoes v1. Grão: 1 linha por negocio. Fontes: filtered deduplicado por ngo_numero ANTES de LATERAL JOIN + negocios_canonicos + ultima acao via LATERAL. Sem EXISTS de ganho/perdido (reaberto indetetavel sem historico). Cliente via subquery LIMIT 1. GRANT: authenticated+service_role apenas. Invariante: total deve bater com funil.oportunidades (112 em jul/2026).';

-- ============================================================
-- Padrao de GRANT seguro (ARCH-v3 §3)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int)
  TO authenticated, service_role;

COMMIT;

-- POSTFLIGHT: validar
DO $$
DECLARE
  fn_name text := 'rpc_acoes_em_andamento';
  row_count int;
BEGIN
  -- (a) Funcao existe
  SELECT COUNT(*) INTO row_count
  FROM pg_proc
  WHERE proname = fn_name;
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % not found', fn_name;
  END IF;

  -- (b) Owner e postgres
  SELECT COUNT(*) INTO row_count
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = fn_name
    AND r.rolname = 'postgres';
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % owner is not postgres', fn_name;
  END IF;

  -- (c) PUBLIC e anon SEM EXECUTE
  SELECT COUNT(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('PUBLIC', 'anon')
    AND privilege_type = 'EXECUTE';
  IF row_count > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % still has EXECUTE for PUBLIC or anon', fn_name;
  END IF;

  -- (d) authenticated e service_role COM EXECUTE
  SELECT COUNT(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('authenticated', 'service_role')
    AND privilege_type = 'EXECUTE';
  IF row_count < 2 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % missing EXECUTE for authenticated or service_role', fn_name;
  END IF;
END $$;

ROLLBACK TO SAVEPOINT migration_20260803_rpc_acoes_em_andamento;
RELEASE SAVEPOINT migration_20260803_rpc_acoes_em_andamento;
