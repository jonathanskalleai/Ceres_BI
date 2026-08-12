-- A RPC recebe filtros opcionais. Com um plano generico, o PostgreSQL estimava
-- uma linha e escolhia nested loop contra todos os negocios canonicos, mesmo
-- quando a pagina anual tinha milhares de acoes. Este ajuste vale apenas para
-- a funcao e permite o hash/merge join que o plano medido confirma ser rapido.
ALTER FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text)
  SET enable_nestloop = off;
