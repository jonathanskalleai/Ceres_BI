-- Visao canônica da primeira aba de Vendas & Resultados.
--
-- O objetivo desta RPC não é criar uma terceira interpretação de resultado:
-- Ganhos, perdas e os dois recortes de pipeline são lidos das mesmas RPCs
-- auditadas em /bi/acoes. Os visuais acrescentam contexto de negócio usando
-- uma única linha vigente por NGO_Numero e o grão produto separado.

CREATE OR REPLACE FUNCTION public.rpc_resultados_negocios_bi(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH dados_acoes AS (
    SELECT public.rpc_acoes_bi_periodo(
      p_from,
      p_to,
      p_vendedor,
      NULL,
      p_cidade
    )::jsonb AS dados
  ),
  dados_funil AS (
    SELECT public.rpc_acoes_funil_gestao_periodo(
      p_from,
      p_to,
      p_vendedor,
      p_cidade
    )::jsonb AS dados
  ),
  -- crm_negocios é desnormalizada por item de produto. Esta CTE é o cabeçalho
  -- vigente do negócio; qualquer valor de negócio é calculado somente daqui.
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_etapa,
      n.ngo_vlrtotalnegociado,
      n.ngo_probabilidade,
      n.ngo_dataprevisao,
      n.ngo_formaentrada,
      n.ngo_motivoperda,
      n.ngo_vendedores,
      n.cli_idcliente,
      n.ngo_datafechamento
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
      AND n.ngo_numero <> ''
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT
      nb.*,
      NULLIF(BTRIM(u.usr_nomeusuario), '') AS consultor,
      mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade
    FROM negocios_base nb
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(BTRIM(nb.ngo_vendedores), '')
  ),
  -- Mesmo conjunto da "Carteira Ativa Trabalhada" de Ações: o vendedor
  -- escolhido precisa ter executado a ação e ser o dono atual do negócio.
  acoes_periodo AS MATERIALIZED (
    SELECT DISTINCT a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND a.ngo_nronegocio IS NOT NULL
      AND a.ngo_nronegocio <> ''
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  ),
  carteira_ativa AS MATERIALIZED (
    SELECT nc.*
    FROM acoes_periodo ap
    JOIN negocios_canonicos nc ON nc.ngo_numero = ap.ngo_nronegocio
    WHERE nc.ngo_conclusao = 'Em Andamento'
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
  ),
  funil_por_etapa AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(ngo_etapa), ''), 'Sem etapa') AS name,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(ngo_vlrtotalnegociado), 0)::numeric AS valor
      FROM carteira_ativa
      GROUP BY 1
    ) sub
  ),
  previsao_90_dias AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS dados
    FROM (
      SELECT
        TO_CHAR(date_trunc('month', ngo_dataprevisao), 'YYYY-MM') AS name,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(ngo_vlrtotalnegociado), 0)::numeric AS "valorBruto",
        COALESCE(SUM(
          ngo_vlrtotalnegociado
          * LEAST(GREATEST(COALESCE(NULLIF(BTRIM(ngo_probabilidade), '')::numeric, 0), 0), 5)
          / 5.0
        ), 0)::numeric AS "valorPonderado"
      FROM carteira_ativa
      WHERE ngo_dataprevisao::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 90)
      GROUP BY 1
    ) sub
  ),
  origem_lead AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.negocios DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(ngo_formaentrada), ''), 'Não informado') AS name,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(ngo_vlrtotalnegociado), 0)::numeric AS valor
      FROM carteira_ativa
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT 8
    ) sub
  ),
  -- Produtos mantêm o grão produto. O chart não soma valor negociado: um
  -- negócio pode ter vários itens e o valor do cabeçalho se repete nas linhas.
  produtos_carteira AS MATERIALIZED (
    SELECT DISTINCT
      n.ngo_numero,
      COALESCE(NULLIF(BTRIM(n.prd_grupoproduto), ''), 'Não informado') AS grupo,
      COALESCE(
        NULLIF(BTRIM(n.prd_idnegocioxproduto), ''),
        NULLIF(BTRIM(n.prd_dscproduto), ''),
        n.ctid::text
      ) AS produto_chave
    FROM mirror.crm_negocios n
    JOIN carteira_ativa ca ON ca.ngo_numero = n.ngo_numero
  ),
  equipamentos_pipeline AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.itens DESC), '[]'::json) AS dados
    FROM (
      SELECT
        grupo AS name,
        COUNT(*)::int AS itens,
        COUNT(DISTINCT ngo_numero)::int AS negocios
      FROM produtos_carteira
      GROUP BY grupo
      ORDER BY COUNT(*) DESC
      LIMIT 10
    ) sub
  ),
  perdas_periodo AS MATERIALIZED (
    SELECT nc.*
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao = 'Perdido'
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
  ),
  motivos_perda AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS dados
    FROM (
      SELECT
        COALESCE(NULLIF(BTRIM(ngo_motivoperda), ''), 'Não informado') AS name,
        COUNT(*)::int AS negocios,
        COALESCE(SUM(ngo_vlrtotalnegociado), 0)::numeric AS valor
      FROM perdas_periodo
      GROUP BY 1
      ORDER BY SUM(ngo_vlrtotalnegociado) DESC
      LIMIT 8
    ) sub
  ),
  cobertura AS (
    SELECT json_build_object(
      'carteiraAtiva', COUNT(*),
      'comOrigem', COUNT(*) FILTER (WHERE NULLIF(BTRIM(ngo_formaentrada), '') IS NOT NULL),
      'comDataPrevisao', COUNT(*) FILTER (WHERE ngo_dataprevisao IS NOT NULL),
      'previstos90Dias', COUNT(*) FILTER (
        WHERE ngo_dataprevisao::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 90)
      )
    ) AS dados
    FROM carteira_ativa
  )
  SELECT json_build_object(
    'kpis', json_build_object(
      'pedidosGanhos', COALESCE((a.dados->'kpis'->>'negociosGanho')::int, 0),
      'valorGanho', COALESCE((a.dados->'kpis'->>'valorGanho')::numeric, 0),
      'negociosPerdidos', COALESCE((a.dados->'kpis'->>'negociosPerdido')::int, 0),
      'valorPerdido', COALESCE((a.dados->'kpis'->>'valorPerdido')::numeric, 0),
      'pipelineGeradoAberto', COALESCE((f.dados->'funil'->>'oportunidadesAbertas')::int, 0),
      'valorPipelineGeradoAberto', COALESCE((f.dados->'funil'->>'valorOportunidadesAbertas')::numeric, 0),
      'carteiraAtivaTrabalhada', COALESCE((f.dados->'funil'->>'negociosAbertosTocadosNoPeriodo')::int, 0),
      'valorCarteiraAtivaTrabalhada', COALESCE((f.dados->'funil'->>'valorPipelineAbertoTocadoNoPeriodo')::numeric, 0)
    ),
    'funilPorEtapa', fp.dados,
    'previsao90Dias', p90.dados,
    'origemLead', ol.dados,
    'equipamentosPipeline', ep.dados,
    'motivosPerda', mp.dados,
    'cobertura', c.dados
  )
  FROM dados_acoes a
  CROSS JOIN dados_funil f
  CROSS JOIN funil_por_etapa fp
  CROSS JOIN previsao_90_dias p90
  CROSS JOIN origem_lead ol
  CROSS JOIN equipamentos_pipeline ep
  CROSS JOIN motivos_perda mp
  CROSS JOIN cobertura c;
$$;

COMMENT ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text) IS
  'Primeira aba de Vendas & Resultados. KPIs conciliados com Ações: ganho por pedido aprovado, perda por negócio fechado e pipelines por coorte/ação. Visuais: etapas da carteira ativa, projeção ponderada, origem, equipamentos e perdas.';

REVOKE EXECUTE ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
