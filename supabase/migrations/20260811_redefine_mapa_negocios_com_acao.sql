-------------------------------------------------------------------------------
-- Mapa de Negócios com Ação — recorte comercial do período selecionado.
--
-- A versão anterior misturava dois conceitos: mostrava o estoque atual de
-- negócios Em Andamento e ainda incluía REPASSE DE MAQUINA. Isso divergia dos
-- indicadores comerciais da tela e escondia negócios que tiveram ação no
-- período, mas desde então foram Ganhos ou Perdidos.
--
-- Novo contrato:
--   * somente negócios com ação concluída no período selecionado;
--   * REPASSE DE MAQUINA nunca entra;
--   * exibe o status atual do negócio: aberto, ganho ou perdido;
--   * mantém a coordenada mais recente do cliente e o fallback da carteira.
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
  WITH acoes_periodo AS MATERIALIZED (
    SELECT
      a.ngo_nronegocio,
      COUNT(*)::int AS acoes_no_periodo,
      MAX(a.aco_dthconclusao::date) AS ultima_acao_periodo
    FROM mirror.crm_acoes a
    WHERE p_from IS NOT NULL
      AND p_to IS NOT NULL
      AND a.aco_dthconclusao IS NOT NULL
      AND a.ngo_nronegocio IS NOT NULL
      AND a.ngo_nronegocio <> ''
      AND a.aco_dthconclusao::date BETWEEN p_from AND p_to
    GROUP BY a.ngo_nronegocio
  ),
  negocios_dedup AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_etapa,
      n.cli_idcliente,
      n.cli_nome,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  negocios_tocados AS MATERIALIZED (
    SELECT
      nd.*,
      ap.acoes_no_periodo,
      ap.ultima_acao_periodo,
      u.usr_nomeusuario AS consultor,
      CASE nd.ngo_conclusao
        WHEN 'Ganho' THEN 'ganho'
        WHEN 'Perdido' THEN 'perdido'
        ELSE 'aberto'
      END AS situacao
    FROM acoes_periodo ap
    JOIN negocios_dedup nd ON nd.ngo_numero = ap.ngo_nronegocio
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = nd.ngo_vendedores
     AND nd.ngo_vendedores IS NOT NULL
     AND nd.ngo_vendedores <> ''
    WHERE nd.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nd.ngo_conclusao IN ('Em Andamento', 'Ganho', 'Perdido')
      AND (p_vendedor IS NULL OR u.usr_nomeusuario = p_vendedor)
      AND (p_cidade IS NULL OR mirror.fn_cli_cidade(nd.cli_idcliente) = p_cidade)
  ),
  clientes_tocados AS MATERIALIZED (
    SELECT DISTINCT cli_idcliente
    FROM negocios_tocados
    WHERE cli_idcliente IS NOT NULL
  ),
  -- Coordenada mais recente conhecida do cliente. A ação pode pertencer a
  -- outro negócio do mesmo cliente; ainda assim é sua melhor localização.
  coord_acao AS MATERIALIZED (
    SELECT DISTINCT ON (a.cli_idcliente)
      a.cli_idcliente,
      a.aco_lat::numeric AS lat,
      a.aco_lon::numeric AS lon
    FROM mirror.crm_acoes a
    JOIN clientes_tocados ct ON ct.cli_idcliente = a.cli_idcliente
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
    JOIN clientes_tocados ct ON ct.cli_idcliente = c.cli_idcliente
    WHERE c.cli_lat ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND c.cli_lon ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND ABS(c.cli_lat::numeric) > 0.001
      AND ABS(c.cli_lon::numeric) > 0.001
    ORDER BY c.cli_idcliente, c.usr_idusuario
  ),
  ultima_acao_geral AS MATERIALIZED (
    SELECT a.ngo_nronegocio, MAX(a.aco_dthconclusao::date) AS ultima
    FROM mirror.crm_acoes a
    JOIN negocios_tocados nt ON nt.ngo_numero = a.ngo_nronegocio
    WHERE a.aco_dthconclusao IS NOT NULL
    GROUP BY a.ngo_nronegocio
  ),
  resolvido AS MATERIALIZED (
    SELECT
      nt.ngo_numero,
      nt.cli_idcliente,
      nt.cli_nome,
      nt.ngo_etapa,
      nt.ngo_vlrtotalnegociado,
      nt.consultor,
      nt.situacao,
      nt.acoes_no_periodo,
      nt.ultima_acao_periodo,
      COALESCE(ca.lat, cc.lat) AS lat,
      COALESCE(ca.lon, cc.lon) AS lon,
      CASE
        WHEN ca.lat IS NOT NULL THEN 'acao'
        WHEN cc.lat IS NOT NULL THEN 'carteira'
      END AS origem_coord,
      (CURRENT_DATE - uag.ultima) AS dias_parado
    FROM negocios_tocados nt
    LEFT JOIN coord_acao ca ON ca.cli_idcliente = nt.cli_idcliente
    LEFT JOIN coord_carteira cc ON cc.cli_idcliente = nt.cli_idcliente
    LEFT JOIN ultima_acao_geral uag ON uag.ngo_nronegocio = nt.ngo_numero
  )
  SELECT json_build_object(
    'pinos', COALESCE((
      SELECT json_agg(row_to_json(sub) ORDER BY sub."valor" DESC NULLS LAST)
      FROM (
        SELECT
          r.ngo_numero AS "negocio",
          r.cli_nome AS "cliente",
          mirror.fn_cli_cidade(r.cli_idcliente) AS "cidade",
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
      'ganhos', (SELECT COUNT(*) FROM resolvido WHERE situacao = 'ganho'),
      'perdidos', (SELECT COUNT(*) FROM resolvido WHERE situacao = 'perdido')
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text, date, date) IS
  'Mapa /bi/acoes: negócios comerciais com ação concluída no período. Exclui REPASSE DE MAQUINA e mostra o status atual aberto, ganho ou perdido. Coordenada: última ação geolocalizada do cliente, com fallback da carteira.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text, date, date)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
