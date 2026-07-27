-------------------------------------------------------------------------------
-- rpc_acoes_mapa_oportunidades v2 — adiciona toggle "Tocadas no mes"
--
-- Mantendo a versao existente (p_vendedor, p_cidade) intacta, cria uma NOVA
-- overload com (p_vendedor, p_cidade, p_from, p_to). PostgREST resolve pelo
-- numero de parametros enviados.
--
-- Comportamento:
--   p_from IS NULL AND p_to IS NULL → estoque (todas abertas) — identico a v1
--   p_from e p_to preenchidos → filtra por oportunidades que tiveram pelo menos
--   uma acao no periodo (JOIN com crm_acoes no range de datas)
--
-- Nao dropa a versao anterior — overload PostgreSQL permite as duas assinaturas.
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
  c_funis_comerciais CONSTANT text[] := ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'];
BEGIN
  WITH negocios_dedup AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.ngo_etapa,
      n.cli_idcliente, n.cli_nome, n.ngo_vlrtotalnegociado,
      n.ngo_vendedores, n.ngo_datacadastro
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  abertos AS MATERIALIZED (
    SELECT nd.*, u.usr_nomeusuario AS consultor
    FROM negocios_dedup nd
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = nd.ngo_vendedores
     AND nd.ngo_vendedores IS NOT NULL AND nd.ngo_vendedores <> ''
    WHERE nd.ngo_funil = ANY (c_funis_comerciais)
      AND nd.ngo_conclusao = 'Em Andamento'
      AND (p_vendedor IS NULL OR u.usr_nomeusuario = p_vendedor)
      AND (p_cidade   IS NULL OR mirror.fn_cli_cidade(nd.cli_idcliente) = p_cidade)
  ),
  -- Quando p_from/p_to preenchidos, filtrar por negocios com acao no periodo
  abertos_filtrado AS MATERIALIZED (
    SELECT ab.*
    FROM abertos ab
    WHERE (p_from IS NULL AND p_to IS NULL)
       OR EXISTS (
            SELECT 1
            FROM mirror.crm_acoes a
            WHERE a.ngo_nronegocio = ab.ngo_numero
              AND a.aco_dthconclusao::date BETWEEN p_from AND p_to
          )
  ),
  -- CASCATA (1): 1 coordenada por cliente, da acao geolocalizada mais recente
  coord_acao AS MATERIALIZED (
    SELECT DISTINCT ON (a.cli_idcliente)
      a.cli_idcliente,
      a.aco_lat::numeric AS lat,
      a.aco_lon::numeric AS lon
    FROM mirror.crm_acoes a
    WHERE a.aco_lat ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND a.aco_lon ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND ABS(a.aco_lat::numeric) > 0.001
      AND ABS(a.aco_lon::numeric) > 0.001
    ORDER BY a.cli_idcliente, a.aco_dthconclusao DESC NULLS LAST
  ),
  -- CASCATA (2): fallback da carteira
  coord_carteira AS MATERIALIZED (
    SELECT DISTINCT ON (c.cli_idcliente)
      c.cli_idcliente,
      c.cli_lat::numeric AS lat,
      c.cli_lon::numeric AS lon
    FROM mirror.crm_carteira_clientes c
    WHERE c.cli_lat ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND c.cli_lon ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND ABS(c.cli_lat::numeric) > 0.001
      AND ABS(c.cli_lon::numeric) > 0.001
    ORDER BY c.cli_idcliente, c.usr_idusuario
  ),
  -- ultima acao do negocio -> dias parado
  ultima_acao_negocio AS (
    SELECT a.ngo_nronegocio, MAX(a.aco_dthconclusao::date) AS ultima
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND a.ngo_nronegocio IS NOT NULL AND a.ngo_nronegocio <> ''
    GROUP BY a.ngo_nronegocio
  ),
  resolvido AS (
    SELECT
      ab.ngo_numero,
      ab.cli_idcliente,
      ab.cli_nome,
      ab.ngo_etapa,
      ab.ngo_vlrtotalnegociado,
      ab.consultor,
      COALESCE(ca.lat, cc.lat) AS lat,
      COALESCE(ca.lon, cc.lon) AS lon,
      CASE WHEN ca.lat IS NOT NULL THEN 'acao'
           WHEN cc.lat IS NOT NULL THEN 'carteira'
      END AS origem_coord,
      (CURRENT_DATE - uan.ultima) AS dias_parado
    FROM abertos_filtrado ab
    LEFT JOIN coord_acao     ca  ON ca.cli_idcliente   = ab.cli_idcliente
    LEFT JOIN coord_carteira cc  ON cc.cli_idcliente   = ab.cli_idcliente
    LEFT JOIN ultima_acao_negocio uan ON uan.ngo_nronegocio = ab.ngo_numero
  )
  SELECT json_build_object(
    'pinos', COALESCE((
      SELECT json_agg(row_to_json(sub) ORDER BY sub."valor" DESC NULLS LAST)
      FROM (
        SELECT
          r.ngo_numero            AS "negocio",
          r.cli_nome              AS "cliente",
          mirror.fn_cli_cidade(r.cli_idcliente) AS "cidade",
          r.ngo_etapa             AS "etapa",
          r.ngo_vlrtotalnegociado AS "valor",
          r.consultor             AS "consultor",
          r.lat::float8           AS "lat",
          r.lon::float8           AS "lon",
          r.origem_coord          AS "origemCoord",
          r.dias_parado           AS "diasParado"
        FROM resolvido r
        WHERE r.lat IS NOT NULL AND r.lon IS NOT NULL
      ) sub
    ), '[]'::json),
    'total',          (SELECT COUNT(*) FROM resolvido),
    'comCoordenada',  (SELECT COUNT(*) FROM resolvido WHERE lat IS NOT NULL),
    'semCoordenada',  (SELECT COUNT(*) FROM resolvido WHERE lat IS NULL),
    'valorTotal',     (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0) FROM resolvido),
    'valorNoMapa',    (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0) FROM resolvido WHERE lat IS NOT NULL),
    'meta', json_build_object(
      'viaAcao',     (SELECT COUNT(*) FROM resolvido WHERE origem_coord = 'acao'),
      'viaCarteira', (SELECT COUNT(*) FROM resolvido WHERE origem_coord = 'carteira')
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text, date, date) IS
  'Pinos dos negocios comerciais Em Andamento (v2). Sem p_from/p_to = estoque (todas abertas). Com p_from/p_to = filtra por negocios que tiveram acao no periodo (toggle "Tocadas no mes"). Coordenada por cascata: ultima acao geo > carteira. Guard ABS>0.001 contra string "0.0".';

-- Dropa a overload antiga com 2 params (o CREATE OR REPLACE nao a remove
-- automaticamente porque a assinatura mudou — agora e uma funcao DIFERENTE)
DROP FUNCTION IF EXISTS public.rpc_acoes_mapa_oportunidades(text, text);

GRANT EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text, date, date)
  TO anon, authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
