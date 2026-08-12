-------------------------------------------------------------------------------
-- Mapa /bi/acoes alinhado aos indicadores do funil do período.
--
-- O mapa anterior selecionava qualquer negócio que recebeu uma ação no
-- intervalo. Isso fazia o mapa divergir da dashboard: por exemplo, em agosto
-- retornava 25 em andamento / 5 ganhos / 1 perdido enquanto o funil auditado
-- retornava 15 oportunidades / 2 ganhos / 2 perdidos.
--
-- Contrato único da página:
--   oportunidades = primeira entrada histórica no funil VENDAS no período;
--   ganhos        = pedido Aprovado no período (negócio canônico Ganho);
--   perdidos      = negócio canônico Perdido, data de fechamento no período;
--   Repasse de Máquina fica sempre fora.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_mapa_oportunidades(
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_etapa,
      n.ngo_datafechamento,
      n.cli_idcliente,
      n.cli_nome,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT
      b.*,
      NULLIF(u.usr_nomeusuario, '') AS consultor,
      mirror.fn_cli_cidade(b.cli_idcliente) AS cidade
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
    SELECT nc.*, ev.data_entrada_vendas
    FROM primeira_entrada_vendas ev
    JOIN negocios_canonicos nc ON nc.ngo_numero = ev.ngo_numero
    WHERE p_from IS NOT NULL
      AND p_to IS NOT NULL
      AND ev.data_entrada_vendas BETWEEN p_from AND p_to
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
  ),
  pedidos_dedup AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_dthaprovacao,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    WHERE p.pdo_codigointerno IS NOT NULL
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  ganhos_periodo AS MATERIALIZED (
    SELECT
      pd.ngo_numero,
      COUNT(*)::int AS pedidos_aprovados
    FROM pedidos_dedup pd
    JOIN coorte_oportunidades co ON co.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_situacaopedido = 'Aprovado'
      AND pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND co.ngo_conclusao = 'Ganho'
    GROUP BY pd.ngo_numero
  ),
  perdidos_periodo AS MATERIALIZED (
    SELECT co.ngo_numero
    FROM coorte_oportunidades co
    WHERE co.ngo_conclusao = 'Perdido'
      AND co.ngo_datafechamento::date BETWEEN p_from AND p_to
  ),
  acoes_periodo AS MATERIALIZED (
    SELECT
      a.ngo_nronegocio,
      COUNT(*)::int AS acoes_no_periodo,
      MAX(a.aco_dthconclusao::date) AS ultima_acao_periodo
    FROM mirror.crm_acoes a
    JOIN coorte_oportunidades co ON co.ngo_numero = a.ngo_nronegocio
    WHERE a.aco_dthconclusao IS NOT NULL
      AND a.aco_dthconclusao::date BETWEEN p_from AND p_to
    GROUP BY a.ngo_nronegocio
  ),
  clientes_coorte AS MATERIALIZED (
    SELECT DISTINCT cli_idcliente
    FROM coorte_oportunidades
    WHERE cli_idcliente IS NOT NULL
  ),
  -- Localização mais recente do cliente, com fallback do cadastro da carteira.
  coord_acao AS MATERIALIZED (
    SELECT DISTINCT ON (a.cli_idcliente)
      a.cli_idcliente,
      a.aco_lat::numeric AS lat,
      a.aco_lon::numeric AS lon
    FROM mirror.crm_acoes a
    JOIN clientes_coorte cc ON cc.cli_idcliente = a.cli_idcliente
    WHERE a.aco_lat ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND a.aco_lon ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND ABS(a.aco_lat::numeric) > 0.001
      AND ABS(a.aco_lon::numeric) > 0.001
    ORDER BY a.cli_idcliente, a.aco_dthconclusao DESC NULLS LAST
  ),
  coord_carteira AS MATERIALIZED (
    SELECT DISTINCT ON (c.cli_idcliente)
      c.cli_idcliente,
      c.cli_lat::numeric AS lat,
      c.cli_lon::numeric AS lon
    FROM mirror.crm_carteira_clientes c
    JOIN clientes_coorte cc ON cc.cli_idcliente = c.cli_idcliente
    WHERE c.cli_lat ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND c.cli_lon ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND ABS(c.cli_lat::numeric) > 0.001
      AND ABS(c.cli_lon::numeric) > 0.001
    ORDER BY c.cli_idcliente, c.usr_idusuario
  ),
  ultima_acao_geral AS MATERIALIZED (
    SELECT a.ngo_nronegocio, MAX(a.aco_dthconclusao::date) AS ultima
    FROM mirror.crm_acoes a
    JOIN coorte_oportunidades co ON co.ngo_numero = a.ngo_nronegocio
    WHERE a.aco_dthconclusao IS NOT NULL
    GROUP BY a.ngo_nronegocio
  ),
  resolvido AS MATERIALIZED (
    SELECT
      co.ngo_numero,
      co.cli_idcliente,
      co.cli_nome,
      co.cidade,
      co.ngo_etapa,
      co.ngo_vlrtotalnegociado,
      co.consultor,
      COALESCE(ap.acoes_no_periodo, 0) AS acoes_no_periodo,
      ap.ultima_acao_periodo,
      CASE
        WHEN gp.ngo_numero IS NOT NULL THEN 'ganho'
        WHEN pp.ngo_numero IS NOT NULL THEN 'perdido'
        ELSE 'aberto'
      END AS situacao,
      COALESCE(ca.lat, cc.lat) AS lat,
      COALESCE(ca.lon, cc.lon) AS lon,
      CASE
        WHEN ca.lat IS NOT NULL THEN 'acao'
        WHEN cc.lat IS NOT NULL THEN 'carteira'
      END AS origem_coord,
      (CURRENT_DATE - uag.ultima) AS dias_parado
    FROM coorte_oportunidades co
    LEFT JOIN ganhos_periodo gp ON gp.ngo_numero = co.ngo_numero
    LEFT JOIN perdidos_periodo pp ON pp.ngo_numero = co.ngo_numero
    LEFT JOIN acoes_periodo ap ON ap.ngo_nronegocio = co.ngo_numero
    LEFT JOIN coord_acao ca ON ca.cli_idcliente = co.cli_idcliente
    LEFT JOIN coord_carteira cc ON cc.cli_idcliente = co.cli_idcliente
    LEFT JOIN ultima_acao_geral uag ON uag.ngo_nronegocio = co.ngo_numero
  )
  SELECT json_build_object(
    'pinos', COALESCE((
      SELECT json_agg(row_to_json(sub) ORDER BY sub."valor" DESC NULLS LAST)
      FROM (
        SELECT
          r.ngo_numero AS "negocio",
          r.cli_nome AS "cliente",
          r.cidade AS "cidade",
          r.ngo_etapa AS "etapa",
          r.ngo_vlrtotalnegociado AS "valor",
          r.consultor AS "consultor",
          r.situacao AS "situacao",
          r.acoes_no_periodo AS "acoesNoPeriodo",
          r.ultima_acao_periodo AS "ultimaAcaoPeriodo",
          r.lat::float8 AS "lat",
          r.lon::float8 AS "lon",
          r.origem_coord AS "origemCoord",
          r.dias_parado AS "diasParado"
        FROM resolvido r
        WHERE r.lat IS NOT NULL AND r.lon IS NOT NULL
      ) sub
    ), '[]'::json),
    'total', (SELECT COUNT(*) FROM resolvido),
    'comCoordenada', (SELECT COUNT(*) FROM resolvido WHERE lat IS NOT NULL AND lon IS NOT NULL),
    'semCoordenada', (SELECT COUNT(*) FROM resolvido WHERE lat IS NULL OR lon IS NULL),
    'valorTotal', (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0) FROM resolvido),
    'valorNoMapa', (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0) FROM resolvido WHERE lat IS NOT NULL AND lon IS NOT NULL),
    'meta', json_build_object(
      'viaAcao', (SELECT COUNT(*) FROM resolvido WHERE origem_coord = 'acao'),
      'viaCarteira', (SELECT COUNT(*) FROM resolvido WHERE origem_coord = 'carteira'),
      'abertos', (SELECT COUNT(*) FROM resolvido WHERE situacao = 'aberto'),
      -- Mesmo grão do card: pedidos aprovados, não negócios marcados como ganho.
      'ganhos', (SELECT COALESCE(SUM(pedidos_aprovados), 0) FROM ganhos_periodo),
      'perdidos', (SELECT COUNT(*) FROM perdidos_periodo)
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text, date, date) IS
  'Mapa /bi/acoes no mesmo contrato do funil: primeira entrada em VENDAS no período; ganho por pedido Aprovado; perdido por fechamento. Exclui REPASSE DE MAQUINA.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text, date, date)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
