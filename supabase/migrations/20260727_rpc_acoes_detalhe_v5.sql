-------------------------------------------------------------------------------
-- rpc_acoes_detalhe v5 — dedup por negocio quando p_status IS NOT NULL.
--
-- Problema resolvido: quando se filtra por status (ex: "Ganho"), TODAS as acoes
-- de cada negocio aparecem na tabela, mas o KPI/funil conta negocios UNICOS.
-- Isso gera inconsistencia (tabela mostra 15 rows, KPI mostra 8 negocios).
--
-- Solucao: quando p_status IS NOT NULL, aplica DISTINCT ON (ngo_nronegocio)
-- mantendo APENAS a acao mais recente (aco_dthconclusao DESC, aco_idacao DESC)
-- de cada negocio unico. O total tambem conta negocios unicos (nao acoes).
--
-- Quando p_status IS NULL: comportamento IDENTICO a v4 (todas as acoes, sem
-- dedup por negocio, total = count de acoes).
--
-- Supersede v4 (CREATE OR REPLACE, mesma signature).
-------------------------------------------------------------------------------
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  WITH negocios_dedup AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_etapa,
      n.ngo_vlrtotalnegociado,
      n.ngo_conclusao
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  filtered AS (
    SELECT
      a.aco_idacao,
      a.aco_dthconclusao,
      a.aco_vendedor,
      a.cli_nome,
      COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) AS cidade,
      a.aco_tipoacao,
      a.aco_tipocontato,
      a.aco_atividadeexecutada,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
  ),
  -- Quando p_status IS NOT NULL: INNER JOIN com negocios_dedup filtrando por
  -- ngo_conclusao. Acoes sem negocio ou com negocio em outro status sao excluidas.
  -- Quando p_status IS NULL: todas as acoes passam (LEFT JOIN preserva tudo).
  joined AS (
    SELECT
      f.aco_idacao,
      f.aco_dthconclusao,
      f.aco_vendedor,
      f.cli_nome,
      f.cidade,
      f.aco_tipoacao,
      f.aco_tipocontato,
      f.aco_atividadeexecutada,
      f.ngo_nronegocio,
      nd.ngo_etapa,
      nd.ngo_vlrtotalnegociado,
      nd.ngo_conclusao
    FROM filtered f
    LEFT JOIN negocios_dedup nd
      ON nd.ngo_numero = f.ngo_nronegocio
      AND f.ngo_nronegocio IS NOT NULL
      AND f.ngo_nronegocio <> ''
    WHERE (
      p_status IS NULL
      OR (
        nd.ngo_numero IS NOT NULL
        AND nd.ngo_conclusao = p_status
      )
    )
  ),
  ---------------------------------------------------------------------------
  -- v5: quando p_status IS NOT NULL, dedup por negocio — manter apenas a acao
  -- mais recente (aco_dthconclusao DESC, aco_idacao DESC) de cada ngo_nronegocio.
  -- Quando p_status IS NULL: pass-through (todas as rows de joined).
  ---------------------------------------------------------------------------
  deduped AS (
    SELECT *
    FROM (
      SELECT
        j.*,
        CASE
          WHEN p_status IS NOT NULL THEN
            ROW_NUMBER() OVER (
              PARTITION BY j.ngo_nronegocio
              ORDER BY j.aco_dthconclusao DESC, j.aco_idacao DESC
            )
          ELSE 1  -- sem dedup: toda row e "primeira"
        END AS rn
      FROM joined j
    ) sub
    WHERE sub.rn = 1
  ),
  paginado AS (
    SELECT
      d.aco_dthconclusao,
      d.aco_idacao,
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
        'valor', d.ngo_vlrtotalnegociado,
        'status', d.ngo_conclusao
      ) AS row_json
    FROM deduped d
    ORDER BY d.aco_dthconclusao DESC, d.aco_idacao DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT json_build_object(
    'rows', COALESCE(
      (SELECT json_agg(p.row_json ORDER BY p.aco_dthconclusao DESC, p.aco_idacao DESC) FROM paginado p),
      '[]'::json
    ),
    'total', (SELECT COUNT(*) FROM deduped)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int, text) IS
  'Tabela paginada de acoes com etapa, valor e status do negocio vinculado (v5). p_status filtra por ngo_conclusao e deduplica por negocio (1 acao mais recente por ngo_nronegocio); sem p_status retorna todas as acoes.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int, text) TO anon, authenticated, service_role;
