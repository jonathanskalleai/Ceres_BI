-- Migration: RPC para o Dashboard de Desempenho de Vendas (v7 - Filtro Cruzado / Cross-Filtering Dimensional)
-- Autor: Ceres BI Team
-- Data: 2026-08-21
-- Descrição: Adiciona suporte a filtro cruzado por Produto, Origem, Banco/Modalidade e Motivo de Perda.

CREATE OR REPLACE FUNCTION public.rpc_desempenho_vendas_bi(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_condicao text DEFAULT NULL,
  p_produto text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_banco text DEFAULT NULL,
  p_motivo_perda text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH params AS (
    SELECT
      CASE
        WHEN p_ano IS NOT NULL THEN make_date(p_ano, 1, 1)
        ELSE COALESCE(p_from, make_date(EXTRACT(YEAR FROM CURRENT_DATE)::integer, 1, 1))
      END AS v_from,
      CASE
        WHEN p_ano IS NOT NULL THEN make_date(p_ano, 12, 31)
        ELSE COALESCE(p_to, CURRENT_DATE)
      END AS v_to,
      CASE
        WHEN p_ano IS NOT NULL THEN p_ano
        ELSE EXTRACT(YEAR FROM COALESCE(p_from, CURRENT_DATE))::integer
      END AS v_target_year
  ),
  negocios_canonicos AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      COALESCE(n.ngo_vlrtotalnegociado, 0) AS ngo_vlrtotalnegociado,
      COALESCE(NULLIF(TRIM(n.ngo_formaentrada), ''), 'Não Informada') AS ngo_formaentrada,
      COALESCE(NULLIF(TRIM(n.ngo_campanha), ''), 'Sem Campanha') AS ngo_campanha,
      COALESCE(NULLIF(TRIM(n.ngo_motivoperda), ''), 'Não Informado') AS ngo_motivoperda,
      COALESCE(NULLIF(TRIM(n.mpp_produtoperdamarca), ''), 'Não Informada') AS mpp_produtoperdamarca,
      COALESCE(NULLIF(TRIM(n.cli_tipocliente), ''), 'Produtor Rural') AS cli_tipocliente,
      COALESCE(NULLIF(TRIM(n.prd_condicaoproduto), ''), 'Novo') AS prd_condicaoproduto,
      COALESCE(NULLIF(TRIM(n.prd_dscproduto), ''), 'Produto Sem Descrição') AS prd_dscproduto,
      COALESCE(NULLIF(TRIM(n.prd_marcaproduto), ''), 'Outras') AS prd_marcaproduto,
      COALESCE(NULLIF(TRIM(n.prd_grupoproduto), ''), 'Geral') AS prd_grupoproduto,
      n.ngo_vendedores,
      n.cli_cidade,
      n.emp_cidade,
      n.ngo_funil,
      COALESCE(n.ngo_datafechamento, n.ngo_datacadastro) AS dth_evento_negocio,
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        ELSE 'andamento'
      END AS status_class
    FROM mirror.crm_negocios n
    WHERE COALESCE(n.ngo_funil, '') NOT ILIKE '%repasse%'
    ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
  ),
  pedidos_dedup AS (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.ngo_numero,
      p.pdo_situacaopedido,
      COALESCE(p.pdo_vlrpedido, 0) AS pdo_vlrpedido,
      COALESCE(p.pdo_vlrfinanciado, 0) AS pdo_vlrfinanciado,
      COALESCE(p.pdo_vlrrecursoproprio, 0) AS pdo_vlrrecursoproprio,
      COALESCE(p.pdo_dthaprovacao, p.pdo_dthpedido) AS dth_evento_pedido,
      COALESCE(NULLIF(TRIM(p.pdo_vendedor), ''), 'Não Informado') AS pdo_vendedor,
      COALESCE(NULLIF(TRIM(p.pdo_cidadeufentrega), ''), NULLIF(TRIM(p.emp_cidade), ''), 'Não Informada') AS cidade_entrega,
      COALESCE(NULLIF(TRIM(p.pdo_financiamentobanco), ''), 'Não Informado') AS pdo_banco,
      LOWER(COALESCE(p.pdo_situacaopedido, '')) LIKE '%aprovado%' AS is_aprovado
    FROM mirror.crm_pedidos p
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  -- Pedidos ganhos filtrados pela janela e critérios
  pedidos_ganhos_periodo AS (
    SELECT
      p.*,
      n.ngo_formaentrada,
      n.cli_tipocliente,
      n.prd_condicaoproduto,
      TRIM(SPLIT_PART(SPLIT_PART(n.prd_dscproduto, E'\n', 1), ' - Descricao', 1)) AS prd_nome_limpo,
      n.prd_marcaproduto,
      n.prd_grupoproduto
    FROM pedidos_dedup p
    INNER JOIN negocios_canonicos n ON n.ngo_numero = p.ngo_numero
    CROSS JOIN params pr
    WHERE p.is_aprovado
      AND n.status_class = 'ganho'
      AND p.dth_evento_pedido::date BETWEEN pr.v_from AND pr.v_to
      AND (p_vendedor IS NULL OR p.pdo_vendedor ILIKE '%' || p_vendedor || '%' OR n.ngo_vendedores ILIKE '%' || p_vendedor || '%')
      AND (p_cidade IS NULL OR p.cidade_entrega ILIKE '%' || p_cidade || '%' OR n.cli_cidade ILIKE '%' || p_cidade || '%')
      AND (p_condicao IS NULL OR n.prd_condicaoproduto ILIKE '%' || p_condicao || '%')
      AND (
        p_produto IS NULL 
        OR n.prd_dscproduto ILIKE '%' || p_produto || '%' 
        OR n.prd_marcaproduto ILIKE '%' || p_produto || '%' 
        OR n.prd_grupoproduto ILIKE '%' || p_produto || '%'
        OR TRIM(SPLIT_PART(SPLIT_PART(n.prd_dscproduto, E'\n', 1), ' - Descricao', 1)) ILIKE '%' || p_produto || '%'
      )
      AND (p_origem IS NULL OR n.ngo_formaentrada ILIKE '%' || p_origem || '%')
      AND (
        p_banco IS NULL
        OR (p_banco ILIKE '%próprio%' AND (p.pdo_vlrfinanciado = 0 OR p.pdo_banco IS NULL OR p.pdo_banco = 'Não Informado'))
        OR p.pdo_banco ILIKE '%' || p_banco || '%'
      )
  ),
  -- Negócios perdidos filtrados pela janela com resolução de vendedor
  negocios_perdidos_periodo AS (
    SELECT
      n.*,
      TRIM(SPLIT_PART(SPLIT_PART(n.prd_dscproduto, E'\n', 1), ' - Descricao', 1)) AS prd_nome_limpo,
      COALESCE(NULLIF(TRIM(n.cli_cidade), ''), NULLIF(TRIM(n.emp_cidade), ''), 'Não Informada') AS cidade_perda,
      COALESCE(u_cod.usr_nomeusuario, u_id.usr_nomeusuario, NULLIF(TRIM(n.ngo_vendedores), ''), 'Não Informado') AS vendedor_perda
    FROM negocios_canonicos n
    CROSS JOIN params pr
    LEFT JOIN mirror.usuarios u_cod ON u_cod.usr_codusuario = n.ngo_vendedores AND u_cod.usr_codusuario IS NOT NULL AND u_cod.usr_codusuario != ''
    LEFT JOIN mirror.usuarios u_id ON u_id.usr_idusuario = n.ngo_vendedores
    WHERE n.status_class = 'perdido'
      AND n.dth_evento_negocio::date BETWEEN pr.v_from AND pr.v_to
      AND (p_vendedor IS NULL OR n.ngo_vendedores ILIKE '%' || p_vendedor || '%' OR u_cod.usr_nomeusuario ILIKE '%' || p_vendedor || '%' OR u_id.usr_nomeusuario ILIKE '%' || p_vendedor || '%')
      AND (p_cidade IS NULL OR n.cli_cidade ILIKE '%' || p_cidade || '%' OR n.emp_cidade ILIKE '%' || p_cidade || '%')
      AND (p_condicao IS NULL OR n.prd_condicaoproduto ILIKE '%' || p_condicao || '%')
      AND (
        p_produto IS NULL 
        OR n.prd_dscproduto ILIKE '%' || p_produto || '%' 
        OR n.prd_marcaproduto ILIKE '%' || p_produto || '%' 
        OR n.prd_grupoproduto ILIKE '%' || p_produto || '%'
        OR TRIM(SPLIT_PART(SPLIT_PART(n.prd_dscproduto, E'\n', 1), ' - Descricao', 1)) ILIKE '%' || p_produto || '%'
      )
      AND (p_origem IS NULL OR n.ngo_formaentrada ILIKE '%' || p_origem || '%')
      AND (p_motivo_perda IS NULL OR n.ngo_motivoperda ILIKE '%' || p_motivo_perda || '%')
  ),
  -- Pipeline aberto
  negocios_andamento_periodo AS (
    SELECT n.*
    FROM negocios_canonicos n
    CROSS JOIN params pr
    WHERE n.status_class = 'andamento'
      AND (p_vendedor IS NULL OR n.ngo_vendedores ILIKE '%' || p_vendedor || '%')
      AND (p_cidade IS NULL OR n.cli_cidade ILIKE '%' || p_cidade || '%' OR n.emp_cidade ILIKE '%' || p_cidade || '%')
      AND (p_condicao IS NULL OR n.prd_condicaoproduto ILIKE '%' || p_condicao || '%')
      AND (p_produto IS NULL OR n.prd_dscproduto ILIKE '%' || p_produto || '%')
      AND (p_origem IS NULL OR n.ngo_formaentrada ILIKE '%' || p_origem || '%')
  ),
  -- Totais Gerais de Ganhos
  totais_ganhos AS (
    SELECT
      COUNT(DISTINCT pdo_codigointerno) AS qtd_total,
      COALESCE(SUM(pdo_vlrpedido), 0) AS faturamento_total,
      COALESCE(SUM(pdo_vlrfinanciado), 0) AS faturamento_financiado,
      COALESCE(SUM(pdo_vlrrecursoproprio), 0) AS faturamento_proprio
    FROM pedidos_ganhos_periodo
  ),
  -- Totais Gerais de Perdas
  totais_perdas AS (
    SELECT
      COUNT(DISTINCT ngo_numero) AS qtd_total_perda,
      COALESCE(SUM(ngo_vlrtotalnegociado), 0) AS valor_total_perda
    FROM negocios_perdidos_periodo
  ),
  -- 1. KPIs
  kpis AS (
    SELECT json_build_object(
      'faturamento', (SELECT faturamento_total FROM totais_ganhos),
      'totalPedidos', (SELECT qtd_total FROM totais_ganhos),
      'ticketMedio', CASE
        WHEN (SELECT qtd_total FROM totais_ganhos) > 0
        THEN ROUND((SELECT faturamento_total FROM totais_ganhos) / (SELECT qtd_total FROM totais_ganhos), 2)
        ELSE 0
      END,
      'valorFinanciado', (SELECT faturamento_financiado FROM totais_ganhos),
      'valorRecursoProprio', (SELECT faturamento_proprio FROM totais_ganhos),
      'percentFinanciado', CASE
        WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
        THEN ROUND(((SELECT faturamento_financiado FROM totais_ganhos) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
        ELSE 0
      END,
      'percentRecursoProprio', CASE
        WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
        THEN ROUND(((SELECT faturamento_proprio FROM totais_ganhos) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
        ELSE 0
      END,
      'totalPerdido', (SELECT qtd_total_perda FROM totais_perdas),
      'valorPerdido', (SELECT valor_total_perda FROM totais_perdas),
      'ticketMedioPerdido', CASE
        WHEN (SELECT qtd_total_perda FROM totais_perdas) > 0
        THEN ROUND((SELECT valor_total_perda FROM totais_perdas) / (SELECT qtd_total_perda FROM totais_perdas), 2)
        ELSE 0
      END,
      'qtdPerdido', (SELECT qtd_total_perda FROM totais_perdas),
      'totalEmAndamento', (SELECT COUNT(DISTINCT ngo_numero) FROM negocios_andamento_periodo),
      'valorEmAndamento', (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0) FROM negocios_andamento_periodo)
    ) AS val
  ),
  -- 2. Série Mensal Ganho vs Perda (12 meses do ano alvo)
  serie_mensal AS (
    SELECT COALESCE(json_agg(row_to_json(m_sub)), '[]'::json) AS val
    FROM (
      WITH meses_ano AS (
        SELECT generate_series(1, 12) AS mes
      ),
      ganhos_m AS (
        SELECT
          EXTRACT(MONTH FROM p.dth_evento_pedido)::int AS mes,
          COUNT(DISTINCT p.pdo_codigointerno) AS qtd_ganho,
          SUM(p.pdo_vlrpedido) AS valor_ganho
        FROM pedidos_dedup p
        INNER JOIN negocios_canonicos n ON n.ngo_numero = p.ngo_numero
        CROSS JOIN params pr
        WHERE p.is_aprovado
          AND n.status_class = 'ganho'
          AND EXTRACT(YEAR FROM p.dth_evento_pedido) = pr.v_target_year
          AND (p_vendedor IS NULL OR p.pdo_vendedor ILIKE '%' || p_vendedor || '%' OR n.ngo_vendedores ILIKE '%' || p_vendedor || '%')
          AND (p_cidade IS NULL OR p.cidade_entrega ILIKE '%' || p_cidade || '%' OR n.cli_cidade ILIKE '%' || p_cidade || '%')
          AND (p_condicao IS NULL OR n.prd_condicaoproduto ILIKE '%' || p_condicao || '%')
          AND (
            p_produto IS NULL 
            OR n.prd_dscproduto ILIKE '%' || p_produto || '%' 
            OR n.prd_marcaproduto ILIKE '%' || p_produto || '%' 
            OR n.prd_grupoproduto ILIKE '%' || p_produto || '%'
            OR TRIM(SPLIT_PART(SPLIT_PART(n.prd_dscproduto, E'\n', 1), ' - Descricao', 1)) ILIKE '%' || p_produto || '%'
          )
          AND (p_origem IS NULL OR n.ngo_formaentrada ILIKE '%' || p_origem || '%')
          AND (
            p_banco IS NULL
            OR (p_banco ILIKE '%próprio%' AND (p.pdo_vlrfinanciado = 0 OR p.pdo_banco IS NULL OR p.pdo_banco = 'Não Informado'))
            OR p.pdo_banco ILIKE '%' || p_banco || '%'
          )
        GROUP BY 1
      ),
      perdas_m AS (
        SELECT
          EXTRACT(MONTH FROM n.dth_evento_negocio)::int AS mes,
          COUNT(DISTINCT n.ngo_numero) AS qtd_perda,
          SUM(n.ngo_vlrtotalnegociado) AS valor_perda
        FROM negocios_canonicos n
        CROSS JOIN params pr
        WHERE n.status_class = 'perdido'
          AND EXTRACT(YEAR FROM n.dth_evento_negocio) = pr.v_target_year
          AND (p_vendedor IS NULL OR n.ngo_vendedores ILIKE '%' || p_vendedor || '%')
          AND (p_cidade IS NULL OR n.cli_cidade ILIKE '%' || p_cidade || '%' OR n.emp_cidade ILIKE '%' || p_cidade || '%')
          AND (p_condicao IS NULL OR n.prd_condicaoproduto ILIKE '%' || p_condicao || '%')
          AND (
            p_produto IS NULL 
            OR n.prd_dscproduto ILIKE '%' || p_produto || '%' 
            OR n.prd_marcaproduto ILIKE '%' || p_produto || '%' 
            OR n.prd_grupoproduto ILIKE '%' || p_produto || '%'
            OR TRIM(SPLIT_PART(SPLIT_PART(n.prd_dscproduto, E'\n', 1), ' - Descricao', 1)) ILIKE '%' || p_produto || '%'
          )
          AND (p_origem IS NULL OR n.ngo_formaentrada ILIKE '%' || p_origem || '%')
          AND (p_motivo_perda IS NULL OR n.ngo_motivoperda ILIKE '%' || p_motivo_perda || '%')
        GROUP BY 1
      )
      SELECT
        ma.mes,
        CASE ma.mes
          WHEN 1 THEN 'Jan' WHEN 2 THEN 'Fev' WHEN 3 THEN 'Mar'
          WHEN 4 THEN 'Abr' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Jun'
          WHEN 7 THEN 'Jul' WHEN 8 THEN 'Ago' WHEN 9 THEN 'Set'
          WHEN 10 THEN 'Out' WHEN 11 THEN 'Nov' WHEN 12 THEN 'Dez'
        END AS "mesNome",
        COALESCE(gm.qtd_ganho, 0)::int AS "qtdGanho",
        COALESCE(gm.valor_ganho, 0)::numeric AS "valorGanho",
        COALESCE(pm.qtd_perda, 0)::int AS "qtdPerda",
        COALESCE(pm.valor_perda, 0)::numeric AS "valorPerda"
      FROM meses_ano ma
      LEFT JOIN ganhos_m gm ON gm.mes = ma.mes
      LEFT JOIN perdas_m pm ON pm.mes = ma.mes
      ORDER BY ma.mes
    ) m_sub
  ),
  -- 3. Ranking de Vendedores (Ganhos)
  ranking_vendedores AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.pdo_vendedor AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM pedidos_ganhos_periodo p
      GROUP BY p.pdo_vendedor
      ORDER BY SUM(p.pdo_vlrpedido) DESC
    ) sub
  ),
  -- 4. Produtos Mais Vendidos (Ganhos)
  ranking_produtos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.prd_nome_limpo AS name,
        p.prd_marcaproduto AS marca,
        p.prd_grupoproduto AS grupo,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM pedidos_ganhos_periodo p
      GROUP BY
        p.prd_nome_limpo,
        p.prd_marcaproduto,
        p.prd_grupoproduto
      ORDER BY SUM(p.pdo_vlrpedido) DESC
    ) sub
  ),
  -- 5. Cidades / Filiais com mais vendas (Ganhos)
  ranking_cidades AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.cidade_entrega AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM pedidos_ganhos_periodo p
      GROUP BY p.cidade_entrega
      ORDER BY SUM(p.pdo_vlrpedido) DESC
    ) sub
  ),
  -- 6. Origem do Lead / Formas de Entrada (Ganhos)
  origens_lead AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.ngo_formaentrada AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM pedidos_ganhos_periodo p
      GROUP BY p.ngo_formaentrada
      ORDER BY SUM(p.pdo_vlrpedido) DESC
    ) sub
  ),
  -- 7. Modalidade de Pagamento / Bancos Financiadores (Ganhos)
  financiamento_bancos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        CASE
          WHEN p.pdo_vlrfinanciado > 0 AND p.pdo_banco != 'Não Informado' THEN p.pdo_banco
          WHEN p.pdo_vlrfinanciado > 0 THEN 'Financiamento (Banco a Definir)'
          ELSE 'Recurso Próprio / À Vista'
        END AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM pedidos_ganhos_periodo p
      GROUP BY 1
      ORDER BY SUM(p.pdo_vlrpedido) DESC
    ) sub
  ),
  -- 8. Tipos de Cliente (Ganhos)
  tipos_cliente AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        p.cli_tipocliente AS name,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS valor,
        CASE
          WHEN (SELECT faturamento_total FROM totais_ganhos) > 0
          THEN ROUND((SUM(p.pdo_vlrpedido) / (SELECT faturamento_total FROM totais_ganhos)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM pedidos_ganhos_periodo p
      GROUP BY p.cli_tipocliente
      ORDER BY SUM(p.pdo_vlrpedido) DESC
    ) sub
  ),
  -- 9. Motivos de Perda
  motivos_perda AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        n.ngo_motivoperda AS name,
        COUNT(DISTINCT n.ngo_numero)::int AS qtd,
        COALESCE(SUM(n.ngo_vlrtotalnegociado), 0)::numeric AS valor,
        CASE
          WHEN (SELECT valor_total_perda FROM totais_perdas) > 0
          THEN ROUND((SUM(n.ngo_vlrtotalnegociado) / (SELECT valor_total_perda FROM totais_perdas)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT n.ngo_numero) > 0
          THEN ROUND(SUM(n.ngo_vlrtotalnegociado) / COUNT(DISTINCT n.ngo_numero), 2)
          ELSE 0
        END AS "ticketMedio",
        (
          SELECT mpp_produtoperdamarca
          FROM negocios_perdidos_periodo n2
          WHERE n2.ngo_motivoperda = n.ngo_motivoperda
            AND n2.mpp_produtoperdamarca != 'Não Informada'
          GROUP BY mpp_produtoperdamarca
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) AS "concorrenteTop"
      FROM negocios_perdidos_periodo n
      GROUP BY n.ngo_motivoperda
      ORDER BY SUM(n.ngo_vlrtotalnegociado) DESC
    ) sub
  ),
  -- 10. Ranking de Vendedores com Mais Perdas (Nomes Completos)
  ranking_vendedores_perda AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        n.vendedor_perda AS name,
        COUNT(DISTINCT n.ngo_numero)::int AS qtd,
        COALESCE(SUM(n.ngo_vlrtotalnegociado), 0)::numeric AS valor,
        CASE
          WHEN (SELECT valor_total_perda FROM totais_perdas) > 0
          THEN ROUND((SUM(n.ngo_vlrtotalnegociado) / (SELECT valor_total_perda FROM totais_perdas)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT n.ngo_numero) > 0
          THEN ROUND(SUM(n.ngo_vlrtotalnegociado) / COUNT(DISTINCT n.ngo_numero), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM negocios_perdidos_periodo n
      GROUP BY n.vendedor_perda
      ORDER BY SUM(n.ngo_vlrtotalnegociado) DESC
    ) sub
  ),
  -- 11. Ranking de Produtos Mais Perdidos
  ranking_produtos_perda AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        n.prd_nome_limpo AS name,
        n.prd_marcaproduto AS marca,
        n.prd_grupoproduto AS grupo,
        COUNT(DISTINCT n.ngo_numero)::int AS qtd,
        COALESCE(SUM(n.ngo_vlrtotalnegociado), 0)::numeric AS valor,
        CASE
          WHEN (SELECT valor_total_perda FROM totais_perdas) > 0
          THEN ROUND((SUM(n.ngo_vlrtotalnegociado) / (SELECT valor_total_perda FROM totais_perdas)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT n.ngo_numero) > 0
          THEN ROUND(SUM(n.ngo_vlrtotalnegociado) / COUNT(DISTINCT n.ngo_numero), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM negocios_perdidos_periodo n
      GROUP BY n.prd_nome_limpo, n.prd_marcaproduto, n.prd_grupoproduto
      ORDER BY SUM(n.ngo_vlrtotalnegociado) DESC
    ) sub
  ),
  -- 12. Ranking de Cidades com Mais Perdas
  ranking_cidades_perda AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        n.cidade_perda AS name,
        COUNT(DISTINCT n.ngo_numero)::int AS qtd,
        COALESCE(SUM(n.ngo_vlrtotalnegociado), 0)::numeric AS valor,
        CASE
          WHEN (SELECT valor_total_perda FROM totais_perdas) > 0
          THEN ROUND((SUM(n.ngo_vlrtotalnegociado) / (SELECT valor_total_perda FROM totais_perdas)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT n.ngo_numero) > 0
          THEN ROUND(SUM(n.ngo_vlrtotalnegociado) / COUNT(DISTINCT n.ngo_numero), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM negocios_perdidos_periodo n
      GROUP BY n.cidade_perda
      ORDER BY SUM(n.ngo_vlrtotalnegociado) DESC
    ) sub
  ),
  -- 13. Origens de Lead com Mais Perdas
  origens_lead_perda AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        n.ngo_formaentrada AS name,
        COUNT(DISTINCT n.ngo_numero)::int AS qtd,
        COALESCE(SUM(n.ngo_vlrtotalnegociado), 0)::numeric AS valor,
        CASE
          WHEN (SELECT valor_total_perda FROM totais_perdas) > 0
          THEN ROUND((SUM(n.ngo_vlrtotalnegociado) / (SELECT valor_total_perda FROM totais_perdas)) * 100, 1)
          ELSE 0
        END AS percent,
        CASE
          WHEN COUNT(DISTINCT n.ngo_numero) > 0
          THEN ROUND(SUM(n.ngo_vlrtotalnegociado) / COUNT(DISTINCT n.ngo_numero), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM negocios_perdidos_periodo n
      GROUP BY n.ngo_formaentrada
      ORDER BY SUM(n.ngo_vlrtotalnegociado) DESC
    ) sub
  ),
  -- 14. Resumo Anual (Histórico Multianual)
  resumo_anual AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        EXTRACT(YEAR FROM p.dth_evento_pedido)::int AS ano,
        COUNT(DISTINCT p.pdo_codigointerno)::int AS qtd,
        COALESCE(SUM(p.pdo_vlrpedido), 0)::numeric AS faturamento,
        CASE
          WHEN COUNT(DISTINCT p.pdo_codigointerno) > 0
          THEN ROUND(SUM(p.pdo_vlrpedido) / COUNT(DISTINCT p.pdo_codigointerno), 2)
          ELSE 0
        END AS "ticketMedio"
      FROM pedidos_dedup p
      INNER JOIN negocios_canonicos n ON n.ngo_numero = p.ngo_numero
      WHERE p.is_aprovado
        AND n.status_class = 'ganho'
        AND EXTRACT(YEAR FROM p.dth_evento_pedido) >= 2024
      GROUP BY 1
      ORDER BY ano DESC
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'serieMensal', (SELECT val FROM serie_mensal),
    'rankingVendedores', (SELECT val FROM ranking_vendedores),
    'rankingProdutos', (SELECT val FROM ranking_produtos),
    'rankingCidades', (SELECT val FROM ranking_cidades),
    'origensLead', (SELECT val FROM origens_lead),
    'financiamentoBancos', (SELECT val FROM financiamento_bancos),
    'tiposCliente', (SELECT val FROM tipos_cliente),
    'motivosPerda', (SELECT val FROM motivos_perda),
    'resumoAnual', (SELECT val FROM resumo_anual),
    'perdas', json_build_object(
      'rankingVendedores', (SELECT val FROM ranking_vendedores_perda),
      'rankingProdutos', (SELECT val FROM ranking_produtos_perda),
      'rankingCidades', (SELECT val FROM ranking_cidades_perda),
      'origensLead', (SELECT val FROM origens_lead_perda),
      'motivosPerda', (SELECT val FROM motivos_perda)
    )
  );
$$;
