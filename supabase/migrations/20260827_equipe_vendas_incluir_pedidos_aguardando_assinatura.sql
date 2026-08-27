CREATE OR REPLACE FUNCTION public.rpc_equipe_desempenho_mensal(p_ano integer, p_consultor text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'mirror'
 SET statement_timeout TO '20s'
 SET enable_nestloop TO 'off'
AS $function$
  WITH
  limites AS (
    SELECT make_date(p_ano, 1, 1) AS inicio,
           make_date(p_ano + 1, 1, 1) AS fim
  ),
  meses AS (
    SELECT periodo::date AS competencia,
           (periodo + interval '1 month - 1 day')::date AS fechamento
    FROM limites,
      generate_series(inicio, fim - interval '1 month', interval '1 month') AS periodo
  ),
  -- crm_negocios é desnormalizada por produto. Todas as métricas financeiras
  -- abaixo partem de uma única versão de cada NGO_Numero.
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vendedores,
      n.ngo_vlrtotalnegociado,
      n.ngo_datacadastro,
      n.ngo_etapa,
      n.cli_idcliente,
      n.emp_cidade
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
      AND n.ngo_numero <> ''
    ORDER BY n.ngo_numero,
      n.ngo_dataatualizacao DESC NULLS LAST,
      n.dthregistro DESC NULLS LAST
  ),
  negocios_com_consultor AS MATERIALIZED (
    SELECT
      n.*,
      COALESCE(NULLIF(BTRIM(u.usr_nomeusuario), ''), NULLIF(BTRIM(n.ngo_vendedores), ''), 'Sem consultor') AS consultor,
      -- Cidade da empresa no próprio negócio. A resolução de cidade da
      -- carteira chama uma função por linha e tornava a consulta anual lenta;
      -- para a análise de equipe, esta dimensão é somente um filtro opcional.
      n.emp_cidade AS cidade
    FROM negocios_base n
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(BTRIM(n.ngo_vendedores), '')
  ),
  -- A fotografia mensal do funil usa a etapa que estava aberta no último dia
  -- do mês. A data de saída é essencial para que negócio já avançado não fique
  -- acumulado nas três colunas ao mesmo tempo.
  funil_aberto AS MATERIALIZED (
    SELECT
      m.competencia,
      nc.consultor,
      CASE UPPER(BTRIM(COALESCE(nc.ngo_etapa, '')))
        WHEN '1-OPORTUNIDADE' THEN 'OPORTUNIDADE'
        WHEN '2-COTACAO' THEN 'COTACAO'
        WHEN '3-PROPOSTA AO CLIENTE' THEN 'PROPOSTA AO CLIENTE'
      END AS etapa,
      nc.ngo_vlrtotalnegociado AS valor
    FROM meses m
    JOIN negocios_com_consultor nc ON true
    WHERE nc.ngo_datacadastro::date >= make_date(p_ano, 1, 1)
      AND nc.ngo_datacadastro::date <= LEAST(m.fechamento, CURRENT_DATE)
      AND UPPER(BTRIM(COALESCE(nc.ngo_funil, ''))) = 'VENDAS'
      AND UPPER(BTRIM(COALESCE(nc.ngo_etapa, ''))) IN (
        '1-OPORTUNIDADE',
        '2-COTACAO',
        '3-PROPOSTA AO CLIENTE'
      )
      AND (p_consultor IS NULL OR nc.consultor = p_consultor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
  ),
  funil_por_consultor AS MATERIALIZED (
    SELECT
      competencia,
      consultor,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'OPORTUNIDADE'), 0) AS oportunidade,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'COTACAO'), 0) AS cotacao,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'PROPOSTA AO CLIENTE'), 0) AS proposta
    FROM funil_aberto
    GROUP BY competencia, consultor
  ),
  pedidos_base AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_dthaprovacao,
      p.pdo_dthpedido,
      p.pdo_vlrpedido,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    WHERE p.pdo_codigointerno IS NOT NULL
      AND p.pdo_codigointerno <> ''
    ORDER BY p.pdo_codigointerno,
      p.pdo_dthaprovacao DESC NULLS LAST,
      p.dthregistro DESC NULLS LAST
  ),
  vendas_por_consultor AS MATERIALIZED (
    SELECT
      date_trunc('month', COALESCE(p.pdo_dthaprovacao, p.pdo_dthpedido))::date AS competencia,
      nc.consultor,
      COUNT(*)::bigint AS negocios,
      COALESCE(SUM(p.pdo_vlrpedido), 0) AS total_venda
    FROM pedidos_base p
    JOIN negocios_com_consultor nc ON nc.ngo_numero = p.ngo_numero
    JOIN limites l ON true
    WHERE (
      p.pdo_situacaopedido = 'Aprovado'
      OR (
        p.pdo_situacaopedido IN ('Aguardando Assinatura Cliente', 'Aguardando Aprovação', 'Sem Situação')
        AND nc.ngo_conclusao = 'Ganho'
      )
    )
      AND COALESCE(p.pdo_dthaprovacao, p.pdo_dthpedido) >= l.inicio
      AND COALESCE(p.pdo_dthaprovacao, p.pdo_dthpedido) < l.fim
      AND nc.ngo_conclusao = 'Ganho'
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND (p_consultor IS NULL OR nc.consultor = p_consultor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
    GROUP BY 1, 2
  ),
  acoes_por_consultor AS MATERIALIZED (
    SELECT
      date_trunc('month', a.aco_dthconclusao)::date AS competencia,
      COALESCE(NULLIF(BTRIM(a.aco_vendedor), ''), 'Sem consultor') AS consultor,
      COUNT(DISTINCT a.cli_idcliente)::bigint AS clientes,
      COUNT(DISTINCT a.cli_idcliente) FILTER (
        WHERE a.aco_tipoacao = '1 - Prospecção Maq'
      )::bigint AS prospeccao_maquina
    FROM mirror.crm_acoes a
    JOIN limites l ON true
    WHERE a.aco_dthconclusao >= l.inicio
      AND a.aco_dthconclusao < l.fim
      AND (p_consultor IS NULL OR a.aco_vendedor = p_consultor)
      AND (
        p_cidade IS NULL
        OR a.emp_cidade = p_cidade
      )
    GROUP BY 1, 2
  ),
  -- O total da equipe não pode somar os distintos de cada consultor: um mesmo
  -- cliente pode ter sido atendido por duas pessoas. Esta CTE preserva o
  -- distinto global que aparece na planilha de referência.
  acoes_equipe AS MATERIALIZED (
    SELECT
      date_trunc('month', a.aco_dthconclusao)::date AS competencia,
      COUNT(DISTINCT a.cli_idcliente)::bigint AS clientes,
      COUNT(DISTINCT a.cli_idcliente) FILTER (
        WHERE a.aco_tipoacao = '1 - Prospecção Maq'
      )::bigint AS prospeccao_maquina
    FROM mirror.crm_acoes a
    JOIN limites l ON true
    WHERE a.aco_dthconclusao >= l.inicio
      AND a.aco_dthconclusao < l.fim
      AND (p_consultor IS NULL OR a.aco_vendedor = p_consultor)
      AND (p_cidade IS NULL OR a.emp_cidade = p_cidade)
    GROUP BY 1
  ),
  consultores AS MATERIALIZED (
    SELECT DISTINCT consultor
    FROM (
      SELECT NULLIF(BTRIM(u.usr_nomeusuario), '') AS consultor
      FROM mirror.usuarios u
      WHERE u.usr_tipousuario = 'V'
        AND p_cidade IS NULL
      UNION ALL
      SELECT consultor FROM funil_aberto
      UNION ALL
      SELECT consultor FROM vendas_por_consultor
      UNION ALL
      SELECT consultor FROM acoes_por_consultor
      UNION ALL
      SELECT mc.consultor
      FROM public.metas_consultor_mensal mc
      JOIN limites l ON true
      WHERE mc.competencia >= l.inicio
        AND mc.competencia < l.fim
    ) origem
    WHERE consultor IS NOT NULL
      AND consultor <> ''
      AND (p_consultor IS NULL OR consultor = p_consultor)
  ),
  linhas_base AS MATERIALIZED (
    SELECT
      m.competencia,
      c.consultor,
      COALESCE(f.oportunidade, 0) AS oportunidade,
      COALESCE(f.cotacao, 0) AS cotacao,
      COALESCE(f.proposta, 0) AS proposta,
      COALESCE(meta.meta, 0) AS meta,
      COALESCE(v.total_venda, 0) AS total_venda,
      COALESCE(v.negocios, 0)::bigint AS negocios,
      COALESCE(a.clientes, 0)::bigint AS clientes,
      COALESCE(a.prospeccao_maquina, 0)::bigint AS prospeccao_maquina
    FROM meses m
    CROSS JOIN consultores c
    LEFT JOIN funil_por_consultor f
      ON f.competencia = m.competencia AND f.consultor = c.consultor
    LEFT JOIN vendas_por_consultor v
      ON v.competencia = m.competencia AND v.consultor = c.consultor
    LEFT JOIN acoes_por_consultor a
      ON a.competencia = m.competencia AND a.consultor = c.consultor
    LEFT JOIN public.metas_consultor_mensal meta
      ON meta.competencia = m.competencia AND meta.consultor = c.consultor
  ),
  linhas_com_total AS MATERIALIZED (
    SELECT
      *,
      oportunidade + cotacao + proposta AS total,
      LAG(oportunidade + cotacao + proposta) OVER (
        PARTITION BY consultor
        ORDER BY competencia
      ) AS total_mes_anterior
    FROM linhas_base
  ),
  linhas AS MATERIALIZED (
    SELECT
      competencia,
      consultor,
      oportunidade,
      cotacao,
      proposta,
      total,
      CASE
        WHEN total_mes_anterior IS NULL OR total_mes_anterior = 0 THEN NULL
        ELSE ROUND(((total / total_mes_anterior) - 1) * 100, 2)
      END AS crescimento_oportunidade,
      NULLIF(meta, 0) AS meta,
      total_venda,
      CASE
        WHEN meta = 0 THEN NULL
        ELSE ROUND((total_venda / meta) * 100, 2)
      END AS desempenho_meta,
      negocios,
      CASE
        WHEN negocios = 0 THEN NULL
        ELSE ROUND(total_venda / negocios, 2)
      END AS ticket_medio,
      clientes,
      CASE
        WHEN clientes = 0 THEN NULL
        ELSE ROUND((negocios::numeric / clientes) * 100, 2)
      END AS taxa_conversao_negocios,
      prospeccao_maquina,
      CASE
        WHEN prospeccao_maquina = 0 THEN NULL
        ELSE ROUND((negocios::numeric / prospeccao_maquina) * 100, 2)
      END AS taxa_conversao_maquina
    FROM linhas_com_total
  ),
  equipe_base AS MATERIALIZED (
    SELECT
      competencia,
      SUM(oportunidade) AS oportunidade,
      SUM(cotacao) AS cotacao,
      SUM(proposta) AS proposta,
      SUM(meta) AS meta,
      SUM(total_venda) AS total_venda,
      SUM(negocios)::bigint AS negocios,
      COALESCE(MAX(ae.clientes), 0)::bigint AS clientes,
      COALESCE(MAX(ae.prospeccao_maquina), 0)::bigint AS prospeccao_maquina
    FROM linhas_base
    LEFT JOIN acoes_equipe ae USING (competencia)
    GROUP BY competencia
  ),
  equipe_com_total AS MATERIALIZED (
    SELECT
      *,
      oportunidade + cotacao + proposta AS total,
      LAG(oportunidade + cotacao + proposta) OVER (ORDER BY competencia) AS total_mes_anterior
    FROM equipe_base
  ),
  equipe AS MATERIALIZED (
    SELECT
      competencia,
      oportunidade,
      cotacao,
      proposta,
      total,
      CASE
        WHEN total_mes_anterior IS NULL OR total_mes_anterior = 0 THEN NULL
        ELSE ROUND(((total / total_mes_anterior) - 1) * 100, 2)
      END AS crescimento_oportunidade,
      NULLIF(meta, 0) AS meta,
      total_venda,
      CASE WHEN meta = 0 THEN NULL ELSE ROUND((total_venda / meta) * 100, 2) END AS desempenho_meta,
      negocios,
      CASE WHEN negocios = 0 THEN NULL ELSE ROUND(total_venda / negocios, 2) END AS ticket_medio,
      clientes,
      CASE WHEN clientes = 0 THEN NULL ELSE ROUND((negocios::numeric / clientes) * 100, 2) END AS taxa_conversao_negocios,
      prospeccao_maquina,
      CASE WHEN prospeccao_maquina = 0 THEN NULL ELSE ROUND((negocios::numeric / prospeccao_maquina) * 100, 2) END AS taxa_conversao_maquina
    FROM equipe_com_total
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(l) ORDER BY l.consultor, l.competencia)
      FROM linhas l
    ), '[]'::jsonb),
    'team', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.competencia)
      FROM equipe e
    ), '[]'::jsonb)
  );
