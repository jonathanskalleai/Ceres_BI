-- As evolucoes mensais da aba Acoes sao uma leitura anual: janeiro ate o
-- mes corrente. O filtro de calendario da pagina nao entra aqui; vendedor,
-- tipo de acao e cidade continuam sendo respeitados.
CREATE FUNCTION public.rpc_acoes_evolucao_mensal_ano_corrente(
  p_vendedor text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH limites AS (
    SELECT
      date_trunc('year', CURRENT_DATE)::date AS inicio,
      CURRENT_DATE AS fim
  ),
  meses AS (
    SELECT generate_series(
      inicio,
      date_trunc('month', fim)::date,
      interval '1 month'
    )::date AS mes
    FROM limites
  ),
  agregados AS (
    SELECT
      date_trunc('month', a.aco_dthconclusao)::date AS mes,
      COUNT(*)::integer AS acoes,
      COUNT(*) FILTER (
        WHERE LOWER(COALESCE(a.aco_tipocontato, '')) LIKE '%visita%'
      )::integer AS visitas
    FROM mirror.crm_acoes a
    CROSS JOIN limites l
    WHERE a.aco_dthconclusao IS NOT NULL
      AND a.aco_dthconclusao::date >= l.inicio
      AND a.aco_dthconclusao::date <= l.fim
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (
        p_cidade IS NULL
        OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade
      )
    GROUP BY date_trunc('month', a.aco_dthconclusao)::date
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'name', TO_CHAR(m.mes, 'YYYY-MM'),
        'acoes', COALESCE(a.acoes, 0),
        'visitas', COALESCE(a.visitas, 0)
      )
      ORDER BY m.mes
    ),
    '[]'::json
  )
  FROM meses m
  LEFT JOIN agregados a ON a.mes = m.mes;
$$;

COMMENT ON FUNCTION public.rpc_acoes_evolucao_mensal_ano_corrente(text, text, text) IS
  'Serie mensal de acoes e visitas da aba Acoes, fixa de janeiro ate o mes atual do ano corrente; respeita vendedor, tipo e cidade.';

REVOKE ALL ON FUNCTION public.rpc_acoes_evolucao_mensal_ano_corrente(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_evolucao_mensal_ano_corrente(text, text, text)
  TO authenticated, service_role;
