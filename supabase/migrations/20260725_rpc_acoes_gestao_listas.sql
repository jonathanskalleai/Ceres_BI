-------------------------------------------------------------------------------
-- rpc_acoes_gestao_listas — as 3 listas de clientes da gestao comercial,
-- PAGINADAS server-side. Cobre os pedidos 3/4/5 e 9.
--
-- p_tipo ∈ ('sem_contato' | 'desperdicio' | 'negativas')
--
-- POR QUE RPC SEPARADA (E2): estas listas tem cardinalidade ILIMITADA — a
-- carteira tem 8.731 clientes distintos. Acopla-las ao agregado
-- (rpc_acoes_funil_gestao) repetiria o erro do rpc_acoes_bi v3: MB de JSON
-- viajando para uma tela que renderiza 10 linhas. Mesmo contrato de paginacao
-- do rpc_acoes_detalhe v4: p_limit / p_offset / p_search, retorno {rows, total}.
--
-- Orcamento: <= 300ms.
--
-- ===========================================================================
-- p_tipo = 'sem_contato'  (pedido 4 — drill-down do chart "Clientes em Risco")
-- ===========================================================================
-- Carteira ordenada por dias desde a ultima acao (mais parado primeiro).
--
-- A regra de dias e IDENTICA a de rpc_acoes_clientes_risco, de proposito: esta
-- lista e o drill-down daquele grafico. Ultima acao no ANO CORRENTE; cliente
-- sem nenhuma acao no ano recebe dias = 999 e cai na faixa '+90' (86% da
-- carteira esta la — valor alto esperado, nao e bug). Divergir da regra faria
-- a soma da lista nao bater com a barra clicada, e o gestor perderia a
-- confianca nos dois graficos de uma vez.
--
-- p_dias_min / p_dias_max recortam a faixa clicada (ex: 31 e 60). Ambos
-- DEFAULT NULL = carteira inteira.
--
-- temOportunidadeAberta separa "cliente esquecido" de "cliente esquecido COM
-- dinheiro na mesa" — sao dois problemas de urgencia bem diferente.
--
-- ===========================================================================
-- p_tipo = 'desperdicio'  (pedidos 3 e 5 — scatter "Esforco x Retorno")
-- ===========================================================================
-- Clientes com >= 3 visitas no periodo, com a contagem de oportunidades
-- comerciais levantadas, ordenados por (oportunidades ASC, visitas DESC).
--
-- DECISAO EXPLICITA: NAO filtro por `oportunidades = 0`. O topo da lista JA E
-- exatamente "muitas visitas / zero oportunidade" por causa da ordenacao, e
-- devolver a curva inteira alimenta o scatter Esforco x Retorno (E4) sem uma
-- 4a RPC. Filtrar no servidor colapsaria um dos eixos do grafico.
--
-- ===========================================================================
-- p_tipo = 'negativas'  (pedido 9)
-- ===========================================================================
-- Clientes cujos ULTIMOS 3 negocios comerciais sao TODOS 'Perdido', com o
-- mpr_dscmotivoperda de cada um. Nao existe campo de "negativa" em crm_acoes:
-- aco_acaovalida e 'Sim' em 30.351 de 30.355 registros — inutil como sinal.
--
-- Ordenacao ESTAVEL obrigatoria: ngo_datacadastro DESC, ngo_numero DESC. So
-- ngo_datacadastro empata e faz a lista oscilar entre dois loads da pagina —
-- o gestor ve "a lista mudou sozinha" e para de confiar na tela.
--
-- Cliente com 1 ou 2 negocios perdidos NAO entra (a regra e 3, decisao do
-- usuario). Isso e intencional e precisa aparecer no rodape do card, senao a
-- lista parece incompleta/quebrada. meta.clientesCom3OuMaisNegocios da o
-- denominador para essa legenda.
--
-- NUMERO MEDIDO (banco vivo, 2026-07-25): apenas 7 clientes atendem a regra,
-- de 236 com >= 3 negocios comerciais. A lista e CURTA por natureza — isso
-- NAO e bug e precisa estar escrito no card.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_gestao_listas(
  p_tipo text,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL,
  p_dias_min int DEFAULT NULL,
  p_dias_max int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_limit  int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000);
  v_offset int  := GREATEST(COALESCE(p_offset, 0), 0);
  -- ILIKE precisa do %..%; NULL/vazio desliga o filtro
  v_search text := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  c_funis_comerciais CONSTANT text[] := ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'];
