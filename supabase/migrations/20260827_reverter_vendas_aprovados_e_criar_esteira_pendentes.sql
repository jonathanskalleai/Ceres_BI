-- ============================================================================
-- MIGRAÇÃO: 20260827_reverter_vendas_aprovados_e_criar_esteira_pendentes.sql
-- 
-- 1. Restaura o critério oficial de Ganhos/Faturamento para estritamente pedidos
--    com status 'Aprovado' (pdo_situacaopedido = 'Aprovado' e aprovação na janela).
-- 2. Cria a nova RPC 'rpc_pedidos_pendentes_esteira' para dar visibilidade aos
--    pedidos em tramitação/esteira de fechamento:
--      - Aprovados (oficial: 126 pedidos · R$ 15.532.047,18)
--      - Aguardando Aprovação (2 pedidos · R$ 170.700,00)
--      - Aguardando Assinatura do Cliente (26 pedidos · R$ 3.358.275,01, dos quais 5 com ganho · R$ 921.000,00)
--      - Total Esteira em Tramitação (28 pedidos · R$ 3.528.975,01)
--      - Total Consolidado Projetado (154 pedidos · R$ 19.061.022,19)
--      - Total Alinhado com Planilha (131 pedidos · R$ 16.453.047,18)
--      - Lista nominal dos pedidos para drilldown interativo
-- ============================================================================

