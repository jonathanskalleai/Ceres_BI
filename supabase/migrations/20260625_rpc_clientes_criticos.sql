-- rpc_clientes_criticos: server-side calculation of diasSemContato
-- Replaces browser-side computation (5000 rows → JS loop)
-- Item #8 perf/bi-quick-wins

DROP FUNCTION IF EXISTS public.rpc_clientes_criticos(int);

CREATE OR REPLACE FUNCTION public.rpc_clientes_criticos(
  p_dias_limite int DEFAULT 60
)
RETURNS TABLE(
  cli_nome text,
  emp_cidade text,
  aco_vendedor text,
  dias_sem_contato int,
  ultima_acao_data text,
  total_acoes bigint,
  total_visitas bigint,
  pipeline numeric,
  ultima_obs text,
  ultimo_tipo_acao text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      a.cli_nome,
      a.emp_cidade,
      a.aco_vendedor,
      (CURRENT_DATE - MAX(a.aco_dthconclusao)::date)::int AS dias_sem_contato,
      MAX(a.aco_dthconclusao)::text AS ultima_acao_data,
      COUNT(*)::bigint AS total_acoes,
      COUNT(*) FILTER (WHERE LOWER(a.aco_tipocontato) LIKE '%visita%')::bigint AS total_visitas,
      COALESCE(SUM(DISTINCT n.ngo_vlrtotalnegociado), 0) AS pipeline
    FROM mirror.crm_acoes a
    LEFT JOIN mirror.crm_negocios n
      ON n.ngo_numero = a.ngo_nronegocio
      AND a.ngo_nronegocio IS NOT NULL
      AND a.ngo_nronegocio <> ''
    WHERE a.cli_nome IS NOT NULL
      AND a.cli_nome <> ''
      AND a.aco_dthconclusao IS NOT NULL
    GROUP BY a.cli_nome, a.emp_cidade, a.aco_vendedor
    HAVING (CURRENT_DATE - MAX(a.aco_dthconclusao)::date)::int > p_dias_limite
    ORDER BY dias_sem_contato DESC
    LIMIT 200
  )
  SELECT
    agg.*,
    lat.aco_atividadeexecutada AS ultima_obs,
    lat.aco_tipoacao AS ultimo_tipo_acao
  FROM agg
  LEFT JOIN LATERAL (
    SELECT r.aco_atividadeexecutada, r.aco_tipoacao
    FROM mirror.crm_acoes r
    WHERE r.cli_nome = agg.cli_nome
      AND r.aco_vendedor = agg.aco_vendedor
      AND r.aco_dthconclusao IS NOT NULL
    ORDER BY r.aco_dthconclusao DESC
    LIMIT 1
  ) lat ON true
  ORDER BY agg.dias_sem_contato DESC;
$$;

NOTIFY pgrst, 'reload schema';
