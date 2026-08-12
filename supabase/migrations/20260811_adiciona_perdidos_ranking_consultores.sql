-------------------------------------------------------------------------------
-- /bi/acoes: adiciona a métrica Perdidos ao ranking de consultores.
--
-- O ranking já atribuía ganhos/pedidos aprovados ao dono do negócio. Agora
-- também atribui negócios Perdidos ao mesmo dono, pela data de fechamento.
-- Perdidos é uma métrica independente: não entra no cálculo da taxa de ganho.
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
      n.ngo_datafechamento,
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
      b.ngo_datafechamento,
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
  ),
  acoes_periodo AS MATERIALIZED (
    SELECT DISTINCT a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.ngo_nronegocio IS NOT NULL
      AND a.ngo_nronegocio <> ''
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  ),
  pipeline_aberto_ativo AS (
    SELECT DISTINCT nc.ngo_numero, nc.ngo_vlrtotalnegociado
    FROM acoes_periodo ap
    JOIN negocios_canonicos nc ON nc.ngo_numero = ap.ngo_nronegocio
    WHERE nc.ngo_conclusao = 'Em Andamento'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  pipeline_agg AS (
    SELECT
      COUNT(*)::int AS negocios_abertos_tocados,
      COALESCE(SUM(ngo_vlrtotalnegociado), 0) AS valor_pipeline_aberto_tocado
    FROM pipeline_aberto_ativo
  ),
  perdidos_por_consultor AS MATERIALIZED (
    SELECT
      nc.consultor_negocio AS consultor,
      COUNT(*)::int AS perdidos
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao = 'Perdido'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.ngo_datafechamento IS NOT NULL
      AND (p_from IS NULL OR nc.ngo_datafechamento::date >= p_from)
      AND (p_to IS NULL OR nc.ngo_datafechamento::date <= p_to)
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
      AND nc.consultor_negocio IS NOT NULL
    GROUP BY nc.consultor_negocio
  ),
  ranking_base AS MATERIALIZED (
    SELECT item, item->>'consultor' AS consultor
    FROM base b
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(b.dados->'rankingConsultores', '[]'::jsonb)
    ) AS ranking(item)
  ),
  ranking_enriquecido AS (
    SELECT jsonb_set(
      COALESCE(
        rb.item,
        jsonb_build_object(
          'consultor', pp.consultor,
          'visitas', 0,
          'oportunidades', 0,
          'ganhos', 0,
          'valorGanho', 0,
          'taxaConversao', NULL
        )
      ),
      '{perdidos}',
      to_jsonb(COALESCE(pp.perdidos, 0)),
      true
    ) AS item
    FROM ranking_base rb
    FULL OUTER JOIN perdidos_por_consultor pp
      ON pp.consultor = rb.consultor
  )
  SELECT (
    b.dados || jsonb_build_object(
      'rankingConsultores', COALESCE(
        (
          SELECT jsonb_agg(
            re.item
            ORDER BY COALESCE((re.item->>'visitas')::int, 0) DESC, re.item->>'consultor'
          )
          FROM ranking_enriquecido re
        ),
        '[]'::jsonb
      ),
      'funil',
      COALESCE(b.dados->'funil', '{}'::jsonb) || jsonb_build_object(
        'oportunidades', ca.oportunidades,
        'valorOportunidades', ca.valor_oportunidades,
        'oportunidadesAbertas', ca.oportunidades_abertas,
        'valorOportunidadesAbertas', ca.valor_oportunidades_abertas,
        'negociosAbertosTocadosNoPeriodo', pa.negocios_abertos_tocados,
        'valorPipelineAbertoTocadoNoPeriodo', pa.valor_pipeline_aberto_tocado,
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
  CROSS JOIN etapa_agg ea
  CROSS JOIN pipeline_agg pa;
$$;

COMMENT ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text) IS
  'BI Ações: oportunidades pela primeira entrada em VENDAS; ranking inclui visitas, oportunidades, ganhos, perdidos e valor ganho. Perdidos são negócios por data de fechamento; Repasse de Máquina é excluído.';

ALTER FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  SET enable_nestloop = off;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
