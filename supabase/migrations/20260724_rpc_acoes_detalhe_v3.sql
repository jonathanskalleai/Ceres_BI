-------------------------------------------------------------------------------
-- rpc_acoes_detalhe v3 — adiciona etapa e valor do negocio vinculado.
--
-- LEFT JOIN com crm_negocios (dedup por ngo_numero, mesmo padrao da rpc_acoes_bi v5)
-- para trazer ngo_etapa e ngo_vlrtotalnegociado. 61% das acoes nao tem negocio
-- vinculado — esses aparecem com etapa=null, valor=null (LEFT JOIN garante).
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_acoes_detalhe(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 2000,
  p_offset int DEFAULT 0
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
      n.ngo_vlrtotalnegociado
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
  paginado AS (
    SELECT
      f.aco_dthconclusao,
      f.aco_idacao,
      json_build_object(
        'data', TO_CHAR(f.aco_dthconclusao::date, 'DD/MM/YYYY'),
        'dataIso', TO_CHAR(f.aco_dthconclusao, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'consultor', f.aco_vendedor,
        'cliente', f.cli_nome,
        'cidade', f.cidade,
        'tipoAcao', f.aco_tipoacao,
        'tipoContato', f.aco_tipocontato,
        'observacao', f.aco_atividadeexecutada,
        'etapa', nd.ngo_etapa,
        'valor', nd.ngo_vlrtotalnegociado
      ) AS row_json
    FROM filtered f
    LEFT JOIN negocios_dedup nd ON nd.ngo_numero = f.ngo_nronegocio
      AND f.ngo_nronegocio IS NOT NULL AND f.ngo_nronegocio <> ''
    ORDER BY f.aco_dthconclusao DESC, f.aco_idacao DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT json_build_object(
    'rows', COALESCE(
      (SELECT json_agg(p.row_json ORDER BY p.aco_dthconclusao DESC, p.aco_idacao DESC) FROM paginado p),
      '[]'::json
    ),
    'total', (SELECT COUNT(*) FROM filtered)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int) IS
  'Tabela paginada de acoes do periodo com etapa e valor do negocio vinculado (v3). LEFT JOIN crm_negocios dedup.';
