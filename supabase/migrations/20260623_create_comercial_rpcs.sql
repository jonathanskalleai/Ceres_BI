-- Migration: RPCs para agregacao comercial (server-side)
-- Move a logica de aggregateComercial.ts para o banco
-- Autor: @data-engineer (Dara)
-- Data: 2026-06-23

-------------------------------------------------------------------------------
-- INDICES (IF NOT EXISTS — idempotent)
-------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_crm_acoes_dthconclusao
  ON mirror.crm_acoes (aco_dthconclusao);

CREATE INDEX IF NOT EXISTS idx_crm_acoes_vendedor
  ON mirror.crm_acoes (aco_vendedor);

CREATE INDEX IF NOT EXISTS idx_crm_acoes_cidade
  ON mirror.crm_acoes (emp_cidade);

CREATE INDEX IF NOT EXISTS idx_crm_acoes_vendedor_dthconclusao
  ON mirror.crm_acoes (aco_vendedor, aco_dthconclusao);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_numero
  ON mirror.crm_negocios (ngo_numero);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_vendedores
  ON mirror.crm_negocios (ngo_vendedores);

-------------------------------------------------------------------------------
-- RPC 1: rpc_kpis_comercial
-- Retorna JSON com totais agregados para a tab Comercial
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_kpis_comercial(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH acoes_filtradas AS (
    SELECT
      a.cli_nome,
      a.aco_vendedor,
      a.emp_cidade,
      a.aco_tipocontato,
      a.aco_tipoacao,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  ),
  pipeline AS (
    SELECT COALESCE(SUM(n.ngo_vlrtotalnegociado::numeric), 0) AS total
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IN (
      SELECT DISTINCT af.ngo_nronegocio
      FROM acoes_filtradas af
      WHERE af.ngo_nronegocio IS NOT NULL
    )
    AND (n.ngo_conclusao IS NULL OR LOWER(n.ngo_conclusao) NOT LIKE '%perd%')
  )
  SELECT json_build_object(
    'totalRegistros', (SELECT COUNT(*) FROM acoes_filtradas),
    'totalClientes', (SELECT COUNT(DISTINCT cli_nome) FROM acoes_filtradas WHERE cli_nome IS NOT NULL),
    'totalConsultores', (SELECT COUNT(DISTINCT aco_vendedor) FROM acoes_filtradas WHERE aco_vendedor IS NOT NULL),
    'totalCidades', (SELECT COUNT(DISTINCT emp_cidade) FROM acoes_filtradas WHERE emp_cidade IS NOT NULL),
    'totalPipeline', (SELECT total FROM pipeline),
    'totalVisitas', (SELECT COUNT(*) FROM acoes_filtradas WHERE LOWER(aco_tipocontato) LIKE '%visita%'),
    'tiposContato', (
      SELECT COALESCE(json_object_agg(tc, cnt), '{}')
      FROM (
        SELECT aco_tipocontato AS tc, COUNT(*) AS cnt
        FROM acoes_filtradas
        WHERE aco_tipocontato IS NOT NULL
        GROUP BY aco_tipocontato
      ) sub
    ),
    'tiposAcao', (
      SELECT COALESCE(json_object_agg(ta, cnt), '{}')
      FROM (
        SELECT aco_tipoacao AS ta, COUNT(*) AS cnt
        FROM acoes_filtradas
        WHERE aco_tipoacao IS NOT NULL
        GROUP BY aco_tipoacao
      ) sub
    )
  );
$$;

-------------------------------------------------------------------------------
-- RPC 2: rpc_ranking_vendedores
-- Retorna ranking de vendedores por acoes, visitas, clientes, pipeline
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_ranking_vendedores(
  p_from date,
  p_to date,
  p_limit int DEFAULT 20
)
RETURNS TABLE(
  vendedor text,
  acoes bigint,
  visitas bigint,
  clientes bigint,
  pipeline numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH acoes_filtradas AS (
    SELECT
      a.aco_vendedor,
      a.cli_nome,
      a.aco_tipocontato,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND a.aco_vendedor IS NOT NULL
  ),
  vendedor_stats AS (
    SELECT
      af.aco_vendedor AS vendedor,
      COUNT(*) AS acoes,
      COUNT(*) FILTER (WHERE LOWER(af.aco_tipocontato) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT af.cli_nome) FILTER (WHERE af.cli_nome IS NOT NULL) AS clientes
    FROM acoes_filtradas af
    GROUP BY af.aco_vendedor
  ),
  vendedor_pipeline AS (
    SELECT
      af.aco_vendedor AS vendedor,
      COALESCE(SUM(n.ngo_vlrtotalnegociado::numeric), 0) AS pipeline
    FROM (
      SELECT DISTINCT aco_vendedor, ngo_nronegocio
      FROM acoes_filtradas
      WHERE ngo_nronegocio IS NOT NULL
    ) af
    JOIN mirror.crm_negocios n ON n.ngo_numero = af.ngo_nronegocio
    WHERE n.ngo_conclusao IS NULL OR LOWER(n.ngo_conclusao) NOT LIKE '%perd%'
    GROUP BY af.aco_vendedor
  )
  SELECT
    vs.vendedor,
    vs.acoes,
    vs.visitas,
    vs.clientes,
    COALESCE(vp.pipeline, 0) AS pipeline
  FROM vendedor_stats vs
  LEFT JOIN vendedor_pipeline vp ON vp.vendedor = vs.vendedor
  ORDER BY COALESCE(vp.pipeline, 0) DESC, vs.acoes DESC
  LIMIT p_limit;
$$;

-------------------------------------------------------------------------------
-- RPC 3: rpc_evolucao_mensal
-- Retorna serie temporal mensal (acoes, visitas, valor pipeline)
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_evolucao_mensal(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL
)
RETURNS TABLE(
  mes text,
  acoes bigint,
  visitas bigint,
  valor numeric,
  clientes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH acoes_filtradas AS (
    SELECT
      TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM') AS ym,
      a.cli_nome,
      a.aco_tipocontato,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  ),
  mensal AS (
    SELECT
      af.ym,
      COUNT(*) AS acoes,
      COUNT(*) FILTER (WHERE LOWER(af.aco_tipocontato) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT af.cli_nome) FILTER (WHERE af.cli_nome IS NOT NULL) AS clientes
    FROM acoes_filtradas af
    GROUP BY af.ym
  ),
  valor_mensal AS (
    SELECT
      af.ym,
      COALESCE(SUM(n.ngo_vlrtotalnegociado::numeric), 0) AS valor
    FROM (
      SELECT DISTINCT ym, ngo_nronegocio
      FROM acoes_filtradas
      WHERE ngo_nronegocio IS NOT NULL
    ) af
    JOIN mirror.crm_negocios n ON n.ngo_numero = af.ngo_nronegocio
    WHERE n.ngo_conclusao IS NULL OR LOWER(n.ngo_conclusao) NOT LIKE '%perd%'
    GROUP BY af.ym
  )
  SELECT
    m.ym AS mes,
    m.acoes,
    m.visitas,
    COALESCE(vm.valor, 0) AS valor,
    m.clientes
  FROM mensal m
  LEFT JOIN valor_mensal vm ON vm.ym = m.ym
  ORDER BY m.ym;
$$;

-------------------------------------------------------------------------------
-- RPC 4: rpc_ranking_regioes
-- Retorna ranking de cidades por acoes, valor, clientes
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_ranking_regioes(
  p_from date,
  p_to date,
  p_limit int DEFAULT 20
)
RETURNS TABLE(
  cidade text,
  acoes bigint,
  valor numeric,
  clientes bigint,
  visitas bigint,
  lat double precision,
  lng double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH acoes_filtradas AS (
    SELECT
      a.emp_cidade,
      a.cli_nome,
      a.aco_tipocontato,
      a.ngo_nronegocio,
      a.aco_lat,
      a.aco_lon
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND a.emp_cidade IS NOT NULL
  ),
  cidade_stats AS (
    SELECT
      af.emp_cidade AS cidade,
      COUNT(*) AS acoes,
      COUNT(*) FILTER (WHERE LOWER(af.aco_tipocontato) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT af.cli_nome) FILTER (WHERE af.cli_nome IS NOT NULL) AS clientes,
      AVG(af.aco_lat::numeric) FILTER (WHERE af.aco_lat IS NOT NULL) AS lat,
      AVG(af.aco_lon::numeric) FILTER (WHERE af.aco_lon IS NOT NULL) AS lng
    FROM acoes_filtradas af
    GROUP BY af.emp_cidade
  ),
  cidade_valor AS (
    SELECT
      af.emp_cidade AS cidade,
      COALESCE(SUM(n.ngo_vlrtotalnegociado::numeric), 0) AS valor
    FROM (
      SELECT DISTINCT emp_cidade, ngo_nronegocio
      FROM acoes_filtradas
      WHERE ngo_nronegocio IS NOT NULL
    ) af
    JOIN mirror.crm_negocios n ON n.ngo_numero = af.ngo_nronegocio
    WHERE n.ngo_conclusao IS NULL OR LOWER(n.ngo_conclusao) NOT LIKE '%perd%'
    GROUP BY af.emp_cidade
  )
  SELECT
    cs.cidade,
    cs.acoes,
    COALESCE(cv.valor, 0) AS valor,
    cs.clientes,
    cs.visitas,
    cs.lat::double precision,
    cs.lng::double precision
  FROM cidade_stats cs
  LEFT JOIN cidade_valor cv ON cv.cidade = cs.cidade
  ORDER BY cs.acoes DESC
  LIMIT p_limit;
$$;

-------------------------------------------------------------------------------
-- RPC 5: rpc_clientes_por_vendedor
-- Retorna lista de clientes de um vendedor com metricas
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_clientes_por_vendedor(
  p_vendedor text,
  p_from date,
  p_to date
)
RETURNS TABLE(
  cliente text,
  cidade text,
  acoes bigint,
  visitas bigint,
  valor numeric,
  dias_sem_contato int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH acoes_filtradas AS (
    SELECT
      a.cli_nome,
      a.emp_cidade,
      a.aco_tipocontato,
      a.ngo_nronegocio,
      a.aco_dthconclusao::date AS dt_conclusao
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND a.aco_vendedor = p_vendedor
      AND a.cli_nome IS NOT NULL
  ),
  cliente_stats AS (
    SELECT
      af.cli_nome AS cliente,
      MAX(af.emp_cidade) AS cidade,
      COUNT(*) AS acoes,
      COUNT(*) FILTER (WHERE LOWER(af.aco_tipocontato) LIKE '%visita%') AS visitas,
      (CURRENT_DATE - MAX(af.dt_conclusao))::int AS dias_sem_contato
    FROM acoes_filtradas af
    GROUP BY af.cli_nome
  ),
  cliente_valor AS (
    SELECT
      af.cli_nome AS cliente,
      COALESCE(SUM(n.ngo_vlrtotalnegociado::numeric), 0) AS valor
    FROM (
      SELECT DISTINCT cli_nome, ngo_nronegocio
      FROM acoes_filtradas
      WHERE ngo_nronegocio IS NOT NULL
    ) af
    JOIN mirror.crm_negocios n ON n.ngo_numero = af.ngo_nronegocio
    WHERE n.ngo_conclusao IS NULL OR LOWER(n.ngo_conclusao) NOT LIKE '%perd%'
    GROUP BY af.cli_nome
  )
  SELECT
    cs.cliente,
    cs.cidade,
    cs.acoes,
    cs.visitas,
    COALESCE(cv.valor, 0) AS valor,
    cs.dias_sem_contato
  FROM cliente_stats cs
  LEFT JOIN cliente_valor cv ON cv.cliente = cs.cliente
  ORDER BY cs.acoes DESC;
$$;

-------------------------------------------------------------------------------
-- Reload PostgREST schema cache
-------------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
