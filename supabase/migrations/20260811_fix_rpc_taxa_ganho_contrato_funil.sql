-------------------------------------------------------------------------------
-- Mantem a RPC legada de taxa de ganho no mesmo contrato da tela /bi/acoes.
--
-- A interface ja calcula ganhos / oportunidades que entraram no funil VENDAS
-- no periodo. Esta RPC havia ficado em uma versao anterior, que dividia por
-- ganhos + perdidos e ainda retornava o campo `perdidos` onde o cliente espera
-- `oportunidades`. A consulta replica explicitamente a mesma coorte da tela
-- para evitar duas definicoes diferentes do mesmo indicador.
-------------------------------------------------------------------------------

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
SET enable_nestloop = off
AS $$
  WITH negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vendedores,
      n.cli_idcliente
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT
      b.ngo_numero,
      b.ngo_conclusao,
      b.ngo_funil,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
    FROM negocios_base b
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
  ),
  primeira_entrada_vendas AS MATERIALIZED (
    SELECT
      fe.ngo_numero,
      MIN(fe.fne_dthinicioetapa::date) AS data_entrada_vendas
    FROM mirror.crm_funil_etapa fe
    WHERE UPPER(TRIM(COALESCE(fe.funil_dsc, ''))) = 'VENDAS'
      AND fe.fne_dthinicioetapa IS NOT NULL
    GROUP BY fe.ngo_numero
  ),
  oportunidades AS MATERIALIZED (
    SELECT COUNT(*)::int AS quantidade
    FROM primeira_entrada_vendas ev
    JOIN negocios_canonicos n ON n.ngo_numero = ev.ngo_numero
    WHERE (p_from IS NULL OR ev.data_entrada_vendas >= p_from)
      AND (p_to IS NULL OR ev.data_entrada_vendas <= p_to)
      AND n.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR n.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR n.cidade_negocio = p_cidade)
  ),
  pedidos_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_dthaprovacao,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    WHERE p.pdo_codigointerno IS NOT NULL
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  ganhos AS MATERIALIZED (
    SELECT COUNT(*)::int AS quantidade
    FROM pedidos_canonicos p
    JOIN negocios_canonicos n ON n.ngo_numero = p.ngo_numero
    WHERE p.pdo_situacaopedido = 'Aprovado'
      AND n.ngo_conclusao = 'Ganho'
      AND n.ngo_funil <> 'REPASSE DE MAQUINA'
      AND p.pdo_dthaprovacao IS NOT NULL
      AND (p_from IS NULL OR p.pdo_dthaprovacao::date >= p_from)
      AND (p_to IS NULL OR p.pdo_dthaprovacao::date <= p_to)
      AND (p_vendedor IS NULL OR n.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR n.cidade_negocio = p_cidade)
  ),
  totais AS (
    SELECT
      ganhos.quantidade AS ganhos,
      oportunidades.quantidade AS oportunidades
    FROM ganhos
    CROSS JOIN oportunidades
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
  'BI Acoes: ganhos do periodo / negocios cuja primeira entrada no funil VENDAS ocorreu no mesmo periodo. Perdidos nao entram no denominador.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  TO authenticated, service_role;
