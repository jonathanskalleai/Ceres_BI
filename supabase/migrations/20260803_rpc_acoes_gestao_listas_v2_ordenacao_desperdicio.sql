-------------------------------------------------------------------------------
-- rpc_acoes_gestao_listas v2 — ordenacao desperdicio
-- Story: 3-A
-- Data: 2026-08-03
--
-- PROPOSITO
--   Corrigir ordenacao do tipo 'desperdicio' em rpc_acoes_gestao_listas.
--   Ordenacao atual: oportunidades ASC, visitas DESC.
--   Ordenacao correta (Story 3-A): NULL/zero primeiro, razao DESC,
--   desempate estavel por ngo_numero ASC.
--
-- DECISAO
--   Materializar 'visitasPorOportunidade' (razao) no servidor.
--   Ordenacao: NULL/zero primeiro, razao DESC, ngo_numero ASC.
--   Manter p_search, p_limit, p_offset server-side inalterados.
--   Compatibilidade com frontend: retorno JSON inalterado ({rows, total, meta}).
--
-- MUdanCA
--   Apenas o bloco IF p_tipo = 'desperdicio' e alterado.
--   Os blocos 'sem_contato' e 'negativas' permanecem inalterados.
-------------------------------------------------------------------------------

SAVEPOINT migration_20260803_rpc_acoes_gestao_listas_v2;

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_acoes_gestao_listas(
  p_tipo text,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL,
  p_dias_min int DEFAULT NULL,
  p_dias_max int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_limit  int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000);
  v_offset int  := GREATEST(COALESCE(p_offset, 0), 0);
  -- ILIKE precisa do %..%; NULL/vazio desliga o filtro
  v_search text := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  c_funis_comerciais CONSTANT text[] := ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'];
