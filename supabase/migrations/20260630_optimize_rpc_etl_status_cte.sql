-- =============================================================================
-- Migration: Optimize rpc_etl_status with CTE (eliminate N+1 subqueries)
-- Author: @dev (Dex)
-- Date: 2026-06-30
-- =============================================================================
-- Problem:
--   O rpc_etl_status() original executava mirror.get_latest_sync_log(m.view_name)
--   4 vezes POR LINHA (finished_at, status, error_message, started_at).
--   Com N views, isso gerava 4N subquery executions — complexidade O(4N).
--
-- Solution:
--   Substituir as 4 subqueries por um CTE que busca o log mais recente UMA vez
--   por view, usando DISTINCT ON (view_name) ORDER BY started_at DESC.
--   Depois fazer LEFT JOIN com sync_metadata.
--   Resultado: O(1) table scan no sync_log + O(N) join.
--
-- Schema de retorno mantido:
--   table_name, source_view, rows_synced, last_sync_at, status,
--   error_message, minutes_since_sync
--
-- Prerequisites:
--   - mirror.sync_metadata (20260603_create_mirror_schema.sql)
--   - mirror.sync_log (20260603_create_mirror_schema.sql)
--   - Permissao de escrita no schema mirror
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.rpc_etl_status();
--   DROP FUNCTION IF EXISTS mirror.get_latest_sync_log(text);  -- se existir
--   -- Reverta para 20260629_fix_rpc_etl_status_freshness.sql
-- =============================================================================

SET ROLE supabase_admin;

-- Remove funcao helper antiga (nao e mais necessaria)
DROP FUNCTION IF EXISTS mirror.get_latest_sync_log(text);

-- =============================================================================
-- RPC PRINCIPAL — status consolidado do ETL (OTIMIZADO COM CTE)
-- =============================================================================

DROP FUNCTION IF EXISTS public.rpc_etl_status();

CREATE FUNCTION public.rpc_etl_status()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = mirror, public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(sub) ORDER BY sub.last_sync_at DESC NULLS LAST)
  INTO result
  FROM (
    WITH
    -- CTE: busca o log mais recente de cada view em uma unica passagem na tabela.
    -- DISTINCT ON (view_name) + ORDER BY garante o registro com started_at MAX.
    -- Isso substitui as 4 subqueries que existiam antes (lines 85, 91, 96, 102).
    latest_logs AS (
      SELECT DISTINCT ON (sl.view_name)
        sl.view_name,
        sl.status,
        sl.error_message,
        sl.started_at,
        sl.finished_at
      FROM mirror.sync_log sl
      ORDER BY sl.view_name, sl.started_at DESC
    )
    SELECT
      -- table_name: nome da tabela no schema mirror (derivado de view_name)
      -- VW_Ceres_CRM_Negocios -> crm_negocios (strip prefix + snake_case)
      LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(m.view_name, '^VW_Ceres_', ''),
          '([A-Z])', '_\1', 'g'
        )
      ) AS table_name,

      -- source_view: nome original da view de origem
      m.view_name AS source_view,

      -- rows_synced: quantidade de linhas sincronizadas
      COALESCE(m.row_count, 0) AS rows_synced,

      -- last_sync_at: momento do ultimo sync (prioriza finished_at do log, fallback para sync_metadata)
      COALESCE(ll.finished_at, m.last_sync_at) AS last_sync_at,

      -- status: derivado do log mais recente (running/success/error/null)
      COALESCE(ll.status, 'unknown'::text) AS status,

      -- error_message: mensagem de erro do log mais recente
      ll.error_message AS error_message,

      -- minutes_since_sync: minutos desde o ultimo run real
      -- Usa started_at do log para calcular o tempo real deexecucao
      GREATEST(0,
        EXTRACT(EPOCH FROM (
          NOW() - COALESCE(ll.started_at, m.last_sync_at)
        ))::int / 60
      ) AS minutes_since_sync

    FROM mirror.sync_metadata m
    -- LEFT JOIN com o CTE: busca o log mais recente de cada view
    LEFT JOIN latest_logs ll ON ll.view_name = m.view_name

    -- Mesma ordenacao da versao anterior
    ORDER BY m.last_sync_at DESC NULLS LAST
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- =============================================================================
-- GRANT + RELOAD
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.rpc_etl_status() TO anon, authenticated;

RESET ROLE;

NOTIFY pgrst, 'reload schema';
