-- A função pública aceita filtros opcionais, mas o plano genérico dela fica
-- muito caro quando `p_produto` vem preenchido. Mantemos o contrato público e
-- desviamos o caso de filtro cruzado por produto para uma versão enxuta, em que
-- os demais filtros são constantes nulas no plano.
DO $perf$
DECLARE
  v_source text;
  v_product_source text;
BEGIN
  SELECT prosrc
  INTO v_source
  FROM pg_proc
  WHERE oid = 'public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text)'::regprocedure;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'rpc_desempenho_vendas_bi was not found';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.rpc_desempenho_vendas_bi_core(
       p_from date, p_to date, p_ano integer, p_vendedor text, p_cidade text,
       p_condicao text, p_produto text, p_origem text, p_banco text,
       p_motivo_perda text
     ) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS %L',
    v_source
  );

  v_product_source := regexp_replace(v_source, '\mp_from\M', 'NULL::date', 'g');
  v_product_source := regexp_replace(v_product_source, '\mp_to\M', 'NULL::date', 'g');
  v_product_source := regexp_replace(v_product_source, '\mp_vendedor\M', 'NULL::text', 'g');
  v_product_source := regexp_replace(v_product_source, '\mp_cidade\M', 'NULL::text', 'g');
  v_product_source := regexp_replace(v_product_source, '\mp_condicao\M', 'NULL::text', 'g');
  v_product_source := regexp_replace(v_product_source, '\mp_origem\M', 'NULL::text', 'g');
  v_product_source := regexp_replace(v_product_source, '\mp_banco\M', 'NULL::text', 'g');
  v_product_source := regexp_replace(v_product_source, '\mp_motivo_perda\M', 'NULL::text', 'g');

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.rpc_desempenho_vendas_produto(
       p_ano integer, p_produto text
     ) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS %L',
    v_product_source
  );
END;
$perf$;

CREATE OR REPLACE FUNCTION public.rpc_desempenho_vendas_bi(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_condicao text DEFAULT NULL,
  p_produto text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_banco text DEFAULT NULL,
  p_motivo_perda text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $wrapper$
BEGIN
  IF p_produto IS NOT NULL
    AND p_from IS NULL
    AND p_to IS NULL
    AND p_vendedor IS NULL
    AND p_cidade IS NULL
    AND p_condicao IS NULL
    AND p_origem IS NULL
    AND p_banco IS NULL
    AND p_motivo_perda IS NULL THEN
    RETURN public.rpc_desempenho_vendas_produto(p_ano, p_produto);
  END IF;

  RETURN public.rpc_desempenho_vendas_bi_core(
    p_from, p_to, p_ano, p_vendedor, p_cidade, p_condicao,
    p_produto, p_origem, p_banco, p_motivo_perda
  );
END;
$wrapper$;

REVOKE ALL ON FUNCTION public.rpc_desempenho_vendas_bi_core(
  date, date, integer, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_desempenho_vendas_produto(integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(
  date, date, integer, text, text, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(
  date, date, integer, text, text, text, text, text, text, text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
