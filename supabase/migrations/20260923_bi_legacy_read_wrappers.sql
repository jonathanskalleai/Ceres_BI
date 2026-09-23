-- Keep legacy CRM read contracts while routing them through the BI gateway.
-- The API role receives EXECUTE on these wrappers only; it does not receive
-- broad table access or RLS bypass.

CREATE OR REPLACE FUNCTION public.rpc_clientes_criticos_legacy(
  p_dias_limite integer DEFAULT 60
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(rows) ORDER BY rows.dias_sem_contato DESC),
    '[]'::json
  )
  FROM public.rpc_clientes_criticos(p_dias_limite) AS rows;
$$;

ALTER FUNCTION public.rpc_clientes_criticos_legacy(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_clientes_criticos_legacy(integer) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    GRANT EXECUTE ON FUNCTION public.rpc_clientes_criticos_legacy(integer)
      TO ceres_bi_api;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.rpc_negocios_crm(date, date, text, text)
  TO ceres_bi_api;