$function$




CREATE OR REPLACE FUNCTION public.rpc_consultores_resumo_acoes(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_vendedor text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text, p_tipo_acao text DEFAULT NULL::text)
 RETURNS TABLE(consultor text, acoes bigint, visitas bigint, clientes bigint, crm_quality integer, negocios_abertos_tocados bigint, carteira_ativa_trabalhada numeric, oportunidades_geradas bigint, oportunidades_abertas bigint, pipeline_aberto_gerado numeric, ganhos bigint, valor_ganho numeric, perdidos bigint, valor_perdido numeric, taxa_ganho numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'mirror'
 SET enable_nestloop TO 'off'
AS $function$
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
      p.pdo_dthpedido,
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
    WHERE (
      pc.pdo_situacaopedido = 'Aprovado'
      OR (
        pc.pdo_situacaopedido IN ('Aguardando Assinatura Cliente', 'Aguardando Aprovação', 'Sem Situação')
        AND nc.ngo_conclusao = 'Ganho'
      )
    )
      AND (p_from IS NULL OR COALESCE(pc.pdo_dthaprovacao, pc.pdo_dthpedido)::date >= p_from)
      AND (p_to IS NULL OR COALESCE(pc.pdo_dthaprovacao, pc.pdo_dthpedido)::date <= p_to)
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
$function$

