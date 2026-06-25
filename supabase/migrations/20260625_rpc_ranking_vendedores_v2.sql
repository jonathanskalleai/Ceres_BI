-- rpc_ranking_vendedores_v2: expanded ranking with negocios, conversao, crm_quality
-- Sessão B — CRM migration
-- JOIN: crm_negocios.ngo_numero = crm_acoes.ngo_nronegocio (sem underscore na coluna PK de negocios)

DROP FUNCTION IF EXISTS public.rpc_ranking_vendedores_v2(date, date, int);

CREATE OR REPLACE FUNCTION public.rpc_ranking_vendedores_v2(
  p_from date,
  p_to date,
  p_limit int DEFAULT 20
)
RETURNS TABLE(
  vendedor text,
  acoes bigint,
  visitas bigint,
  clientes bigint,
  pipeline numeric,
  negocios bigint,
  conversao int,
  crm_quality int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      a.aco_vendedor AS vendedor,
      COUNT(*) AS acoes,
      COUNT(*) FILTER (WHERE a.aco_tipocontato ILIKE '%visita%') AS visitas,
      COUNT(DISTINCT a.cli_nome) AS clientes,
      CASE WHEN COUNT(*) > 0
        THEN (COUNT(*) FILTER (
          WHERE a.aco_atividadeexecutada IS NOT NULL
            AND a.aco_atividadeexecutada <> ''
        ) * 100 / COUNT(*))::int
        ELSE 0
      END AS crm_quality
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND a.aco_vendedor IS NOT NULL
      AND a.aco_vendedor <> ''
    GROUP BY a.aco_vendedor
  ),
  negocios_vinculados AS (
    SELECT DISTINCT
      a.aco_vendedor AS vendedor,
      a.ngo_nronegocio,
      n.ngo_conclusao,
      n.ngo_vlrtotalnegociado
    FROM mirror.crm_acoes a
    INNER JOIN mirror.crm_negocios n
      ON n.ngo_numero = a.ngo_nronegocio
    WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
      AND a.aco_vendedor IS NOT NULL
      AND a.aco_vendedor <> ''
      AND a.ngo_nronegocio IS NOT NULL
      AND a.ngo_nronegocio <> ''
  ),
  neg_agg AS (
    SELECT
      nv.vendedor,
      COUNT(DISTINCT nv.ngo_nronegocio) AS negocios,
      COALESCE(SUM(nv.ngo_vlrtotalnegociado) FILTER (
        WHERE nv.ngo_conclusao NOT ILIKE '%ganho%'
          AND nv.ngo_conclusao NOT ILIKE '%perd%'
      ), 0) AS pipeline,
      COUNT(DISTINCT nv.ngo_nronegocio) FILTER (
        WHERE nv.ngo_conclusao ILIKE '%ganho%'
      ) AS ganhos,
      COUNT(DISTINCT nv.ngo_nronegocio) FILTER (
        WHERE nv.ngo_conclusao ILIKE '%perd%'
      ) AS perdidos
    FROM negocios_vinculados nv
    GROUP BY nv.vendedor
  )
  SELECT
    b.vendedor,
    b.acoes,
    b.visitas,
    b.clientes,
    COALESCE(na.pipeline, 0) AS pipeline,
    COALESCE(na.negocios, 0)::bigint AS negocios,
    CASE WHEN COALESCE(na.ganhos, 0) + COALESCE(na.perdidos, 0) > 0
      THEN (na.ganhos * 100 / (na.ganhos + na.perdidos))::int
      ELSE 0
    END AS conversao,
    b.crm_quality
  FROM base b
  LEFT JOIN neg_agg na ON na.vendedor = b.vendedor
  ORDER BY b.acoes DESC
  LIMIT p_limit;
$$;
