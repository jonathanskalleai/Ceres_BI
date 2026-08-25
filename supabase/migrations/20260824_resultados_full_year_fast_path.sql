-- No recorte anual completo, o plano por nested loop de Resultados multiplica
-- leituras de CTEs materializadas. O plano hash é muito mais rápido nesse
-- formato, mas piora janelas curtas; por isso o contrato público escolhe a
-- variante apenas quando a janela cobre o ano inteiro (ou o ano corrente até
-- hoje). A resposta e as regras de negócio permanecem as mesmas.
DO $perf$
DECLARE
  v_source text;
BEGIN
  SELECT prosrc
  INTO v_source
  FROM pg_proc
  WHERE oid = 'public.rpc_resultados_negocios_bi(date,date,text,text)'::regprocedure;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'rpc_resultados_negocios_bi was not found';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.rpc_resultados_negocios_bi_core(
       p_from date, p_to date, p_vendedor text, p_cidade text
     ) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
       SET search_path = public, mirror
       SET statement_timeout = ''60s'' AS %L',
    v_source
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.rpc_resultados_negocios_bi_ano_completo(
       p_from date, p_to date, p_vendedor text, p_cidade text
     ) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
       SET search_path = public, mirror
       SET statement_timeout = ''60s''
       SET enable_nestloop = off AS %L',
    v_source
  );
END;
$perf$;

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
AS $wrapper$
DECLARE
  v_year integer;
BEGIN
  v_year := EXTRACT(YEAR FROM p_from)::integer;

  IF p_vendedor IS NULL
    AND p_cidade IS NULL
    AND p_from = make_date(v_year, 1, 1)
    AND (
      p_to = make_date(v_year, 12, 31)
      OR (v_year = EXTRACT(YEAR FROM CURRENT_DATE)::integer AND p_to = CURRENT_DATE)
    ) THEN
    RETURN public.rpc_resultados_negocios_bi_ano_completo(
      p_from, p_to, p_vendedor, p_cidade
    );
  END IF;

  RETURN public.rpc_resultados_negocios_bi_core(
    p_from, p_to, p_vendedor, p_cidade
  );
END;
$wrapper$;

REVOKE ALL ON FUNCTION public.rpc_resultados_negocios_bi_core(date, date, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_resultados_negocios_bi_ano_completo(date, date, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
