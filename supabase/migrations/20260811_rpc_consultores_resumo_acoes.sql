-- Resumo de consultores alinhado ao contrato validado em /bi/acoes.
--
-- Atividade (acoes/visitas/clientes) pertence a quem executou a acao.
-- Valores de negocio pertencem ao dono atual do negocio canonico.
-- "Carteira ativa trabalhada" e o mesmo conjunto do card homonimo em Acoes:
-- negocio Em Andamento, fora de Repasse de Maquina e com acao no periodo.

CREATE OR REPLACE FUNCTION public.rpc_consultores_resumo_acoes(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL
)
RETURNS TABLE(
  consultor text,
  acoes bigint,
  visitas bigint,
  clientes bigint,
  crm_quality integer,
  negocios_abertos_tocados bigint,
  carteira_ativa_trabalhada numeric,
  oportunidades_geradas bigint,
  oportunidades_abertas bigint,
  pipeline_aberto_gerado numeric,
  ganhos bigint,
  valor_ganho numeric,
  perdidos bigint,
  valor_perdido numeric,
  taxa_ganho numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH acoes_filtradas AS MATERIALIZED (
    SELECT
      a.aco_vendedor AS consultor,
      a.cli_nome,
      a.aco_tipocontato,
      a.aco_atividadeexecutada
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_cidade IS NULL
        OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
      -- A tela Acoes nao usa tipo de acao nos indicadores de negocio. Aqui o
      -- filtro tambem fica restrito a atividade, para manter o mesmo contrato.
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
  ),
  atividade_por_consultor AS MATERIALIZED (
    SELECT
      af.consultor,
      COUNT(*) AS acoes,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(af.aco_tipocontato, '')) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT af.cli_nome) AS clientes,
      CASE WHEN COUNT(*) > 0
        THEN (
          COUNT(*) FILTER (
            WHERE af.aco_atividadeexecutada IS NOT NULL
              AND af.aco_atividadeexecutada <> ''
          ) * 100 / COUNT(*)
        )::integer
        ELSE 0
      END AS crm_quality
    FROM acoes_filtradas af
    WHERE af.consultor IS NOT NULL
      AND af.consultor <> ''
    GROUP BY af.consultor
  ),
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_datafechamento,
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
      nb.ngo_numero,
      nb.ngo_conclusao,
      nb.ngo_funil,
      nb.ngo_datafechamento,
      nb.ngo_vlrtotalnegociado,
      nb.cli_idcliente,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(nb.cli_idcliente) AS cidade_negocio
    FROM negocios_base nb
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(nb.ngo_vendedores, '')
  ),
  -- Mesmo recorte da Carteira Ativa Trabalhada de /bi/acoes. A acao serve
  -- apenas para provar que o negocio foi trabalhado; o valor e do negocio.
  acoes_periodo_carteira AS MATERIALIZED (
    SELECT DISTINCT a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.ngo_nronegocio IS NOT NULL
      AND a.ngo_nronegocio <> ''
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  ),
  carteira_por_consultor AS MATERIALIZED (
    SELECT
      nc.consultor_negocio AS consultor,
      COUNT(*) AS negocios_abertos_tocados,
      COALESCE(SUM(nc.ngo_vlrtotalnegociado), 0) AS carteira_ativa_trabalhada
    FROM acoes_periodo_carteira ap
    JOIN negocios_canonicos nc ON nc.ngo_numero = ap.ngo_nronegocio
    WHERE nc.ngo_conclusao = 'Em Andamento'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.consultor_negocio IS NOT NULL
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
    GROUP BY nc.consultor_negocio
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
  oportunidades_por_consultor AS MATERIALIZED (
    SELECT
      nc.consultor_negocio AS consultor,
      COUNT(*) AS oportunidades_geradas,
      COUNT(*) FILTER (WHERE nc.ngo_conclusao = 'Em Andamento') AS oportunidades_abertas,
      COALESCE(SUM(nc.ngo_vlrtotalnegociado) FILTER (
        WHERE nc.ngo_conclusao = 'Em Andamento'
      ), 0) AS pipeline_aberto_gerado
    FROM primeira_entrada_vendas ev
    JOIN negocios_canonicos nc ON nc.ngo_numero = ev.ngo_numero
    WHERE (p_from IS NULL OR ev.data_entrada_vendas >= p_from)
      AND (p_to IS NULL OR ev.data_entrada_vendas <= p_to)
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.consultor_negocio IS NOT NULL
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
    GROUP BY nc.consultor_negocio
  ),
  pedidos_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_dthaprovacao,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    WHERE p.pdo_codigointerno IS NOT NULL
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  ganhos_por_consultor AS MATERIALIZED (
    SELECT
      nc.consultor_negocio AS consultor,
      COUNT(*) AS ganhos,
      COALESCE(SUM(pc.pdo_vlrpedido), 0) AS valor_ganho
    FROM pedidos_canonicos pc
    JOIN negocios_canonicos nc ON nc.ngo_numero = pc.ngo_numero
    WHERE pc.pdo_situacaopedido = 'Aprovado'
      AND pc.pdo_dthaprovacao IS NOT NULL
      AND (p_from IS NULL OR pc.pdo_dthaprovacao::date >= p_from)
      AND (p_to IS NULL OR pc.pdo_dthaprovacao::date <= p_to)
      AND nc.ngo_conclusao = 'Ganho'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.consultor_negocio IS NOT NULL
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
    GROUP BY nc.consultor_negocio
  ),
  perdidos_por_consultor AS MATERIALIZED (
    SELECT
      nc.consultor_negocio AS consultor,
      COUNT(*) AS perdidos,
      COALESCE(SUM(nc.ngo_vlrtotalnegociado), 0) AS valor_perdido
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao = 'Perdido'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.ngo_datafechamento IS NOT NULL
      AND (p_from IS NULL OR nc.ngo_datafechamento::date >= p_from)
      AND (p_to IS NULL OR nc.ngo_datafechamento::date <= p_to)
      AND nc.consultor_negocio IS NOT NULL
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
    GROUP BY nc.consultor_negocio
  ),
  -- A tela de Consultores precisa manter visivel toda a equipe comercial,
  -- inclusive quem zerou no mes selecionado. Fora de um filtro de cidade,
  -- a fonte oficial dessa lista e o cadastro de usuarios do tipo Vendas.
  -- Executores ou donos de negocio que nao sejam desse tipo continuam vindo
  -- pelas CTEs metricas abaixo, caso tenham movimento no recorte.
  consultores_cadastrados AS MATERIALIZED (
    SELECT DISTINCT NULLIF(TRIM(u.usr_nomeusuario), '') AS consultor
    FROM mirror.usuarios u
    WHERE u.usr_tipousuario = 'V'
      AND NULLIF(TRIM(u.usr_nomeusuario), '') IS NOT NULL
      AND p_cidade IS NULL
      AND (p_vendedor IS NULL OR u.usr_nomeusuario = p_vendedor)
  ),
  consultores AS (
    SELECT consultor FROM consultores_cadastrados
    UNION
    SELECT consultor FROM atividade_por_consultor
    UNION
    SELECT consultor FROM carteira_por_consultor
    UNION
    SELECT consultor FROM oportunidades_por_consultor
    UNION
    SELECT consultor FROM ganhos_por_consultor
    UNION
    SELECT consultor FROM perdidos_por_consultor
  )
  SELECT
    c.consultor,
    COALESCE(a.acoes, 0)::bigint,
    COALESCE(a.visitas, 0)::bigint,
    COALESCE(a.clientes, 0)::bigint,
    COALESCE(a.crm_quality, 0)::integer,
    COALESCE(ca.negocios_abertos_tocados, 0)::bigint,
    COALESCE(ca.carteira_ativa_trabalhada, 0)::numeric,
    COALESCE(o.oportunidades_geradas, 0)::bigint,
    COALESCE(o.oportunidades_abertas, 0)::bigint,
    COALESCE(o.pipeline_aberto_gerado, 0)::numeric,
    COALESCE(g.ganhos, 0)::bigint,
    COALESCE(g.valor_ganho, 0)::numeric,
    COALESCE(p.perdidos, 0)::bigint,
    COALESCE(p.valor_perdido, 0)::numeric,
    ROUND(
      COALESCE(g.ganhos, 0)::numeric * 100
      / NULLIF(COALESCE(o.oportunidades_geradas, 0), 0),
      1
    ) AS taxa_ganho
  FROM consultores c
  LEFT JOIN atividade_por_consultor a ON a.consultor = c.consultor
  LEFT JOIN carteira_por_consultor ca ON ca.consultor = c.consultor
  LEFT JOIN oportunidades_por_consultor o ON o.consultor = c.consultor
  LEFT JOIN ganhos_por_consultor g ON g.consultor = c.consultor
  LEFT JOIN perdidos_por_consultor p ON p.consultor = c.consultor
  -- Ranking comercial: faturamento vendido no calendario; em empate,
  -- visitas e depois acoes realizadas. Carteira nao define posicao.
  ORDER BY
    COALESCE(g.valor_ganho, 0) DESC,
    COALESCE(a.visitas, 0) DESC,
    COALESCE(a.acoes, 0) DESC,
    c.consultor;
$$;

COMMENT ON FUNCTION public.rpc_consultores_resumo_acoes(date, date, text, text, text) IS
  'Visao de Consultores alinhada a /bi/acoes. Lista inclui todos os usuarios do tipo Vendas; ranking por valor ganho, visitas e acoes. Carteira Ativa Trabalhada: negocio canonico Em Andamento, sem Repasse de Maquina e com acao no periodo. Ganhos usam pedidos Aprovados e perdidos usam data de fechamento do negocio.';

REVOKE EXECUTE ON FUNCTION public.rpc_consultores_resumo_acoes(date, date, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_consultores_resumo_acoes(date, date, text, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
