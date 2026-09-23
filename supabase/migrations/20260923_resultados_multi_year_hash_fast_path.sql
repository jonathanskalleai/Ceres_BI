-- O corpo de Resultados ja possui duas copias semanticamente equivalentes:
-- `core` usa o plano padrao e `ano_completo` desabilita nested loops para
-- privilegiar hash joins. Em producao, a segunda variante retornou o mesmo
-- payload (MD5 identico) e reduziu a janela 2023-2026 de ~8,86 s para ~1,62 s.
--
-- Mantemos o plano padrao para recortes curtos ou filtrados. O plano hash e
-- selecionado somente para consultas globais com pelo menos 90 dias, alem dos
-- anos completos que ja usavam essa variante.

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
  IF to_regprocedure(
    'public.rpc_resultados_negocios_bi(date,date,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'rpc_resultados_negocios_bi current signature was not found';
  END IF;

  IF to_regprocedure(
    'public.rpc_resultados_negocios_bi_core(date,date,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'rpc_resultados_negocios_bi_core was not found';
  END IF;

  IF to_regprocedure(
    'public.rpc_resultados_negocios_bi_ano_completo(date,date,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'rpc_resultados_negocios_bi_ano_completo was not found';
  END IF;
END;
$preflight$;

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
  v_is_full_year boolean;
  v_is_long_global_range boolean;
BEGIN
  v_year := EXTRACT(YEAR FROM p_from)::integer;

  v_is_full_year :=
    p_from = make_date(v_year, 1, 1)
    AND (
      p_to = make_date(v_year, 12, 31)
      OR (
        v_year = EXTRACT(YEAR FROM v_sao_paulo_today)::integer
        AND p_to = v_sao_paulo_today
      )
    );

  v_is_long_global_range :=
    p_from IS NOT NULL
    AND p_to IS NOT NULL
    AND p_to >= p_from + 90
    AND p_vendedor IS NULL
    AND p_cidade IS NULL;

  IF p_vendedor IS NULL
    AND p_cidade IS NULL
    AND (v_is_full_year OR v_is_long_global_range) THEN
    RETURN public.rpc_resultados_negocios_bi_ano_completo(
      p_from, p_to, p_vendedor, p_cidade
    );
  END IF;

  RETURN public.rpc_resultados_negocios_bi_core(
    p_from, p_to, p_vendedor, p_cidade
  );
END;
$function$;

DO $postflight$
DECLARE
  v_function oid := to_regprocedure(
    'public.rpc_resultados_negocios_bi(date,date,text,text)'
  );
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'rpc_resultados_negocios_bi disappeared after replacement';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE oid = v_function
      AND prorettype = 'json'::regtype
      AND provolatile = 's'
      AND prosecdef
  ) THEN
    RAISE EXCEPTION 'rpc_resultados_negocios_bi contract changed unexpectedly';
  END IF;
END;
$postflight$;

NOTIFY pgrst, 'reload schema';

COMMIT;
