-------------------------------------------------------------------------------
-- Taxa de ganho operacional de /bi/acoes
--
-- A regra e ganhos do periodo / oportunidades abertas tocadas por acoes no
-- mesmo periodo. Os perdidos sao um indicador separado e NAO entram na taxa.
-- Reutilizar rpc_acoes_funil_gestao impede que o card use oportunidade de
-- outro mes ou uma definicao diferente da exibida no proprio funil.
-------------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_acoes_taxa_ganho_negocios(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH funil AS (
    SELECT public.rpc_acoes_funil_gestao(p_from, p_to, p_vendedor, p_cidade)->'funil' AS dados
  ),
  totais AS (
    SELECT
      COALESCE((dados->>'ganhos')::int, 0) AS ganhos,
      COALESCE((dados->>'oportunidades')::int, 0) AS oportunidades
    FROM funil
  )
  SELECT json_build_object(
    'ganhos', ganhos,
    'oportunidades', oportunidades,
    'taxaGanho', CASE
      WHEN oportunidades = 0 THEN NULL
      ELSE ROUND(ganhos::numeric * 100 / oportunidades, 1)
    END
  )
  FROM totais;
$$;

COMMENT ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text) IS
  'BI Acoes: ganhos do periodo / oportunidades abertas tocadas por acoes no mesmo periodo. Perdidos nao entram. Delega o denominador a rpc_acoes_funil_gestao.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  TO authenticated, service_role;

COMMIT;
