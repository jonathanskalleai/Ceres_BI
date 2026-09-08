-- Adiciona o campo 'produto' na lista_pedidos da RPC rpc_pedidos_pendentes_esteira
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
    COALESCE(p.pdo_dthpedido, p.pdo_dthaprovacao, p.dthregistro) AS dth_evento,
    COALESCE(NULLIF(TRIM(p.pdo_vendedor), ''), 'Não Informado') AS pdo_vendedor,
    COALESCE(NULLIF(TRIM(p.pdo_cidadeufentrega), ''), NULLIF(TRIM(p.emp_cidade), ''), 'Não Informada') AS cidade_entrega,
    p.ngo_numero
  FROM mirror.crm_pedidos p
  CROSS JOIN params pr
  WHERE p.pdo_situacaopedido IN ('Aguardando Aprovação', 'Aguardando Assinatura Cliente', 'Sem Situação')
    AND COALESCE(p.pdo_dthpedido, p.pdo_dthaprovacao, p.dthregistro)::date BETWEEN pr.v_from AND pr.v_to
  ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
),
negocios_base AS (
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
produtos_por_negocio AS (
  SELECT n.ngo_numero,
    STRING_AGG(DISTINCT NULLIF(BTRIM(n.prd_dscproduto), ''), ' · ' ORDER BY NULLIF(BTRIM(n.prd_dscproduto), '')) AS produto
  FROM mirror.crm_negocios n
  JOIN pedidos_dedup pd ON pd.ngo_numero = n.ngo_numero
  GROUP BY n.ngo_numero
),
pedidos_filtrados AS (
  SELECT
    pd.*,
    nc.ngo_conclusao,
    nc.consultor_negocio,
    nc.cidade_negocio,
    ppn.produto
  FROM pedidos_dedup pd
  JOIN negocios_base nc ON nc.ngo_numero = pd.ngo_numero
  LEFT JOIN produtos_por_negocio ppn ON ppn.ngo_numero = pd.ngo_numero
  WHERE COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
    AND (p_vendedor IS NULL OR pd.pdo_vendedor ILIKE '%' || p_vendedor || '%' OR nc.consultor_negocio ILIKE '%' || p_vendedor || '%')
    AND (p_cidade IS NULL OR pd.cidade_entrega ILIKE '%' || p_cidade || '%' OR nc.cidade_negocio ILIKE '%' || p_cidade || '%')
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
lista_pedidos AS (
  SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.data DESC, sub.valor DESC), '[]'::json) AS val
  FROM (
    SELECT 
      pdo_codigointerno AS "codigoInterno",
      pdo_nropedido AS "numeroPedido",
      cli_nome AS "cliente",
      COALESCE(consultor_negocio, pdo_vendedor) AS "consultor",
      COALESCE(cidade_negocio, cidade_entrega) AS "cidade",
      produto AS "produto",
      pdo_vlrpedido AS "valor",
      dth_evento AS "data",
      CASE 
        WHEN pdo_situacaopedido = 'Aguardando Aprovação' THEN 'Aguardando Aprovação'
        ELSE 'Aguardando Assinatura Cliente'
      END AS "situacao",
      ngo_conclusao AS "conclusaoNegocio"
    FROM pedidos_filtrados
  ) sub
)
SELECT json_build_object(
  'aguardandoAprovacao', json_build_object(
    'qtd', (SELECT qtd FROM aguardando_aprovacao),
    'valor', (SELECT valor FROM aguardando_aprovacao)
  ),
  'aguardandoAssinatura', json_build_object(
    'qtd', (SELECT qtd FROM aguardando_assinatura),
    'valor', (SELECT valor FROM aguardando_assinatura)
  ),
  'totalEsteira', json_build_object(
    'qtd', (SELECT qtd FROM aguardando_aprovacao) + (SELECT qtd FROM aguardando_assinatura),
    'valor', (SELECT valor FROM aguardando_aprovacao) + (SELECT valor FROM aguardando_assinatura)
  ),
  'pedidos', (SELECT val FROM lista_pedidos)
);
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_pedidos_pendentes_esteira(date, date, integer, text, text) TO anon, authenticated, service_role;
