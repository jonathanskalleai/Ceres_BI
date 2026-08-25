-- `dados_acoes` and `dados_funil` are each read four times in the JSON output.
-- Without MATERIALIZED, PostgreSQL inlines these CTEs and evaluates the nested
-- RPC on every read, multiplying the dashboard work eightfold.
DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.rpc_resultados_negocios_bi(date,date,text,text)'::regprocedure
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'rpc_resultados_negocios_bi was not found';
  END IF;

  v_definition := replace(
    v_definition,
    'WITH dados_acoes AS (',
    'WITH dados_acoes AS MATERIALIZED ('
  );
  v_definition := replace(
    v_definition,
    'dados_funil AS (',
    'dados_funil AS MATERIALIZED ('
  );

  IF position('WITH dados_acoes AS MATERIALIZED (' IN v_definition) = 0
    OR position('dados_funil AS MATERIALIZED (' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'could not materialize the source CTEs of rpc_resultados_negocios_bi';
  END IF;

  EXECUTE v_definition;
END;
$$;

NOTIFY pgrst, 'reload schema';
