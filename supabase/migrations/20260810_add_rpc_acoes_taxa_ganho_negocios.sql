-------------------------------------------------------------------------------
-- Taxa de ganho dos negocios encerrados para /bi/acoes
--
-- A taxa usa somente NEGOCIOS e a mesma data de competencia nos dois lados:
--   Ganhos / (Ganhos + Perdidos), por ngo_datafechamento.
-- Nao usar pedidos aprovados como numerador: pedido e negocio sao objetos
-- diferentes, com datas diferentes, e essa mistura produziria uma conversao
-- aparentemente precisa, mas incorreta.
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
  WITH negocios_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_datafechamento,
      n.cli_idcliente,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(n.cli_idcliente) AS cidade_negocio
    FROM mirror.crm_negocios n
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(n.ngo_vendedores, '')
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  encerrados AS (
    SELECT ngo_conclusao
    FROM negocios_canonicos
    WHERE ngo_funil <> 'REPASSE DE MAQUINA'
      AND ngo_conclusao IN ('Ganho', 'Perdido')
      AND ngo_datafechamento IS NOT NULL
      AND (p_from IS NULL OR ngo_datafechamento::date >= p_from)
      AND (p_to IS NULL OR ngo_datafechamento::date <= LEAST(p_to, CURRENT_DATE))
      AND (p_vendedor IS NULL OR consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR cidade_negocio = p_cidade)
  ),
  totais AS (
    SELECT
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') AS ganhos,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Perdido') AS perdidos
    FROM encerrados
  )
  SELECT json_build_object(
    'ganhos', ganhos,
    'perdidos', perdidos,
    'taxaGanho', CASE
      WHEN ganhos + perdidos = 0 THEN NULL
      ELSE ROUND(ganhos::numeric * 100 / (ganhos + perdidos), 1)
    END
  )
  FROM totais;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text) IS
  'BI Acoes: taxa de ganho dos negocios encerrados. Formula ganhos/(ganhos+perdidos), negocio canonico, ngo_datafechamento, sem REPASSE DE MAQUINA.';

COMMIT;
