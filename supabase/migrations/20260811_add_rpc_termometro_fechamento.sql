-------------------------------------------------------------------------------
-- /bi/acoes: termometro de fechamento.
--
-- O painel e uma fila de priorizacao, nao um funil de etapas. A probabilidade
-- vem de NGO_Probabilidade (escala CRM 0–5 estrelas) e o valor e sempre
-- deduplicado por negocio, pois crm_negocios possui uma linha por produto.
--
-- Escopos:
--   ativos_periodo  negocio Em Andamento com acao concluida na janela
--   carteira_total  todo negocio Em Andamento, independente do calendario
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_termometro_fechamento(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_escopo text DEFAULT 'ativos_periodo'
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH config AS (
    SELECT CASE
      WHEN p_escopo = 'carteira_total' THEN 'carteira_total'
      ELSE 'ativos_periodo'
    END AS escopo
  ),
  -- Uma unica linha vigente por negocio. Esta deduplicacao e obrigatoria:
  -- cada produto do negocio gera uma linha no espelho do CRM.
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_etapa,
      n.ngo_vlrtotalnegociado,
      n.ngo_probabilidade,
      n.ngo_vendedores,
      n.cli_idcliente,
      n.cli_nome
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
      AND n.ngo_numero <> ''
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  produtos_por_negocio AS MATERIALIZED (
    SELECT
      n.ngo_numero,
      STRING_AGG(
        DISTINCT NULLIF(BTRIM(n.prd_dscproduto), ''),
        ' · ' ORDER BY NULLIF(BTRIM(n.prd_dscproduto), '')
      ) AS produto
    FROM mirror.crm_negocios n
    JOIN negocios_base nb ON nb.ngo_numero = n.ngo_numero
    GROUP BY n.ngo_numero
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT
      nb.*,
      ppn.produto,
      NULLIF(u.usr_nomeusuario, '') AS consultor,
      mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade
    FROM negocios_base nb
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = nb.ngo_numero
    LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(nb.ngo_vendedores, '')
  ),
  -- No escopo "ativos_periodo", a acao precisa ser da janela e do vendedor
  -- filtrado. O dono atual do negocio tambem e filtrado abaixo, como ocorre no
  -- card Carteira Ativa Trabalhada da mesma tela.
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
  elegiveis AS MATERIALIZED (
    SELECT
      nc.ngo_numero AS negocio,
      COALESCE(NULLIF(BTRIM(nc.cli_nome), ''), '<sem cliente>') AS cliente,
      nc.cli_idcliente AS cliente_id,
      COALESCE(NULLIF(nc.produto, ''), 'Produto não informado') AS produto,
      nc.ngo_etapa AS etapa,
      nc.consultor,
      COALESCE(nc.ngo_vlrtotalnegociado, 0)::numeric AS valor,
      -- O espelho historico armazena NGO_Probabilidade como texto, embora a
      -- origem CRM entregue a escala numerica de estrelas. Vazio vira 0.
      LEAST(GREATEST(COALESCE(NULLIF(BTRIM(nc.ngo_probabilidade), '')::int, 0), 0), 5)::int AS estrelas
    FROM negocios_canonicos nc
    CROSS JOIN config c
    LEFT JOIN acoes_periodo ap ON ap.ngo_nronegocio = nc.ngo_numero
    WHERE nc.ngo_conclusao = 'Em Andamento'
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
      AND (c.escopo = 'carteira_total' OR ap.ngo_nronegocio IS NOT NULL)
  ),
  resumo AS (
    SELECT
      COUNT(*)::int AS negocios,
      COUNT(DISTINCT cliente_id)::int AS clientes,
      COALESCE(SUM(valor), 0)::numeric AS "valorBruto",
      COALESCE(SUM(valor * estrelas / 5.0), 0)::numeric AS "valorPonderado",
      COUNT(*) FILTER (WHERE estrelas >= 4)::int AS "negociosQuentes",
      COALESCE(SUM(valor) FILTER (WHERE estrelas >= 4), 0)::numeric AS "valorQuente"
    FROM elegiveis
  ),
  faixas AS (
    SELECT
      s.estrela::int AS estrelas,
      COUNT(e.negocio)::int AS negocios,
      COUNT(DISTINCT e.cliente_id)::int AS clientes,
      COALESCE(SUM(e.valor), 0)::numeric AS valor,
      COALESCE(SUM(e.valor * e.estrelas / 5.0), 0)::numeric AS "valorPonderado"
    FROM generate_series(5, 0, -1) AS s(estrela)
    LEFT JOIN elegiveis e ON e.estrelas = s.estrela
    GROUP BY s.estrela
  ),
  -- A lista precisa continuar na rolagem do card; 50 mantem o payload leve na
  -- carteira total, sem esconder artificialmente a carteira ativa menor.
  prioridades AS (
    SELECT
      negocio,
      cliente,
      produto,
      etapa,
      consultor,
      valor,
      estrelas,
      (valor * estrelas / 5.0)::numeric AS "valorPonderado"
    FROM elegiveis
    ORDER BY estrelas DESC, valor DESC, negocio ASC
    LIMIT 50
  )
  SELECT json_build_object(
    'resumo', (SELECT row_to_json(r) FROM resumo r),
    'faixas', COALESCE((SELECT json_agg(row_to_json(f) ORDER BY f.estrelas DESC) FROM faixas f), '[]'::json),
    'prioridades', COALESCE((SELECT json_agg(row_to_json(p) ORDER BY p.estrelas DESC, p.valor DESC, p.negocio ASC) FROM prioridades p), '[]'::json)
  );
$$;

COMMENT ON FUNCTION public.rpc_acoes_termometro_fechamento(date, date, text, text, text) IS
  'Termometro de fechamento: carteira ativa no periodo ou carteira total aberta, agrupada por NGO_Probabilidade (0-5 estrelas), com valor ponderado e top prioridades.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_termometro_fechamento(date, date, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_termometro_fechamento(date, date, text, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
