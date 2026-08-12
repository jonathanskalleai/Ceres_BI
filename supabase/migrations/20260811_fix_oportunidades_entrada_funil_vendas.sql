-------------------------------------------------------------------------------
-- /bi/acoes: oportunidade = primeira entrada no funil VENDAS
--
-- Um negocio pode hoje estar em Vendas AP ou ADM porque avancou o processo,
-- mas continua sendo uma oportunidade comercial que nasceu no funil VENDAS.
-- Portanto, `ngo_funil` atual e `ngo_datacadastro` nao definem a oportunidade:
-- a fonte e o primeiro registro historico em crm_funil_etapa.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_funil_gestao_periodo(
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
  WITH base AS (
    SELECT public.rpc_acoes_funil_gestao(p_from, p_to, p_vendedor, p_cidade)::jsonb AS dados
  ),
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_etapa,
      n.ngo_vlrtotalnegociado,
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
      b.ngo_etapa,
      b.ngo_vlrtotalnegociado,
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
  coorte_oportunidades AS MATERIALIZED (
    SELECT nc.*
    FROM primeira_entrada_vendas ev
    JOIN negocios_canonicos nc ON nc.ngo_numero = ev.ngo_numero
    WHERE (p_from IS NULL OR ev.data_entrada_vendas >= p_from)
      AND (p_to IS NULL OR ev.data_entrada_vendas <= p_to)
      -- O funil de Repasse tambem pode transitar por uma etapa VENDAS, mas
      -- permanece fora da carteira comercial e dos indicadores desta tela.
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  coorte_agg AS (
    SELECT
      COUNT(*)::int AS oportunidades,
      COALESCE(SUM(ngo_vlrtotalnegociado), 0) AS valor_oportunidades,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Em Andamento')::int AS oportunidades_abertas,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE ngo_conclusao = 'Em Andamento'), 0)
        AS valor_oportunidades_abertas
    FROM coorte_oportunidades
  ),
  entradas_etapa_oportunidade AS MATERIALIZED (
    SELECT DISTINCT fe.ngo_numero
    FROM mirror.crm_funil_etapa fe
    JOIN negocios_canonicos nc ON nc.ngo_numero = fe.ngo_numero
    WHERE UPPER(TRIM(COALESCE(fe.funil_dsc, ''))) = 'VENDAS'
      AND UPPER(TRIM(COALESCE(fe.etapa_dscstatusnegocio, ''))) = 'OPORTUNIDADE'
      AND fe.fne_dthinicioetapa IS NOT NULL
      AND (p_from IS NULL OR fe.fne_dthinicioetapa::date >= p_from)
      AND (p_to IS NULL OR fe.fne_dthinicioetapa::date <= p_to)
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  etapa_agg AS (
    SELECT
      COUNT(*)::int AS entradas_etapa_oportunidade,
      COUNT(*) FILTER (
        WHERE nc.ngo_etapa = '1-OPORTUNIDADE'
          AND nc.ngo_conclusao = 'Em Andamento'
      )::int AS em_etapa_oportunidade
    FROM entradas_etapa_oportunidade ee
    JOIN negocios_canonicos nc ON nc.ngo_numero = ee.ngo_numero
  )
  SELECT (
    b.dados || jsonb_build_object(
      'funil',
      COALESCE(b.dados->'funil', '{}'::jsonb) || jsonb_build_object(
        'oportunidades', ca.oportunidades,
        'valorOportunidades', ca.valor_oportunidades,
        'oportunidadesAbertas', ca.oportunidades_abertas,
        'valorOportunidadesAbertas', ca.valor_oportunidades_abertas,
        'entradasEtapaOportunidade', ea.entradas_etapa_oportunidade,
        'emEtapaOportunidade', ea.em_etapa_oportunidade,
        'visitasPorOportunidade', ROUND(
          COALESCE((b.dados->'funil'->>'visitas')::numeric, 0) / NULLIF(ca.oportunidades, 0), 2
        ),
        'oportPorFechamento', ROUND(
          ca.oportunidades::numeric / NULLIF(COALESCE((b.dados->'funil'->>'ganhos')::numeric, 0), 0), 2
        )
      )
    )
  )::json
  FROM base b
  CROSS JOIN coorte_agg ca
  CROSS JOIN etapa_agg ea;
$$;

COMMENT ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text) IS
  'BI Acoes: oportunidades sao negocios cuja primeira entrada historica em crm_funil_etapa.funil_dsc=VENDAS ocorreu no intervalo. Inclui os que avancaram hoje para Vendas AP ou ADM e exclui Repasse de Maquina. A etapa 1-OPORTUNIDADE permanece indicador separado de etapa inicial.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  TO authenticated, service_role;
