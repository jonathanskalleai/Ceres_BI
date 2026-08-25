-- O banco opera em UTC, enquanto os filtros do BI representam o calendário
-- comercial de São Paulo. À noite, CURRENT_DATE já virava o dia seguinte e a
-- consulta anual "até hoje" perdia o caminho otimizado.
CREATE OR REPLACE FUNCTION public.rpc_resultados_negocios_bi(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
SET statement_timeout = '60s'
AS $function$
DECLARE
  v_year integer;
  v_sao_paulo_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  v_year := EXTRACT(YEAR FROM p_from)::integer;

  IF p_vendedor IS NULL
    AND p_cidade IS NULL
    AND p_from = make_date(v_year, 1, 1)
    AND (
      p_to = make_date(v_year, 12, 31)
      OR (
        v_year = EXTRACT(YEAR FROM v_sao_paulo_today)::integer
        AND p_to = v_sao_paulo_today
      )
    ) THEN
    RETURN public.rpc_resultados_negocios_bi_ano_completo(
      p_from, p_to, p_vendedor, p_cidade
    );
  END IF;

  RETURN public.rpc_resultados_negocios_bi_core(
    p_from, p_to, p_vendedor, p_cidade
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
