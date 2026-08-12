-------------------------------------------------------------------------------
-- Evita planos genericos com nested loop nas duas agregacoes mais caras do BI.
--
-- As RPCs recebem filtros opcionais e o PostgREST reutiliza a conexao/plano.
-- Com os parametros genericos, o otimizador escolhia nested loops que varriam
-- repetidamente as tabelas espelho. A regra de negocio e o SQL das funcoes
-- permanecem inalterados; esta configuracao so restringe o tipo de plano
-- escolhido durante a execucao de cada uma delas.
--
-- Medicao no banco de producao (janela 2026-08-01..11):
--   rpc_acoes_funil_gestao_periodo: ~2,75 s -> ~0,77 s
--   rpc_pedidos_bi:                 ~1,25 s -> ~0,03 s
-------------------------------------------------------------------------------

BEGIN;

ALTER FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  SET enable_nestloop = off;

ALTER FUNCTION public.rpc_pedidos_bi(date, date, text, text)
  SET enable_nestloop = off;

COMMIT;
