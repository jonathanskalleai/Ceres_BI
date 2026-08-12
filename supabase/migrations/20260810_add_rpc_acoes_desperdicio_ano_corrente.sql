-------------------------------------------------------------------------------
-- Lista "Muitas visitas, poucas oportunidades" no ano corrente
--
-- A tela /bi/acoes usa um intervalo mensal para os eventos e graficos. Esta
-- lista e de gestao de carteira: precisa revelar o esforco acumulado no ano,
-- nao resetar a cada mes. A lista de 3 perdas segue historica por definicao
-- (ultimos tres negocios de cada cliente) e nao e alterada aqui.
-------------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_acoes_desperdicio_ano_corrente(
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  SELECT public.rpc_acoes_gestao_listas(
    'desperdicio',
    date_trunc('year', CURRENT_DATE)::date,
    CURRENT_DATE,
    p_vendedor,
    p_cidade,
    p_limit,
    p_offset,
    p_search,
    NULL,
    NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text) IS
  'Gestao da carteira /bi/acoes: clientes com 3+ visitas e poucas oportunidades, acumulado de 1 de janeiro ate hoje no ano corrente. Delega ordenacao e regras a rpc_acoes_gestao_listas(''desperdicio'').';

COMMIT;