BEGIN
  IF p_tipo NOT IN ('sem_contato', 'desperdicio', 'negativas') THEN
    RAISE EXCEPTION 'rpc_acoes_gestao_listas: p_tipo invalido (%). Use sem_contato | desperdicio | negativas.', p_tipo;
  END IF;

  -- =========================================================================
  IF p_tipo = 'sem_contato' THEN
  -- =========================================================================
    -- INALTERADO vs v1 (copiado de 20260725_rpc_acoes_gestao_listas.sql:97-174)
    WITH negocios_dedup AS MATERIALIZED (
      SELECT DISTINCT ON (n.ngo_numero)
        n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.cli_idcliente
      FROM mirror.crm_negocios n
      WHERE n.ngo_numero IS NOT NULL
      ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
    ),
    abertos_por_cliente AS (
      SELECT DISTINCT nd.cli_idcliente
      FROM negocios_dedup nd
      WHERE nd.ngo_funil = ANY (c_funis_comerciais)
        AND nd.ngo_conclusao = 'Em Andamento'
        AND nd.cli_idcliente IS NOT NULL AND nd.cli_idcliente <> ''
    ),
    ultima_acao AS (
      SELECT a.cli_idcliente, MAX(a.aco_dthconclusao::date) AS ultima_data
      FROM mirror.crm_acoes a
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY a.cli_idcliente
    ),
    carteira_base AS (
      SELECT DISTINCT ON (c.cli_idcliente)
        c.cli_idcliente, c.cli_nome, c.cli_cidade, c.usr_nomeusuario
      FROM mirror.crm_carteira_clientes c
      WHERE (p_vendedor IS NULL OR c.usr_nomeusuario = p_vendedor)
        AND (p_cidade   IS NULL OR c.cli_cidade      = p_cidade)
        AND (v_search   IS NULL OR c.cli_nome ILIKE '%' || v_search || '%')
      ORDER BY c.cli_idcliente, c.usr_idusuario
    ),
    calc AS (
      SELECT
        cb.cli_idcliente, cb.cli_nome, cb.cli_cidade, cb.usr_nomeusuario,
        COALESCE(CURRENT_DATE - ua.ultima_data, 999) AS dias,
        ua.ultima_data,
        (ab.cli_idcliente IS NOT NULL) AS tem_oportunidade_aberta
      FROM carteira_base cb
      LEFT JOIN ultima_acao ua        ON ua.cli_idcliente = cb.cli_idcliente
      LEFT JOIN abertos_por_cliente ab ON ab.cli_idcliente = cb.cli_idcliente
    ),
    filtrado AS (
      SELECT * FROM calc
      WHERE (p_dias_min IS NULL OR dias >= p_dias_min)
        AND (p_dias_max IS NULL OR dias <= p_dias_max)
    ),
    paginado AS (
      SELECT json_build_object(
        'clienteId',              f.cli_idcliente,
        'cliente',                f.cli_nome,
        'cidade',                 f.cli_cidade,
        'consultor',              f.usr_nomeusuario,
        'dias',                   f.dias,
        'semAcaoNoAno',           (f.dias = 999),
        'ultimaAcao',             TO_CHAR(f.ultima_data, 'DD/MM/YYYY'),
        'temOportunidadeAberta',  f.tem_oportunidade_aberta
      ) AS row_json,
      f.dias, f.cli_nome
      FROM filtrado f
      ORDER BY f.dias DESC, f.cli_nome
      LIMIT v_limit OFFSET v_offset
    )
    SELECT json_build_object(
      'rows',  COALESCE((SELECT json_agg(p.row_json ORDER BY p.dias DESC, p.cli_nome) FROM paginado p), '[]'::json),
      'total', (SELECT COUNT(*) FROM filtrado),
      'meta',  json_build_object(
        'tipo', 'sem_contato',
        'comOportunidadeAberta', (SELECT COUNT(*) FROM filtrado WHERE tem_oportunidade_aberta),
        'semAcaoNoAno',          (SELECT COUNT(*) FROM filtrado WHERE dias = 999)
      )
    ) INTO result;

  -- =========================================================================
  ELSIF p_tipo = 'desperdicio' THEN
  -- =========================================================================
    -- ALTERADO v2: ordenacao NULL/zero primeiro, razao DESC, ngo_numero ASC
    WITH filtered AS MATERIALIZED (
      SELECT a.cli_idcliente, a.cli_nome, a.aco_tipocontato, a.ngo_nronegocio,
             a.aco_vendedor, a.emp_cidade
      FROM mirror.crm_acoes a
      WHERE a.aco_dthconclusao IS NOT NULL
        AND (p_from     IS NULL OR a.aco_dthconclusao::date >= p_from)
        AND (p_to       IS NULL OR a.aco_dthconclusao::date <= p_to)
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_cidade   IS NULL
             OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
        AND (v_search   IS NULL OR a.cli_nome ILIKE '%' || v_search || '%')
    ),
    negocios_dedup AS MATERIALIZED (
      SELECT DISTINCT ON (n.ngo_numero)
        n.ngo_numero, n.ngo_funil
      FROM mirror.crm_negocios n
      WHERE n.ngo_numero IS NOT NULL
      ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
    ),
    -- por_cliente: inclui MIN(ngo_numero) para desempate estavel
    por_cliente AS (
      SELECT
        f.cli_idcliente,
        MIN(f.cli_nome)                          AS cli_nome,
        COUNT(*) FILTER (WHERE f.aco_tipocontato = 'Visita') AS visitas,
        COUNT(*)                                        AS acoes,
        COUNT(DISTINCT nd.ngo_numero)              AS oportunidades,
        -- Menor ngo_numero do cliente como desempate estavel
        MIN(nd.ngo_numero)                        AS primeiro_ngo_numero
      FROM filtered f
      LEFT JOIN negocios_dedup nd
        ON nd.ngo_numero = f.ngo_nronegocio
       AND f.ngo_nronegocio IS NOT NULL AND f.ngo_nronegocio <> ''
       AND nd.ngo_funil = ANY (c_funis_comerciais)
      WHERE f.cli_idcliente IS NOT NULL AND f.cli_idcliente <> ''
      GROUP BY f.cli_idcliente
    ),
    filtrado AS (
      SELECT * FROM por_cliente WHERE visitas >= 3
    ),
    -- Ordenacao v2: NULL/zero primeiro, razao DESC, ngo_numero ASC (desempate)
    -- NULLIF(oportunidades, 0) = NULL quando oportunidades=0 -> NULLS FIRST
    paginado AS (
      SELECT json_build_object(
        'clienteId',     f.cli_idcliente,
        'cliente',       f.cli_nome,
        'cidade',        mirror.fn_cli_cidade(f.cli_idcliente),
        'visitas',       f.visitas,
        'acoes',         f.acoes,
        'oportunidades', f.oportunidades,
        -- visitasPorOportunidade materializado no servidor
        'visitasPorOportunidade',
          ROUND(f.visitas::numeric / NULLIF(f.oportunidades, 0), 2)
      ) AS row_json,
      -- Colunas de ordenacao
      f.oportunidades,
      ROUND(f.visitas::numeric / NULLIF(f.oportunidades, 0), 6) AS razao,
      f.primeiro_ngo_numero
      FROM filtrado f
      -- Ordenacao: NULL/zero primeiro (NULLIF=NULL quando oportunidades=0),
      -- depois razao DESC, desempate por primeiro_ngo_numero ASC
      ORDER BY
        (f.oportunidades IS NULL OR f.oportunidades = 0) DESC NULLS LAST,
        (f.visitas::numeric / NULLIF(f.oportunidades, 0)) DESC NULLS LAST,
        f.primeiro_ngo_numero ASC NULLS LAST
      LIMIT v_limit OFFSET v_offset
    )
    SELECT json_build_object(
      'rows',  COALESCE((
        SELECT json_agg(
          json_build_object(
            'clienteId',             p.row_json->>'clienteId',
            'cliente',               p.row_json->>'cliente',
            'cidade',                p.row_json->>'cidade',
            'visitas',               (p.row_json->>'visitas')::int,
            'acoes',                 (p.row_json->>'acoes')::int,
            'oportunidades',         (p.row_json->>'oportunidades')::int,
            'visitasPorOportunidade', p.row_json->>'visitasPorOportunidade'
          )
          ORDER BY
            ((p.row_json->>'oportunidades') IS NULL
              OR (p.row_json->>'oportunidades')::int = 0) DESC NULLS LAST,
            ROUND(
              (p.row_json->>'visitas')::numeric /
              NULLIF((p.row_json->>'oportunidades')::int, 0), 6
            ) DESC NULLS LAST,
            p.primeiro_ngo_numero ASC NULLS LAST
        )
        FROM paginado p
      ), '[]'::json),
      'total', (SELECT COUNT(*) FROM filtrado),
      'meta',  json_build_object(
        'tipo', 'desperdicio',
        'minVisitas', 3,
        'semNenhumaOportunidade', (SELECT COUNT(*) FROM filtrado WHERE oportunidades = 0)
      )
    ) INTO result;

  -- =========================================================================
  ELSE  -- p_tipo = 'negativas'
  -- =========================================================================
    -- INALTERADO vs v1 (copiado de 20260725_rpc_acoes_gestao_listas.sql:245-319)
    WITH negocios_dedup AS MATERIALIZED (
      SELECT DISTINCT ON (n.ngo_numero)
        n.ngo_numero, n.cli_idcliente, n.cli_nome, n.ngo_conclusao, n.ngo_funil,
        n.mpr_dscmotivoperda, n.ngo_datacadastro, n.ngo_vlrtotalnegociado, n.ngo_etapa
      FROM mirror.crm_negocios n
      WHERE n.ngo_numero IS NOT NULL
      ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
    ),
    comerciais AS (
      SELECT * FROM negocios_dedup
      WHERE ngo_funil = ANY (c_funis_comerciais)
        AND cli_idcliente IS NOT NULL AND cli_idcliente <> ''
        AND (v_search IS NULL OR cli_nome ILIKE '%' || v_search || '%')
    ),
    ranked AS (
      SELECT c.*,
        ROW_NUMBER() OVER (PARTITION BY c.cli_idcliente
                           ORDER BY c.ngo_datacadastro DESC NULLS LAST, c.ngo_numero DESC) AS rn,
        COUNT(*)     OVER (PARTITION BY c.cli_idcliente) AS total_negocios
      FROM comerciais c
    ),
    ultimos3 AS (
      SELECT * FROM ranked WHERE rn <= 3 AND total_negocios >= 3
    ),
    alvo AS (
      SELECT cli_idcliente
      FROM ultimos3
      GROUP BY cli_idcliente
      HAVING COUNT(*) FILTER (WHERE ngo_conclusao = 'Perdido') = 3
    ),
    filtrado AS (
      SELECT
        u.cli_idcliente,
        MIN(u.cli_nome) AS cli_nome,
        MAX(u.ngo_datacadastro) AS ultima_data,
        SUM(u.ngo_vlrtotalnegociado) AS valor_perdido,
        json_agg(
          json_build_object(
            'negocio',     u.ngo_numero,
            'etapa',       u.ngo_etapa,
            'valor',       u.ngo_vlrtotalnegociado,
            'motivoPerda', NULLIF(u.mpr_dscmotivoperda, ''),
            'data',        TO_CHAR(u.ngo_datacadastro, 'DD/MM/YYYY')
          ) ORDER BY u.rn
        ) AS negocios
      FROM ultimos3 u
      JOIN alvo a ON a.cli_idcliente = u.cli_idcliente
      GROUP BY u.cli_idcliente
    ),
    paginado AS (
      SELECT json_build_object(
        'clienteId',    f.cli_idcliente,
        'cliente',      f.cli_nome,
        'cidade',       mirror.fn_cli_cidade(f.cli_idcliente),
        'valorPerdido', f.valor_perdido,
        'ultimaPerda',  TO_CHAR(f.ultima_data, 'DD/MM/YYYY'),
        'negocios',     f.negocios
      ) AS row_json,
      f.valor_perdido, f.cli_nome
      FROM filtrado f
      ORDER BY f.valor_perdido DESC NULLS LAST, f.cli_nome
      LIMIT v_limit OFFSET v_offset
    )
    SELECT json_build_object(
      'rows',  COALESCE((SELECT json_agg(p.row_json ORDER BY p.valor_perdido DESC NULLS LAST, p.cli_nome) FROM paginado p), '[]'::json),
      'total', (SELECT COUNT(*) FROM filtrado),
      'meta',  json_build_object(
        'tipo', 'negativas',
        'regra', 'ultimos 3 negocios comerciais TODOS Perdido',
        'clientesCom3OuMaisNegocios', (SELECT COUNT(DISTINCT cli_idcliente) FROM ultimos3)
      )
    ) INTO result;

  END IF;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_gestao_listas(text, date, date, text, text, int, int, text, int, int) IS
  'Listas de gestao da carteira /bi/acoes v2. Alteracao: desperdicio ordena NULL/zero primeiro, razao DESC, ngo_numero ASC (desempate). Sem_contato e negativas inalterados. Retorno {rows, total, meta}.';

