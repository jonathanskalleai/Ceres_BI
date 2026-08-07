-- =====================================================================
-- 20260707 — RPCs para aba "Graficos" da CRM Overview
-- =====================================================================
-- 2 novas RPCs com janela fixa 12m rolling (mesma estrategia de
-- rpc_evolucao_mensal / rpc_negocios_bi).
--
-- 1) rpc_evolucao_negocios_12m — ganhos/perdidos/total por mes, dedup ngo_numero
-- 2) rpc_evolucao_tipos_acao_12m — top N tipos de acao como series (flat para pivot)
--
-- Indices existentes que suportam:
--   idx_crm_negocios_datacadastro, idx_crm_acoes_dthconclusao
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) rpc_evolucao_negocios_12m
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_evolucao_negocios_12m(text);

CREATE OR REPLACE FUNCTION public.rpc_evolucao_negocios_12m(
  p_vendedor text DEFAULT NULL
)
RETURNS TABLE(
  mes text,
  total bigint,
  ganhos bigint,
  perdidos bigint,
  valor_ganho numeric,
  valor_perdido numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH deduped AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_datacadastro,
      n.ngo_vlrtotalnegociado,
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) IN ('ganho')
             OR LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) IN ('perdido')
             OR LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        ELSE 'andamento'
      END AS status_class
    FROM mirror.crm_negocios n
    WHERE n.ngo_datacadastro::date >= (date_trunc('month', CURRENT_DATE) - interval '11 months')::date
      AND n.ngo_datacadastro::date <= CURRENT_DATE
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  )
  SELECT
    TO_CHAR(d.ngo_datacadastro::date, 'YYYY-MM') AS mes,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE d.status_class = 'ganho')::bigint AS ganhos,
    COUNT(*) FILTER (WHERE d.status_class = 'perdido')::bigint AS perdidos,
    COALESCE(SUM(d.ngo_vlrtotalnegociado::numeric) FILTER (WHERE d.status_class = 'ganho'), 0) AS valor_ganho,
    COALESCE(SUM(d.ngo_vlrtotalnegociado::numeric) FILTER (WHERE d.status_class = 'perdido'), 0) AS valor_perdido
  FROM deduped d
  WHERE d.ngo_datacadastro IS NOT NULL
  GROUP BY TO_CHAR(d.ngo_datacadastro::date, 'YYYY-MM')
  ORDER BY mes;
$$;

-- ---------------------------------------------------------------------
-- 2) rpc_evolucao_tipos_acao_12m
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_evolucao_tipos_acao_12m(text, int);

CREATE OR REPLACE FUNCTION public.rpc_evolucao_tipos_acao_12m(
  p_vendedor text DEFAULT NULL,
  p_limit int DEFAULT 8
)
RETURNS TABLE(
  mes text,
  tipo_acao text,
  total bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH top_tipos AS (
    SELECT a.aco_tipoacao
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date >= (date_trunc('month', CURRENT_DATE) - interval '11 months')::date
      AND a.aco_dthconclusao::date <= CURRENT_DATE
      AND a.aco_tipoacao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
    GROUP BY a.aco_tipoacao
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  )
  SELECT
    TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM') AS mes,
    a.aco_tipoacao AS tipo_acao,
    COUNT(*)::bigint AS total
  FROM mirror.crm_acoes a
  WHERE a.aco_dthconclusao::date >= (date_trunc('month', CURRENT_DATE) - interval '11 months')::date
    AND a.aco_dthconclusao::date <= CURRENT_DATE
    AND a.aco_tipoacao IS NOT NULL
    AND a.aco_tipoacao IN (SELECT aco_tipoacao FROM top_tipos)
    AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
  GROUP BY TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM'), a.aco_tipoacao
  ORDER BY mes, tipo_acao;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
