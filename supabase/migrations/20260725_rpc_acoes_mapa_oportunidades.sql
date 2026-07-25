-------------------------------------------------------------------------------
-- rpc_acoes_mapa_oportunidades — pinos dos negocios COMERCIAIS 'Em Andamento'
-- para o mapa de oportunidades abertas (pedido 6).
--
-- ===========================================================================
-- ASSINATURA — divergencia deliberada do plano (que previa p_from/p_to)
-- ===========================================================================
-- O mapa mostra o ESTOQUE de oportunidades vivas, nao o fluxo do periodo.
-- Restringir a "negocios tocados por acao na janela" derrubaria de 2.742 para
-- 578 e esconderia exatamente o negocio PARADO — que e o alvo do mapa (a
-- mediana de dias sem acao e 81). Como os parametros nao teriam efeito, eles
-- NAO entram na assinatura: parametro que mente e pior que parametro ausente,
-- porque o @dev passa o filtro, ve o mapa nao mudar e vai debugar o front.
-- (Mesma logica do `porMes` do rpc_acoes_bi, que ignora a janela — so que ali
-- o parametro existe e engana.)
--
-- p_vendedor filtra pelo DONO do negocio (ngo_vendedores -> usuarios), nao por
-- quem executou a acao: coerente com o lado-negocio da atribuicao hibrida (E1)
-- em rpc_acoes_funil_gestao. "Minhas oportunidades abertas" = as que sao minhas.
--
-- ===========================================================================
-- COORDENADA POR CASCATA (medida no banco vivo, 2026-07-25)
-- ===========================================================================
--   (1) ultima acao GEOLOCALIZADA do cliente (aco_lat/aco_lon) -> 2.230
--   (2) fallback cli_lat/cli_lon da carteira                   ->    10
--                                              com coordenada  -> 2.240
--                                              SEM coordenada  ->   502
--                                                        total -> 2.742
--
-- ARMADILHA: o "vazio" de aco_lat NAO e NULL nem '' — e a string literal
-- '0.0', presente em 7.106 acoes (mais 10.010 com string vazia). Sem o guard
-- ABS(...) > 0.001 o mapa planta um monte de pinos no Golfo da Guine (0,0).
-- A carteira sozinha cobriria so ~700 negocios (24%) pelo mesmo motivo — por
-- isso a acao vem PRIMEIRO na cascata, e nao o contrario.
--
-- O regex ^-?[0-9]+(\.[0-9]+)?$ antes do ::numeric nao e paranoia decorativa:
-- as colunas sao TEXT vindas de ETL. Hoje nao ha lixo nao-numerico (medido: 0),
-- mas um unico 'N/A' futuro derrubaria a RPC inteira com invalid input syntax,
-- e o mapa cairia sem aviso. O custo do regex esta medido no cabecalho de perf.
--
-- semCoordenada e RETORNADO no payload (nao e detalhe interno): 502 negocios
-- sumindo em silencio do mapa e falha por omissao — o gestor conta os pinos e
-- acha que tem 2.240 oportunidades abertas, quando tem 2.742. O front DEVE
-- exibir isso no rodape do card.
--
-- ===========================================================================
-- PERFORMANCE — pre-agregacao obrigatoria
-- ===========================================================================
-- A versao com LEFT JOIN LATERAL (... ORDER BY data DESC LIMIT 1) por negocio
-- NAO terminou em 120s no banco vivo: sao 2.742 lateral scans sobre 40.365
-- acoes, e nao ha indice em crm_acoes(cli_idcliente).
-- A versao abaixo resolve a coordenada UMA VEZ por cliente (DISTINCT ON) e
-- depois faz hash join: ~1s.  Ver 20260725_idx_acoes_gestao.sql para o indice
-- que derruba isso ainda mais.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_mapa_oportunidades(
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
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
  -- CASCATA (2): fallback da carteira. DISTINCT ON tambem aqui — a PK e
  -- (cli_idcliente, usr_idusuario), o mesmo cliente repete por vendedor.
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
  -- ultima acao do negocio -> dias parado (o que torna o pino acionavel)
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
    FROM abertos ab
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
    -- NUNCA remover: rows sem coordenada nao podem sumir em silencio
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

COMMENT ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text) IS
  'Pinos dos negocios comerciais Em Andamento para o mapa de oportunidades. Coordenada por cascata: ultima acao geolocalizada do cliente, fallback carteira (guard ABS>0.001 porque o vazio de aco_lat e a string 0.0). Retorna semCoordenada de proposito — rows sem coordenada nao somem em silencio. NAO aceita janela de datas: mostra o estoque aberto, nao o fluxo do periodo.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(text, text)
  TO anon, authenticated, service_role;