-- ============================================================
-- Padrao de GRANT seguro (ARCH-v3 §3)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_gestao_listas(text, date, date, text, text, int, int, text, int, int)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_gestao_listas(text, date, date, text, text, int, int, text, int, int)
  TO authenticated, service_role;

COMMIT;

-- POSTFLIGHT: validar
DO $$
DECLARE
  fn_name text := 'rpc_acoes_gestao_listas';
  row_count int;
BEGIN
  SELECT COUNT(*) INTO row_count FROM pg_proc WHERE proname = fn_name;
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % not found', fn_name;
  END IF;

  SELECT COUNT(*) INTO row_count
  FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = fn_name AND r.rolname = 'postgres';
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % owner is not postgres', fn_name;
  END IF;

  SELECT COUNT(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('PUBLIC', 'anon')
    AND privilege_type = 'EXECUTE';
  IF row_count > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % still has EXECUTE for PUBLIC or anon', fn_name;
  END IF;

  SELECT COUNT(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('authenticated', 'service_role')
    AND privilege_type = 'EXECUTE';
  IF row_count < 2 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % missing EXECUTE for authenticated or service_role', fn_name;
  END IF;
END $$;

ROLLBACK TO SAVEPOINT migration_20260803_rpc_acoes_gestao_listas_v2;
RELEASE SAVEPOINT migration_20260803_rpc_acoes_gestao_listas_v2;
