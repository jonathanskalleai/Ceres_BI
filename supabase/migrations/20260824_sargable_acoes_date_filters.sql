-- Os filtros de data usavam `timestamp::date`, impedindo que o PostgreSQL
-- restringisse o índice de `crm_acoes` ao intervalo pedido. Mantém a regra de
-- inclusão do último dia e torna os predicados sargáveis.
DO $perf$
DECLARE
  v_source text;
BEGIN
  SELECT prosrc
  INTO v_source
  FROM pg_proc
  WHERE oid = 'public.rpc_acoes_bi(date,date,text,text,text)'::regprocedure;

  IF v_source IS NULL
     OR position('(p_from IS NULL OR a.aco_dthconclusao::date >= p_from)' IN v_source) = 0
     OR position('(p_to IS NULL OR a.aco_dthconclusao::date <= p_to)' IN v_source) = 0
     OR position('EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unexpected rpc_acoes_bi definition; migration stopped';
  END IF;

  v_source := replace(
    v_source,
    '(p_from IS NULL OR a.aco_dthconclusao::date >= p_from)',
    '(p_from IS NULL OR a.aco_dthconclusao >= p_from::timestamp)'
  );
  v_source := replace(
    v_source,
    '(p_to IS NULL OR a.aco_dthconclusao::date <= p_to)',
    '(p_to IS NULL OR a.aco_dthconclusao < (p_to + 1)::timestamp)'
  );
  v_source := replace(
    v_source,
    'EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)',
    'a.aco_dthconclusao >= date_trunc(''year'', CURRENT_DATE)::timestamp
        AND a.aco_dthconclusao < (date_trunc(''year'', CURRENT_DATE) + INTERVAL ''1 year'')::timestamp'
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.rpc_acoes_bi(
       p_from date DEFAULT NULL, p_to date DEFAULT NULL,
       p_vendedor text DEFAULT NULL, p_tipo_acao text DEFAULT NULL,
       p_cidade text DEFAULT NULL
     ) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS %L',
    v_source
  );

  SELECT prosrc
  INTO v_source
  FROM pg_proc
  WHERE oid = 'public.rpc_acoes_bi_periodo(date,date,text,text,text)'::regprocedure;

  IF v_source IS NULL
     OR position('(p_from IS NULL OR a.aco_dthconclusao::date >= p_from)' IN v_source) = 0
     OR position('(p_to IS NULL OR a.aco_dthconclusao::date <= p_to)' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unexpected rpc_acoes_bi_periodo definition; migration stopped';
  END IF;

  v_source := replace(
    v_source,
    '(p_from IS NULL OR a.aco_dthconclusao::date >= p_from)',
    '(p_from IS NULL OR a.aco_dthconclusao >= p_from::timestamp)'
  );
  v_source := replace(
    v_source,
    '(p_to IS NULL OR a.aco_dthconclusao::date <= p_to)',
    '(p_to IS NULL OR a.aco_dthconclusao < (p_to + 1)::timestamp)'
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.rpc_acoes_bi_periodo(
       p_from date DEFAULT NULL, p_to date DEFAULT NULL,
       p_vendedor text DEFAULT NULL, p_tipo_acao text DEFAULT NULL,
       p_cidade text DEFAULT NULL
     ) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER
       SET search_path = public, mirror AS %L',
    v_source
  );
END;
$perf$;

NOTIFY pgrst, 'reload schema';
