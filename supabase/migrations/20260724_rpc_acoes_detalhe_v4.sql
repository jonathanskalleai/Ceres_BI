-------------------------------------------------------------------------------
-- rpc_acoes_detalhe v4 — adiciona filtro por status do negocio (p_status).
--
-- Quando p_status IS NOT NULL:
--   - Filtra apenas acoes com negocio vinculado (ngo_nronegocio != NULL/vazio)
--   - cujo ngo_conclusao = p_status ('Em Andamento', 'Ganho', 'Perdido')
--   - Acoes sem negocio DESAPARECEM (semantica: "mostre-me acoes que geraram
--     negocios NESTE status")
--
-- Quando p_status IS NULL: comportamento identico a v3 (todas as acoes).
--
-- Adiciona campo 'status' (ngo_conclusao) ao JSON de cada row.
-- Supersede v3 (CREATE OR REPLACE, mesma signature + p_status novo com DEFAULT).
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
  paginado AS (
    SELECT
      j.aco_dthconclusao,
      j.aco_idacao,
      json_build_object(
        'data', TO_CHAR(j.aco_dthconclusao::date, 'DD/MM/YYYY'),
        'dataIso', TO_CHAR(j.aco_dthconclusao, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'consultor', j.aco_vendedor,
        'cliente', j.cli_nome,
        'cidade', j.cidade,
        'tipoAcao', j.aco_tipoacao,
        'tipoContato', j.aco_tipocontato,
        'observacao', j.aco_atividadeexecutada,
        'etapa', j.ngo_etapa,
        'valor', j.ngo_vlrtotalnegociado,
        'status', j.ngo_conclusao
      ) AS row_json
    FROM joined j
    ORDER BY j.aco_dthconclusao DESC, j.aco_idacao DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT json_build_object(
    'rows', COALESCE(
      (SELECT json_agg(p.row_json ORDER BY p.aco_dthconclusao DESC, p.aco_idacao DESC) FROM paginado p),
      '[]'::json
    ),
    'total', (SELECT COUNT(*) FROM joined)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int, text) IS
  'Tabela paginada de acoes com etapa, valor e status do negocio vinculado (v4). p_status filtra por ngo_conclusao; quando ativo, acoes sem negocio desaparecem.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int, text) TO anon, authenticated, service_role;
