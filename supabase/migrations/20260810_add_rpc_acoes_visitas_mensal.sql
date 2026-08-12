-- Serie mensal de visitas para /bi/acoes.
-- Mantem o contrato de rpc_acoes_bi estavel e segue a mesma regra temporal do
-- seu `porMes`: sempre apresenta a evolucao do ano corrente; vendedor, tipo
-- de acao e cidade continuam filtrando a serie.
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
    LEFT JOIN LATERAL (
      SELECT c.cli_cidade
      FROM mirror.crm_carteira_clientes c
      WHERE c.cli_idcliente = a.cli_idcliente
        AND c.cli_cidade IS NOT NULL
        AND c.cli_cidade <> ''
      LIMIT 1
    ) cc ON TRUE
    WHERE a.aco_dthconclusao IS NOT NULL
      AND LOWER(COALESCE(a.aco_tipocontato, '')) LIKE '%visita%'
      AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
    GROUP BY TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM')
  ) monthly;
$$;

REVOKE ALL ON FUNCTION public.rpc_acoes_visitas_mensal(date, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_visitas_mensal(date, date, text, text, text)
  TO authenticated, service_role;
