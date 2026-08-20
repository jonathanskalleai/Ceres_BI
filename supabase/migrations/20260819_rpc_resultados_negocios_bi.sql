-- Visão canônica da primeira aba de Vendas & Resultados.
--
-- Métricas de resultado preservam a regra auditada de /bi/acoes. Os novos
-- blocos transformam a junção de negócios, pedidos e ações em leitura de
-- gestão: trajetória anual, cenários e uma fila para a próxima ação comercial.

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
-- O recorte "Tudo" agrega todo o histórico de negócios, pedidos e ações.
-- O gateway REST usa um timeout menor que essa consulta analítica precisa.
SET statement_timeout = '60s'
AS $$
  WITH dados_acoes AS (
    SELECT public.rpc_acoes_bi_periodo(
      p_from, p_to, p_vendedor, NULL, p_cidade
    )::jsonb AS dados
  ),
  dados_funil AS (
    SELECT public.rpc_acoes_funil_gestao_periodo(
      p_from, p_to, p_vendedor, p_cidade
    )::jsonb AS dados
  ),
  -- crm_negocios tem uma linha por produto. Tudo que soma valor começa nesta
  -- dimensão de cabeçalho: exatamente uma versão vigente por NGO_Numero.
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_etapa,
      n.ngo_vlrtotalnegociado,
      n.ngo_probabilidade,
      n.ngo_dataprevisao,
      n.ngo_motivoperda,
      n.ngo_vendedores,
      n.cli_idcliente,
      n.cli_nome,
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
  -- Carteira trabalhada no intervalo: exatamente a definição que alimenta
  -- "Carteira Ativa Trabalhada" em Ações.
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
      LIMIT 6
    ) sub
  ),
  -- Grão produto só é usado para explicar a oportunidade priorizada; nunca
  -- para somar o valor de cabeçalho do negócio.
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
  ultima_acao AS MATERIALIZED (
    SELECT
      a.ngo_nronegocio,
      MAX(a.aco_dthconclusao::date) AS ultima_acao
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND a.ngo_nronegocio IS NOT NULL
      AND a.ngo_nronegocio <> ''
    GROUP BY a.ngo_nronegocio
  ),
  -- Esta é a carteira comercial existente hoje, independente da janela de
  -- ações. Fluxos de entrega/NPS não podem virar previsão de venda.
  carteira_aberta AS MATERIALIZED (
    SELECT
      nc.*,
      COALESCE(NULLIF(ppn.produto, ''), 'Produto não informado') AS produto,
      ua.ultima_acao,
      LEAST(GREATEST(COALESCE(NULLIF(BTRIM(nc.ngo_probabilidade), '')::int, 0), 0), 5)::int AS estrelas
    FROM negocios_canonicos nc
    LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = nc.ngo_numero
    LEFT JOIN ultima_acao ua ON ua.ngo_nronegocio = nc.ngo_numero
    WHERE nc.ngo_conclusao = 'Em Andamento'
      AND UPPER(BTRIM(COALESCE(nc.ngo_funil, ''))) IN ('VENDAS', 'VENDAS AP')
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
  ),
  -- Recorte acionável agora: previsão recente/futura ou ação nos últimos 90
  -- dias. Sem ele, negócios esquecidos há anos poluiriam a fila de decisão.
  carteira_monitorada AS MATERIALIZED (
    SELECT *
    FROM carteira_aberta
    WHERE ngo_dataprevisao::date >= CURRENT_DATE - 30
       OR ultima_acao >= CURRENT_DATE - 90
  ),
  saude_carteira AS (
    SELECT json_build_object(
      'abertos', COUNT(*),
      'semAcao15Dias', COUNT(*) FILTER (
        WHERE ultima_acao IS NULL OR ultima_acao < CURRENT_DATE - 15
      ),
      'valorSemAcao15Dias', COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (
        WHERE ultima_acao IS NULL OR ultima_acao < CURRENT_DATE - 15
      ), 0),
      'semPrevisao', COUNT(*) FILTER (WHERE ngo_dataprevisao IS NULL),
      'valorSemPrevisao', COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (
        WHERE ngo_dataprevisao IS NULL
      ), 0),
      'quentes', COUNT(*) FILTER (WHERE estrelas >= 4),
      'valorQuentes', COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (
        WHERE estrelas >= 4
      ), 0)
    ) AS dados
    FROM carteira_monitorada
  ),
  prioridades_fechamento AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.estrelas DESC, sub.previsao NULLS LAST, sub."valorPonderado" DESC), '[]'::json) AS dados
    FROM (
      SELECT
        ngo_numero AS negocio,
        COALESCE(NULLIF(BTRIM(cli_nome), ''), 'Cliente não informado') AS cliente,
        produto,
        COALESCE(NULLIF(BTRIM(ngo_etapa), ''), 'Sem etapa') AS etapa,
        ngo_dataprevisao::date AS previsao,
        CASE WHEN ultima_acao IS NULL THEN NULL ELSE (CURRENT_DATE - ultima_acao)::int END AS "diasSemAcao",
        estrelas,
        COALESCE(ngo_vlrtotalnegociado, 0)::numeric AS valor,
        COALESCE(ngo_vlrtotalnegociado, 0) * estrelas / 5.0 AS "valorPonderado"
      FROM carteira_monitorada
      WHERE ngo_dataprevisao::date >= CURRENT_DATE - 30
         OR (ngo_dataprevisao IS NULL AND ultima_acao >= CURRENT_DATE - 30)
      ORDER BY (ngo_dataprevisao IS NULL),
               ngo_dataprevisao ASC NULLS LAST,
               estrelas DESC,
               (COALESCE(ngo_vlrtotalnegociado, 0) * estrelas) DESC,
               ngo_numero ASC
      LIMIT 6
    ) sub
  ),
  -- Pedidos aprovados são o realizado. A mesma junção de Ações impede que
  -- pedido de negócio ainda não ganho ou de Repasse vire receita no gráfico.
  pedidos_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_dthaprovacao,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    WHERE p.pdo_codigointerno IS NOT NULL
      AND p.pdo_codigointerno <> ''
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  ganhos_ano AS MATERIALIZED (
    SELECT
      date_trunc('month', pc.pdo_dthaprovacao)::date AS mes,
      COALESCE(SUM(pc.pdo_vlrpedido), 0)::numeric AS valor
    FROM pedidos_canonicos pc
    JOIN negocios_canonicos nc ON nc.ngo_numero = pc.ngo_numero
    WHERE pc.pdo_situacaopedido = 'Aprovado'
      AND pc.pdo_dthaprovacao::date BETWEEN date_trunc('year', CURRENT_DATE)::date AND CURRENT_DATE
      AND nc.ngo_conclusao = 'Ganho'
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
    GROUP BY 1
  ),
  previsoes_futuras AS MATERIALIZED (
    SELECT
      date_trunc('month', ngo_dataprevisao)::date AS mes,
      COALESCE(SUM(ngo_vlrtotalnegociado * GREATEST(estrelas - 1, 0) / 5.0), 0)::numeric AS conservador,
      COALESCE(SUM(ngo_vlrtotalnegociado * estrelas / 5.0), 0)::numeric AS provavel,
      COALESCE(SUM(ngo_vlrtotalnegociado * LEAST(estrelas + 1, 5) / 5.0), 0)::numeric AS otimista
    FROM carteira_aberta
    WHERE ngo_dataprevisao::date >= CURRENT_DATE
      AND ngo_dataprevisao::date < (date_trunc('year', CURRENT_DATE) + INTERVAL '1 year')::date
    GROUP BY 1
  ),
  meses_ano AS MATERIALIZED (
    SELECT generate_series(
      date_trunc('year', CURRENT_DATE)::date,
      (date_trunc('year', CURRENT_DATE) + INTERVAL '11 months')::date,
      INTERVAL '1 month'
    )::date AS mes
  ),
  serie_base AS MATERIALIZED (
    SELECT
      m.mes,
      COALESCE(g.valor, 0)::numeric AS realizado,
      COALESCE(p.conservador, 0)::numeric AS conservador,
      COALESCE(p.provavel, 0)::numeric AS provavel,
      COALESCE(p.otimista, 0)::numeric AS otimista
    FROM meses_ano m
    LEFT JOIN ganhos_ano g ON g.mes = m.mes
    LEFT JOIN previsoes_futuras p ON p.mes = m.mes
  ),
  realizado_ytd AS (
    SELECT COALESCE(SUM(realizado), 0)::numeric AS valor
    FROM serie_base
    WHERE mes <= date_trunc('month', CURRENT_DATE)::date
  ),
  projecao_anual AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.mes), '[]'::json) AS dados
    FROM (
      SELECT
        sb.mes,
        TO_CHAR(sb.mes, 'YYYY-MM') AS name,
        CASE WHEN sb.mes <= date_trunc('month', CURRENT_DATE)::date THEN
          SUM(sb.realizado) OVER (ORDER BY sb.mes)
        ELSE NULL END AS "realizadoAcumulado",
        CASE WHEN sb.mes >= date_trunc('month', CURRENT_DATE)::date THEN
          ry.valor + SUM(sb.conservador) FILTER (
            WHERE sb.mes >= date_trunc('month', CURRENT_DATE)::date
          ) OVER (ORDER BY sb.mes)
        ELSE NULL END AS "cenarioConservador",
        CASE WHEN sb.mes >= date_trunc('month', CURRENT_DATE)::date THEN
          ry.valor + SUM(sb.provavel) FILTER (
            WHERE sb.mes >= date_trunc('month', CURRENT_DATE)::date
          ) OVER (ORDER BY sb.mes)
        ELSE NULL END AS "cenarioProvavel",
        CASE WHEN sb.mes >= date_trunc('month', CURRENT_DATE)::date THEN
          ry.valor + SUM(sb.otimista) FILTER (
            WHERE sb.mes >= date_trunc('month', CURRENT_DATE)::date
          ) OVER (ORDER BY sb.mes)
        ELSE NULL END AS "cenarioOtimista"
      FROM serie_base sb
      CROSS JOIN realizado_ytd ry
    ) sub
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
    'projecaoAnual', pa.dados,
    'saudeCarteira', sc.dados,
    'prioridadesFechamento', pf.dados,
    'motivosPerda', mp.dados
  )
  FROM dados_acoes a
  CROSS JOIN dados_funil f
  CROSS JOIN funil_por_etapa fp
  CROSS JOIN projecao_anual pa
  CROSS JOIN saude_carteira sc
  CROSS JOIN prioridades_fechamento pf
  CROSS JOIN motivos_perda mp;
$$;

COMMENT ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text) IS
  'Vendas & Resultados: KPIs conciliados com Ações e junção canônica de negócios, pedidos e ações para projeção anual, saúde da carteira, prioridades e perdas.';

REVOKE EXECUTE ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_resultados_negocios_bi(date, date, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