BEGIN
  IF p_tipo NOT IN ('sem_contato', 'desperdicio', 'negativas') THEN
    RAISE EXCEPTION 'rpc_acoes_gestao_listas: p_tipo invalido (%). Use sem_contato | desperdicio | negativas.', p_tipo;
  END IF;

  -- =========================================================================
  IF p_tipo = 'sem_contato' THEN
  -- =========================================================================
    WITH negocios_dedup AS MATERIALIZED (
      SELECT DISTINCT ON (n.ngo_numero)
        n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.cli_idcliente
      FROM mirror.crm_negocios n
      WHERE n.ngo_numero IS NOT NULL
      ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
    ),
    -- clientes com pelo menos 1 negocio comercial em aberto
    abertos_por_cliente AS (
      SELECT DISTINCT nd.cli_idcliente
      FROM negocios_dedup nd
      WHERE nd.ngo_funil = ANY (c_funis_comerciais)
        AND nd.ngo_conclusao = 'Em Andamento'
        AND nd.cli_idcliente IS NOT NULL AND nd.cli_idcliente <> ''
    ),
    ultima_acao AS (
      SELECT a.cli_idcliente, MAX(a.aco_dthconclusao::date) AS ultima_data
      FROM mirror.crm_acoes a
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY a.cli_idcliente
    ),
    -- DISTINCT ON: a PK da carteira e (cli_idcliente, usr_idusuario), entao o
    -- mesmo cliente aparece UMA VEZ POR VENDEDOR. Sem isso a lista duplica.
    carteira_base AS (
      SELECT DISTINCT ON (c.cli_idcliente)
        c.cli_idcliente, c.cli_nome, c.cli_cidade, c.usr_nomeusuario
      FROM mirror.crm_carteira_clientes c
      WHERE (p_vendedor IS NULL OR c.usr_nomeusuario = p_vendedor)
        AND (p_cidade   IS NULL OR c.cli_cidade      = p_cidade)
        AND (v_search   IS NULL OR c.cli_nome ILIKE '%' || v_search || '%')
      ORDER BY c.cli_idcliente, c.usr_idusuario
    ),
    calc AS (
      SELECT
        cb.cli_idcliente,
        cb.cli_nome,
        cb.cli_cidade,
        cb.usr_nomeusuario,
        COALESCE(CURRENT_DATE - ua.ultima_data, 999) AS dias,
        ua.ultima_data,
        (ab.cli_idcliente IS NOT NULL) AS tem_oportunidade_aberta
      FROM carteira_base cb
      LEFT JOIN ultima_acao ua        ON ua.cli_idcliente = cb.cli_idcliente
      LEFT JOIN abertos_por_cliente ab ON ab.cli_idcliente = cb.cli_idcliente
    ),
    filtrado AS (
      SELECT * FROM calc
      WHERE (p_dias_min IS NULL OR dias >= p_dias_min)
        AND (p_dias_max IS NULL OR dias <= p_dias_max)
    ),
    paginado AS (
      SELECT json_build_object(
        'clienteId',              f.cli_idcliente,
        'cliente',                f.cli_nome,
        'cidade',                 f.cli_cidade,
        'consultor',              f.usr_nomeusuario,
        -- 999 e sentinela de "nenhuma acao no ano", nao um numero de dias real:
        -- o front deve exibir "sem acao no ano", nunca "999 dias".
        'dias',                   f.dias,
        'semAcaoNoAno',           (f.dias = 999),
        'ultimaAcao',             TO_CHAR(f.ultima_data, 'DD/MM/YYYY'),
        'temOportunidadeAberta',  f.tem_oportunidade_aberta
      ) AS row_json,
      f.dias, f.cli_nome
      FROM filtrado f
      ORDER BY f.dias DESC, f.cli_nome
      LIMIT v_limit OFFSET v_offset
    )
    SELECT json_build_object(
      'rows',  COALESCE((SELECT json_agg(p.row_json ORDER BY p.dias DESC, p.cli_nome) FROM paginado p), '[]'::json),
      'total', (SELECT COUNT(*) FROM filtrado),
      'meta',  json_build_object(
        'tipo', 'sem_contato',
        'comOportunidadeAberta', (SELECT COUNT(*) FROM filtrado WHERE tem_oportunidade_aberta),
        'semAcaoNoAno',          (SELECT COUNT(*) FROM filtrado WHERE dias = 999)
      )
    ) INTO result;

  -- =========================================================================
  ELSIF p_tipo = 'desperdicio' THEN
  -- =========================================================================
    WITH filtered AS MATERIALIZED (
      SELECT a.cli_idcliente, a.cli_nome, a.aco_tipocontato, a.ngo_nronegocio, a.aco_vendedor, a.emp_cidade
      FROM mirror.crm_acoes a
      WHERE a.aco_dthconclusao IS NOT NULL
        AND (p_from     IS NULL OR a.aco_dthconclusao::date >= p_from)
        AND (p_to       IS NULL OR a.aco_dthconclusao::date <= p_to)
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_cidade   IS NULL
             OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
        AND (v_search   IS NULL OR a.cli_nome ILIKE '%' || v_search || '%')
    ),
    negocios_dedup AS MATERIALIZED (
      SELECT DISTINCT ON (n.ngo_numero) n.ngo_numero, n.ngo_funil
      FROM mirror.crm_negocios n
      WHERE n.ngo_numero IS NOT NULL
      ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
    ),
    por_cliente AS (
      SELECT
        f.cli_idcliente,
        MIN(f.cli_nome) AS cli_nome,
        COUNT(*) FILTER (WHERE f.aco_tipocontato = 'Visita') AS visitas,
        COUNT(*) AS acoes,
        COUNT(DISTINCT nd.ngo_numero) AS oportunidades
      FROM filtered f
      LEFT JOIN negocios_dedup nd
        ON nd.ngo_numero = f.ngo_nronegocio
       AND f.ngo_nronegocio IS NOT NULL AND f.ngo_nronegocio <> ''
       AND nd.ngo_funil = ANY (c_funis_comerciais)
      WHERE f.cli_idcliente IS NOT NULL AND f.cli_idcliente <> ''
      GROUP BY f.cli_idcliente
    ),
    filtrado AS (
      SELECT * FROM por_cliente WHERE visitas >= 3
    ),
    paginado AS (
      SELECT json_build_object(
        'clienteId',     f.cli_idcliente,
        'cliente',       f.cli_nome,
        'cidade',        mirror.fn_cli_cidade(f.cli_idcliente),
        'visitas',       f.visitas,
        'acoes',         f.acoes,
        'oportunidades', f.oportunidades,
        -- visitas gastas por oportunidade levantada. NULL (nao 0) quando nao
        -- houve nenhuma: o front exibe "—". Esse e o eixo do desperdicio.
        'visitasPorOportunidade',
          ROUND(f.visitas::numeric / NULLIF(f.oportunidades, 0), 2)
      ) AS row_json,
      f.oportunidades, f.visitas, f.cli_nome
      FROM filtrado f
      ORDER BY f.oportunidades ASC, f.visitas DESC, f.cli_nome
      LIMIT v_limit OFFSET v_offset
    )
    SELECT json_build_object(
      'rows',  COALESCE((SELECT json_agg(p.row_json ORDER BY p.oportunidades ASC, p.visitas DESC, p.cli_nome) FROM paginado p), '[]'::json),
      'total', (SELECT COUNT(*) FROM filtrado),
      'meta',  json_build_object(
        'tipo', 'desperdicio',
        'minVisitas', 3,
        'semNenhumaOportunidade', (SELECT COUNT(*) FROM filtrado WHERE oportunidades = 0)
      )
    ) INTO result;

  -- =========================================================================
  ELSE  -- p_tipo = 'negativas'
  -- =========================================================================
    WITH negocios_dedup AS MATERIALIZED (
      SELECT DISTINCT ON (n.ngo_numero)
        n.ngo_numero, n.cli_idcliente, n.cli_nome, n.ngo_conclusao, n.ngo_funil,
        n.mpr_dscmotivoperda, n.ngo_datacadastro, n.ngo_vlrtotalnegociado, n.ngo_etapa
      FROM mirror.crm_negocios n
      WHERE n.ngo_numero IS NOT NULL
      ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
    ),
    comerciais AS (
      SELECT * FROM negocios_dedup
      WHERE ngo_funil = ANY (c_funis_comerciais)
        AND cli_idcliente IS NOT NULL AND cli_idcliente <> ''
        AND (v_search IS NULL OR cli_nome ILIKE '%' || v_search || '%')
    ),
    -- Ordenacao ESTAVEL: sem o desempate por ngo_numero a lista oscila entre loads.
    ranked AS (
      SELECT c.*,
        ROW_NUMBER() OVER (PARTITION BY c.cli_idcliente
                           ORDER BY c.ngo_datacadastro DESC NULLS LAST, c.ngo_numero DESC) AS rn,
        COUNT(*)     OVER (PARTITION BY c.cli_idcliente) AS total_negocios
      FROM comerciais c
    ),
    ultimos3 AS (
      SELECT * FROM ranked WHERE rn <= 3 AND total_negocios >= 3
    ),
    -- cliente entra so se os 3 mais recentes sao TODOS 'Perdido'
    alvo AS (
      SELECT cli_idcliente
      FROM ultimos3
      GROUP BY cli_idcliente
      HAVING COUNT(*) FILTER (WHERE ngo_conclusao = 'Perdido') = 3
    ),
    filtrado AS (
      SELECT
        u.cli_idcliente,
        MIN(u.cli_nome) AS cli_nome,
        MAX(u.ngo_datacadastro) AS ultima_data,
        SUM(u.ngo_vlrtotalnegociado) AS valor_perdido,
        json_agg(
          json_build_object(
            'negocio',     u.ngo_numero,
            'etapa',       u.ngo_etapa,
            'valor',       u.ngo_vlrtotalnegociado,
            'motivoPerda', NULLIF(u.mpr_dscmotivoperda, ''),
            'data',        TO_CHAR(u.ngo_datacadastro, 'DD/MM/YYYY')
          ) ORDER BY u.rn
        ) AS negocios
      FROM ultimos3 u
      JOIN alvo a ON a.cli_idcliente = u.cli_idcliente
      GROUP BY u.cli_idcliente
    ),
    paginado AS (
      SELECT json_build_object(
        'clienteId',    f.cli_idcliente,
        'cliente',      f.cli_nome,
        'cidade',       mirror.fn_cli_cidade(f.cli_idcliente),
        'valorPerdido', f.valor_perdido,
        'ultimaPerda',  TO_CHAR(f.ultima_data, 'DD/MM/YYYY'),
        'negocios',     f.negocios
      ) AS row_json,
      f.valor_perdido, f.cli_nome
      FROM filtrado f
      ORDER BY f.valor_perdido DESC NULLS LAST, f.cli_nome
      LIMIT v_limit OFFSET v_offset
    )
    SELECT json_build_object(
      'rows',  COALESCE((SELECT json_agg(p.row_json ORDER BY p.valor_perdido DESC NULLS LAST, p.cli_nome) FROM paginado p), '[]'::json),
      'total', (SELECT COUNT(*) FROM filtrado),
      'meta',  json_build_object(
        'tipo', 'negativas',
        'regra', 'ultimos 3 negocios comerciais TODOS Perdido',
        -- denominador da legenda: sem isso a lista curta parece bug
        'clientesCom3OuMaisNegocios', (SELECT COUNT(DISTINCT cli_idcliente) FROM ultimos3)
      )
    ) INTO result;

  END IF;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_gestao_listas(text, date, date, text, text, int, int, text, int, int) IS
  'Listas de gestao da carteira /bi/acoes, paginadas server-side. p_tipo: sem_contato (drill-down do chart de risco, mesma regra de dias do rpc_acoes_clientes_risco, use p_dias_min/p_dias_max para a faixa clicada) | desperdicio (>=3 visitas, ordenado por oportunidades ASC) | negativas (ultimos 3 negocios comerciais todos Perdido). Retorno {rows, total, meta}.';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_gestao_listas(text, date, date, text, text, int, int, text, int, int)
  TO anon, authenticated, service_role;
