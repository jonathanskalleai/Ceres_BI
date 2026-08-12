-------------------------------------------------------------------------------
-- Filtro de calendario de /bi/acoes
--
-- rpc_acoes_bi filtrava os KPIs, mas mantinha porMes e clientesMaisAtendidos
-- presos ao ano corrente. A serie mensal de visitas tambem ignorava p_from e
-- p_to. Esta migration faz todos os visuais de acoes obedecerem ao intervalo
-- escolhido no calendario.
-------------------------------------------------------------------------------

BEGIN;

-- Mantem o agregado principal estavel e substitui somente os dois blocos que
-- antes liam mirror.crm_acoes sem p_from/p_to. Assim nao ha risco de alterar
-- as regras ja auditadas de ganhos, perdas e dos outros KPIs.
CREATE OR REPLACE FUNCTION public.rpc_acoes_bi_periodo(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
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
  WITH base AS (
    SELECT public.rpc_acoes_bi(p_from, p_to, p_vendedor, p_tipo_acao, p_cidade)::jsonb AS dados
  ),
  filtrado AS MATERIALIZED (
    SELECT
      a.aco_dthconclusao,
      a.aco_tipocontato,
      a.cli_nome,
      COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) AS cidade
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL
           OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
  ),
  por_mes AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('name', m.name, 'acoes', m.acoes) ORDER BY m.name),
      '[]'::jsonb
    ) AS dados
    FROM (
      SELECT TO_CHAR(aco_dthconclusao::date, 'YYYY-MM') AS name, COUNT(*) AS acoes
      FROM filtrado
      GROUP BY TO_CHAR(aco_dthconclusao::date, 'YYYY-MM')
    ) m
  ),
  clientes_atendidos AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'cliente', c.cliente,
          'cidade', c.cidade,
          'acoes', c.acoes,
          'visitas', c.visitas
        )
        ORDER BY c.acoes DESC, c.cliente ASC
      ),
      '[]'::jsonb
    ) AS dados
    FROM (
      SELECT
        cli_nome AS cliente,
        cidade,
        COUNT(*) AS acoes,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(aco_tipocontato, '')) LIKE '%visita%') AS visitas
      FROM filtrado
      WHERE cli_nome IS NOT NULL AND cli_nome <> ''
      GROUP BY cli_nome, cidade
      ORDER BY COUNT(*) DESC, cli_nome ASC
      LIMIT 15
    ) c
  )
  SELECT (
    b.dados || jsonb_build_object(
      'porMes', (SELECT dados FROM por_mes),
      'clientesMaisAtendidos', (SELECT dados FROM clientes_atendidos)
    )
  )::json
  FROM base b;
$$;

COMMENT ON FUNCTION public.rpc_acoes_bi_periodo(date, date, text, text, text) IS
  'BI Acoes com todos os visuais subordinados a p_from/p_to. Reaproveita rpc_acoes_bi para KPIs e substitui porMes/clientesMaisAtendidos pelo recorte selecionado.';

CREATE OR REPLACE FUNCTION public.rpc_acoes_visitas_mensal(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
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
  SELECT COALESCE(json_agg(row_to_json(monthly) ORDER BY monthly.name), '[]'::json)
  FROM (
    SELECT
      TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM') AS name,
      COUNT(*) AS visitas
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND LOWER(COALESCE(a.aco_tipocontato, '')) LIKE '%visita%'
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL
           OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
    GROUP BY TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM')
  ) monthly;
$$;

COMMENT ON FUNCTION public.rpc_acoes_visitas_mensal(date, date, text, text, text) IS
  'Serie mensal de visitas de /bi/acoes, filtrada integralmente por p_from/p_to, vendedor, tipo e cidade.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo(date, date, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo(date, date, text, text, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_visitas_mensal(date, date, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_visitas_mensal(date, date, text, text, text)
  TO authenticated, service_role;

COMMIT;