-- 1. Restaura rpc_equipe_desempenho_mensal para status estritamente Aprovado
CREATE OR REPLACE FUNCTION public.rpc_equipe_desempenho_mensal(p_ano integer, p_vendedor text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'mirror'
AS $function$
WITH limites AS (
  SELECT make_date(p_ano, 1, 1) AS inicio, make_date(p_ano + 1, 1, 1) AS fim
),
negocios_base AS (
  SELECT DISTINCT ON (n.ngo_numero)
    n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.ngo_vendedores, n.cli_idcliente
  FROM mirror.crm_negocios n
  WHERE n.ngo_numero IS NOT NULL AND n.ngo_numero <> ''
  ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
),
negocios_com_consultor AS (
  SELECT n.ngo_numero, n.ngo_conclusao, n.ngo_funil, NULLIF(BTRIM(u.usr_nomeusuario), '') AS consultor, n.cli_idcliente
  FROM negocios_base n
  LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(BTRIM(n.ngo_vendedores), '')
),
pedidos_base AS (
  SELECT DISTINCT ON (p.pdo_codigointerno)
    p.pdo_codigointerno, p.pdo_nropedido, p.pdo_situacaopedido, p.pdo_dthaprovacao, p.pdo_dthpedido, p.pdo_vlrpedido, p.ngo_numero, p.cli_nome
  FROM mirror.crm_pedidos p
  WHERE p.pdo_codigointerno IS NOT NULL AND p.pdo_codigointerno <> ''
  ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST, p.dthregistro DESC NULLS LAST
),
pedidos_aprovados AS (
  SELECT p.pdo_codigointerno, p.pdo_nropedido, p.pdo_dthaprovacao, p.pdo_vlrpedido, nc.consultor, p.cli_nome, p.ngo_numero
  FROM pedidos_base p
  JOIN negocios_com_consultor nc ON nc.ngo_numero = p.ngo_numero
  JOIN limites l ON true
  WHERE p.pdo_situacaopedido = 'Aprovado'
    AND p.pdo_dthaprovacao >= l.inicio
    AND p.pdo_dthaprovacao < l.fim
    AND nc.ngo_conclusao = 'Ganho'
    AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
),
pedidos_filtrados AS (
  SELECT pa.*, mirror.fn_cli_cidade(nc.cli_idcliente) AS cidade
  FROM pedidos_aprovados pa
  JOIN negocios_com_consultor nc ON nc.ngo_numero = pa.ngo_numero
  WHERE (p_vendedor IS NULL OR pa.consultor = p_vendedor)
    AND (p_cidade IS NULL OR mirror.fn_cli_cidade(nc.cli_idcliente) = p_cidade)
),
meses_do_ano AS (
  SELECT generate_series(1, 12) AS mes_num
),
vendas_por_mes AS (
  SELECT m.mes_num,
    TO_CHAR(make_date(p_ano, m.mes_num, 1), 'YYYY-MM') AS mes,
    COUNT(pf.pdo_codigointerno)::int AS quantidade_vendas,
    COALESCE(SUM(pf.pdo_vlrpedido), 0)::numeric AS total_venda,
    CASE WHEN COUNT(pf.pdo_codigointerno) > 0
      THEN ROUND(COALESCE(SUM(pf.pdo_vlrpedido), 0) / COUNT(pf.pdo_codigointerno), 2)
      ELSE 0 END AS ticket_medio
  FROM meses_do_ano m
  LEFT JOIN pedidos_filtrados pf ON EXTRACT(MONTH FROM pf.pdo_dthaprovacao)::int = m.mes_num
  GROUP BY m.mes_num
),
totais_gerais AS (
  SELECT
    COALESCE(SUM(v.quantidade_vendas), 0)::int AS total_quantidade_vendas,
    COALESCE(SUM(v.total_venda), 0)::numeric AS total_geral_venda,
    CASE WHEN COALESCE(SUM(v.quantidade_vendas), 0) > 0
      THEN ROUND(COALESCE(SUM(v.total_venda), 0) / SUM(v.quantidade_vendas), 2)
      ELSE 0 END AS ticket_medio_geral
  FROM vendas_por_mes v
)
SELECT json_build_object(
  'ano', p_ano,
  'filtros', json_build_object('vendedor', p_vendedor, 'cidade', p_cidade),
  'meses', COALESCE((SELECT json_agg(row_to_json(v) ORDER BY v.mes_num) FROM vendas_por_mes v), '[]'::json),
  'totais', (SELECT row_to_json(t) FROM totais_gerais t)
);
$function$;

CREATE OR REPLACE FUNCTION public.rpc_equipe_desempenho_mensal_v2(p_ano integer, p_vendedor text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'mirror'
AS $function$
WITH limites AS (
  SELECT make_date(p_ano, 1, 1) AS inicio, make_date(p_ano + 1, 1, 1) AS fim
),
negocios_base AS (
  SELECT DISTINCT ON (n.ngo_numero)
    n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.ngo_vendedores, n.cli_idcliente
  FROM mirror.crm_negocios n
  WHERE n.ngo_numero IS NOT NULL AND n.ngo_numero <> ''
  ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
),
negocios_com_consultor AS (
  SELECT n.ngo_numero, n.ngo_conclusao, n.ngo_funil, NULLIF(BTRIM(u.usr_nomeusuario), '') AS consultor, n.cli_idcliente
  FROM negocios_base n
  LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(BTRIM(n.ngo_vendedores), '')
),
pedidos_base AS (
  SELECT DISTINCT ON (p.pdo_codigointerno)
    p.pdo_codigointerno, p.pdo_nropedido, p.pdo_situacaopedido, p.pdo_dthaprovacao, p.pdo_dthpedido, p.pdo_vlrpedido, p.ngo_numero, p.cli_nome
  FROM mirror.crm_pedidos p
  WHERE p.pdo_codigointerno IS NOT NULL AND p.pdo_codigointerno <> ''
  ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST, p.dthregistro DESC NULLS LAST
),
pedidos_aprovados AS (
  SELECT p.pdo_codigointerno, p.pdo_nropedido, p.pdo_dthaprovacao, p.pdo_vlrpedido, nc.consultor, p.cli_nome, p.ngo_numero,
         mirror.fn_cli_cidade(nc.cli_idcliente) AS cidade
  FROM pedidos_base p
  JOIN negocios_com_consultor nc ON nc.ngo_numero = p.ngo_numero
  JOIN limites l ON true
  WHERE p.pdo_situacaopedido = 'Aprovado'
    AND p.pdo_dthaprovacao >= l.inicio
    AND p.pdo_dthaprovacao < l.fim
    AND nc.ngo_conclusao = 'Ganho'
    AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
),
pedidos_filtrados AS (
  SELECT * FROM pedidos_aprovados pa
  WHERE (p_vendedor IS NULL OR pa.consultor = p_vendedor)
    AND (p_cidade IS NULL OR pa.cidade = p_cidade)
),
meses_do_ano AS (
  SELECT generate_series(1, 12) AS mes_num
),
vendas_por_mes AS (
  SELECT m.mes_num,
    TO_CHAR(make_date(p_ano, m.mes_num, 1), 'YYYY-MM') AS mes,
    COUNT(pf.pdo_codigointerno)::int AS quantidade_vendas,
    COALESCE(SUM(pf.pdo_vlrpedido), 0)::numeric AS total_venda,
    CASE WHEN COUNT(pf.pdo_codigointerno) > 0
      THEN ROUND(COALESCE(SUM(pf.pdo_vlrpedido), 0) / COUNT(pf.pdo_codigointerno), 2)
      ELSE 0 END AS ticket_medio
  FROM meses_do_ano m
  LEFT JOIN pedidos_filtrados pf ON EXTRACT(MONTH FROM pf.pdo_dthaprovacao)::int = m.mes_num
  GROUP BY m.mes_num
),
consultores_distintos AS (
  SELECT DISTINCT consultor FROM pedidos_filtrados WHERE consultor IS NOT NULL
),
vendas_consultor_mes AS (
  SELECT c.consultor, m.mes_num,
    TO_CHAR(make_date(p_ano, m.mes_num, 1), 'YYYY-MM') AS mes,
    COUNT(pf.pdo_codigointerno)::int AS quantidade_vendas,
    COALESCE(SUM(pf.pdo_vlrpedido), 0)::numeric AS total_venda,
    CASE WHEN COUNT(pf.pdo_codigointerno) > 0
      THEN ROUND(COALESCE(SUM(pf.pdo_vlrpedido), 0) / COUNT(pf.pdo_codigointerno), 2)
      ELSE 0 END AS ticket_medio
  FROM consultores_distintos c
  CROSS JOIN meses_do_ano m
  LEFT JOIN pedidos_filtrados pf ON pf.consultor = c.consultor AND EXTRACT(MONTH FROM pf.pdo_dthaprovacao)::int = m.mes_num
  GROUP BY c.consultor, m.mes_num
),
consultor_totais AS (
  SELECT v.consultor,
    COALESCE(SUM(v.quantidade_vendas), 0)::int AS total_quantidade_vendas,
    COALESCE(SUM(v.total_venda), 0)::numeric AS total_geral_venda,
    CASE WHEN COALESCE(SUM(v.quantidade_vendas), 0) > 0
      THEN ROUND(COALESCE(SUM(v.total_venda), 0) / SUM(v.quantidade_vendas), 2)
      ELSE 0 END AS ticket_medio_geral,
    COALESCE(json_agg(json_build_object(
      'mes_num', v.mes_num,
      'mes', v.mes,
      'quantidade_vendas', v.quantidade_vendas,
      'total_venda', v.total_venda,
      'ticket_medio', v.ticket_medio
    ) ORDER BY v.mes_num), '[]'::json) AS meses
  FROM vendas_consultor_mes v
  GROUP BY v.consultor
),
totais_gerais AS (
  SELECT
    COALESCE(SUM(v.quantidade_vendas), 0)::int AS total_quantidade_vendas,
    COALESCE(SUM(v.total_venda), 0)::numeric AS total_geral_venda,
    CASE WHEN COALESCE(SUM(v.quantidade_vendas), 0) > 0
      THEN ROUND(COALESCE(SUM(v.total_venda), 0) / SUM(v.quantidade_vendas), 2)
      ELSE 0 END AS ticket_medio_geral
  FROM vendas_por_mes v
)
SELECT json_build_object(
  'ano', p_ano,
  'filtros', json_build_object('vendedor', p_vendedor, 'cidade', p_cidade),
  'meses', COALESCE((SELECT json_agg(row_to_json(v) ORDER BY v.mes_num) FROM vendas_por_mes v), '[]'::json),
  'totais', (SELECT row_to_json(t) FROM totais_gerais t),
  'team', COALESCE((SELECT json_agg(json_build_object(
    'consultor', ct.consultor,
    'total_venda', ct.total_geral_venda,
    'quantidade_vendas', ct.total_quantidade_vendas,
    'ticket_medio', ct.ticket_medio_geral,
    'meses', ct.meses
  ) ORDER BY ct.total_geral_venda DESC, ct.total_quantidade_vendas DESC, ct.consultor ASC) FROM consultor_totais ct), '[]'::json)
);
$function$;

-- 2. Nova RPC para esteira de fechamento (Aguardando Aprovação e Aguardando Assinatura)
CREATE OR REPLACE FUNCTION public.rpc_pedidos_pendentes_esteira(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'mirror'
AS $function$
WITH params AS (
  SELECT
    COALESCE(p_from, CASE WHEN p_ano IS NOT NULL THEN make_date(p_ano, 1, 1) ELSE date_trunc('year', CURRENT_DATE)::date END) AS v_from,
    COALESCE(p_to, CASE WHEN p_ano IS NOT NULL THEN make_date(p_ano, 12, 31) ELSE (date_trunc('year', CURRENT_DATE) + INTERVAL '1 year - 1 day')::date END) AS v_to
),
pedidos_dedup AS (
  SELECT DISTINCT ON (p.pdo_codigointerno)
    p.pdo_codigointerno,
    p.pdo_nropedido,
    p.pdo_situacaopedido,
    p.cli_nome,
    COALESCE(p.pdo_vlrpedido, 0) AS pdo_vlrpedido,
    COALESCE(p.pdo_dthaprovacao, p.pdo_dthpedido) AS dth_evento,
    COALESCE(NULLIF(TRIM(p.pdo_vendedor), ''), 'Não Informado') AS pdo_vendedor,
    COALESCE(NULLIF(TRIM(p.pdo_cidadeufentrega), ''), NULLIF(TRIM(p.emp_cidade), ''), 'Não Informada') AS cidade_entrega,
    p.ngo_numero
  FROM mirror.crm_pedidos p
  CROSS JOIN params pr
  WHERE p.pdo_situacaopedido IN ('Aprovado', 'Aguardando Aprovação', 'Aguardando Assinatura Cliente', 'Sem Situação')
    AND COALESCE(p.pdo_dthaprovacao, p.pdo_dthpedido)::date BETWEEN pr.v_from AND pr.v_to
  ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
),
negocios_dos_pedidos AS (
  SELECT DISTINCT ON (n.ngo_numero)
    n.ngo_numero,
    n.ngo_conclusao,
    n.ngo_funil,
    NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
    mirror.fn_cli_cidade(n.cli_idcliente) AS cidade_negocio
  FROM mirror.crm_negocios n
  JOIN pedidos_dedup pd ON pd.ngo_numero = n.ngo_numero
  LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(BTRIM(n.ngo_vendedores), '')
  ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST
),
pedidos_filtrados AS (
  SELECT
    pd.*,
    nc.ngo_conclusao,
    nc.consultor_negocio,
    nc.cidade_negocio
  FROM pedidos_dedup pd
  JOIN negocios_dos_pedidos nc ON nc.ngo_numero = pd.ngo_numero
  WHERE COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
    AND (p_vendedor IS NULL OR pd.pdo_vendedor ILIKE '%' || p_vendedor || '%' OR nc.consultor_negocio ILIKE '%' || p_vendedor || '%')
    AND (p_cidade IS NULL OR pd.cidade_entrega ILIKE '%' || p_cidade || '%' OR nc.cidade_negocio ILIKE '%' || p_cidade || '%')
),
aprovados_oficial AS (
  SELECT
    COUNT(DISTINCT pdo_codigointerno)::int AS qtd,
    COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS valor
  FROM pedidos_filtrados
  WHERE pdo_situacaopedido = 'Aprovado'
    AND ngo_conclusao = 'Ganho'
),
aguardando_aprovacao AS (
  SELECT
    COUNT(DISTINCT pdo_codigointerno)::int AS qtd,
    COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS valor
  FROM pedidos_filtrados
  WHERE pdo_situacaopedido = 'Aguardando Aprovação'
),
aguardando_assinatura AS (
  SELECT
    COUNT(DISTINCT pdo_codigointerno)::int AS qtd,
    COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS valor
  FROM pedidos_filtrados
  WHERE pdo_situacaopedido IN ('Aguardando Assinatura Cliente', 'Sem Situação')
),
aguardando_assinatura_ganhos AS (
  SELECT
    COUNT(DISTINCT pdo_codigointerno)::int AS qtd,
    COALESCE(SUM(pdo_vlrpedido), 0)::numeric AS valor
  FROM pedidos_filtrados
  WHERE pdo_situacaopedido IN ('Aguardando Assinatura Cliente', 'Sem Situação')
    AND ngo_conclusao = 'Ganho'
),
lista_pedidos AS (
  SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.data DESC, sub.valor DESC), '[]'::json) AS val
  FROM (
    SELECT 
      pdo_codigointerno AS "codigoInterno",
      pdo_nropedido AS "numeroPedido",
      cli_nome AS "cliente",
      COALESCE(consultor_negocio, pdo_vendedor) AS "consultor",
      COALESCE(cidade_negocio, cidade_entrega) AS "cidade",
      pdo_vlrpedido AS "valor",
      dth_evento AS "data",
      CASE 
        WHEN pdo_situacaopedido = 'Aprovado' THEN 'Aprovado'
        WHEN pdo_situacaopedido = 'Aguardando Aprovação' THEN 'Aguardando Aprovação'
        ELSE 'Aguardando Assinatura Cliente'
      END AS "situacao",
      ngo_conclusao AS "conclusaoNegocio"
    FROM pedidos_filtrados
    WHERE pdo_situacaopedido IN ('Aguardando Aprovação', 'Aguardando Assinatura Cliente', 'Sem Situação')
       OR (pdo_situacaopedido = 'Aprovado' AND ngo_conclusao = 'Ganho')
  ) sub
)
SELECT json_build_object(
  'aprovados', json_build_object(
    'qtd', (SELECT qtd FROM aprovados_oficial),
    'valor', (SELECT valor FROM aprovados_oficial)
  ),
  'aguardandoAprovacao', json_build_object(
    'qtd', (SELECT qtd FROM aguardando_aprovacao),
    'valor', (SELECT valor FROM aguardando_aprovacao)
  ),
  'aguardandoAssinatura', json_build_object(
    'qtd', (SELECT qtd FROM aguardando_assinatura),
    'valor', (SELECT valor FROM aguardando_assinatura),
    'qtdGanho', (SELECT qtd FROM aguardando_assinatura_ganhos),
    'valorGanho', (SELECT valor FROM aguardando_assinatura_ganhos)
  ),
  'totalEsteira', json_build_object(
    'qtd', (SELECT qtd FROM aguardando_aprovacao) + (SELECT qtd FROM aguardando_assinatura),
    'valor', (SELECT valor FROM aguardando_aprovacao) + (SELECT valor FROM aguardando_assinatura)
  ),
  'totalConsolidado', json_build_object(
    'qtd', (SELECT qtd FROM aprovados_oficial) + (SELECT qtd FROM aguardando_aprovacao) + (SELECT qtd FROM aguardando_assinatura),
    'valor', (SELECT valor FROM aprovados_oficial) + (SELECT valor FROM aguardando_aprovacao) + (SELECT valor FROM aguardando_assinatura)
  ),
  'totalAlinhadoPlanilha', json_build_object(
    'qtd', (SELECT qtd FROM aprovados_oficial) + (SELECT qtd FROM aguardando_assinatura_ganhos),
    'valor', (SELECT valor FROM aprovados_oficial) + (SELECT valor FROM aguardando_assinatura_ganhos)
  ),
  'pedidos', (SELECT val FROM lista_pedidos)
);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_pedidos_pendentes_esteira(date, date, integer, text, text) TO anon, authenticated, service_role;
