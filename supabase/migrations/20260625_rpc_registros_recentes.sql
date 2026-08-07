-- rpc_registros_recentes: recent CRM actions with optional filters + negocio JOIN
-- Sessão B — CRM migration
-- JOIN: crm_negocios.ngo_numero = crm_acoes.ngo_nronegocio

DROP FUNCTION IF EXISTS public.rpc_registros_recentes(date, date, text, text, int);

CREATE OR REPLACE FUNCTION public.rpc_registros_recentes(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS TABLE(
  cliente text,
  cidade text,
  vendedor text,
  tipo_contato text,
  tipo_acao text,
  negocio_valor numeric,
  negocio_etapa text,
  dt_conclusao text,
  obs text,
  lat float,
  lng float,
  status text,
  nro_negocio text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.cli_nome AS cliente,
    a.emp_cidade AS cidade,
    a.aco_vendedor AS vendedor,
    a.aco_tipocontato AS tipo_contato,
    a.aco_tipoacao AS tipo_acao,
    n.ngo_vlrtotalnegociado AS negocio_valor,
    n.ngo_etapa AS negocio_etapa,
    a.aco_dthconclusao::text AS dt_conclusao,
    a.aco_atividadeexecutada AS obs,
    NULLIF(a.aco_lat, '')::float AS lat,
    NULLIF(a.aco_lon, '')::float AS lng,
    a.aco_status AS status,
    a.ngo_nronegocio AS nro_negocio
  FROM mirror.crm_acoes a
  LEFT JOIN mirror.crm_negocios n
    ON n.ngo_numero = a.ngo_nronegocio
    AND a.ngo_nronegocio IS NOT NULL
    AND a.ngo_nronegocio <> ''
  WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
    AND (p_vendedor IS NULL OR a.aco_vendedor ILIKE p_vendedor)
    AND (p_cidade IS NULL OR a.emp_cidade ILIKE p_cidade)
  ORDER BY a.aco_dthconclusao DESC
  LIMIT p_limit;
$$;
