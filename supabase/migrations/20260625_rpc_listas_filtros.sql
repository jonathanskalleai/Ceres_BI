-- Migration: rpc_listas_filtros
-- Purpose: Return distinct vendedores and cidades for filter dropdowns (server-side)
-- Replaces: client-side extraction from useComercialData().allData.listaVendedores/listaCidades

CREATE OR REPLACE FUNCTION public.rpc_listas_filtros(
  p_from date,
  p_to date
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'vendedores',
    COALESCE(
      (SELECT array_agg(v ORDER BY v)
       FROM (
         SELECT DISTINCT aco_vendedor AS v
         FROM mirror.crm_acoes
         WHERE aco_dthconclusao::date BETWEEN p_from AND p_to
           AND aco_vendedor IS NOT NULL
           AND aco_vendedor <> ''
       ) sub),
      ARRAY[]::text[]
    ),
    'cidades',
    COALESCE(
      (SELECT array_agg(c ORDER BY c)
       FROM (
         SELECT DISTINCT emp_cidade AS c
         FROM mirror.crm_acoes
         WHERE aco_dthconclusao::date BETWEEN p_from AND p_to
           AND emp_cidade IS NOT NULL
           AND emp_cidade <> ''
       ) sub),
      ARRAY[]::text[]
    )
  );
$$;

COMMENT ON FUNCTION public.rpc_listas_filtros IS 'Returns distinct vendedores and cidades for BI filter dropdowns within a date range';
