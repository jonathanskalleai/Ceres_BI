-------------------------------------------------------------------------------
-- CREATE OR REPLACE da função de funil substituiu o SET de plano aplicado em
-- 20260811_optimize_planos_funil_e_pedidos.sql. Restaura o plano medido para
-- evitar nested loops caros no agregado da tela /bi/acoes.
-------------------------------------------------------------------------------

ALTER FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  SET enable_nestloop = off;

NOTIFY pgrst, 'reload schema';
