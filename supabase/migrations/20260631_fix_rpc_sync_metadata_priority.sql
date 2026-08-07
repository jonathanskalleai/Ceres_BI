-- =============================================================================
-- Migration: Fix rpc_etl_status to prioritize sync_metadata.last_sync_at
-- Author: @dev (Dex)
-- Date: 2026-06-31
-- =============================================================================
-- Problem:
--   RPC retorna last_sync_at=14:30 (sync_log) mas sync_metadata tem 21:59 (real)
--   Causa: ETL Python atualiza sync_control + sync_log, mas triggers Supabase
--          apenas atualizam sync_metadata
--
-- Solution:
--   1. last_sync_at = m.last_sync_at (sync_metadata) - fonte confiavel
--   2. status = COALESCE(sl.status, 'success') - do log, fallback success
--   3. error_message = sl.error_message - mantem do log
--   4. CTEs mantidas para performance
--
-- Prerequisites:
--   - Migracao 20260630_fix_table_name_regex_v2.sql aplicada
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.rpc_etl_status();
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
    WITH latest_logs AS (
      -- CTE mantida para buscar status/error do log (nao para timestamp)
      SELECT DISTINCT ON (sl.view_name)
        sl.view_name,
        sl.status,
        sl.error_message,
        sl.started_at
      FROM mirror.sync_log sl
      ORDER BY sl.view_name, sl.started_at DESC
    )
    SELECT
      -- table_name: nome da tabela no schema mirror
      -- VW_Ceres_CRM_Acoes -> CRM_Acoes -> crm_acoes
      -- VW_Ceres_AtendimentoOS -> AtendimentoOS -> Atendimento_OS -> atendimento_os
      -- VW_Ceres_OrdemServico -> OrdemServico -> Ordem_Servico -> ordem_servico
      LOWER(
        TRIM(BOTH '_' FROM
          REGEXP_REPLACE(
            REGEXP_REPLACE(m.view_name, '^VW_Ceres_', ''),
            '([a-z])([A-Z])', '\1_\2', 'g'
          )
        )
      ) AS table_name,

      -- source_view: nome original da view de origem
      m.view_name AS source_view,

      -- rows_synced: quantidade de linhas sincronizadas
      COALESCE(m.row_count, 0) AS rows_synced,

      -- last_sync_at: MOMENTO DO ULTIMO SYNC (PRIORIDADE: sync_metadata)
      -- sync_metadata.last_sync_at e a fonte confiavel porque:
      --   - Triggers Supabase sempre atualizam sync_metadata
      --   - sync_log pode ter logs antigos se trigger nao inserir
      m.last_sync_at AS last_sync_at,

      -- status: derivado do log mais recente (running/success/error/null)
      -- Fallback para 'success' se log nao existir (metadata atual = sucesso)
      COALESCE(ll.status, 'success'::text) AS status,

      -- error_message: mensagem de erro do log mais recente
      ll.error_message AS error_message,

      -- minutes_since_sync: minutos desde o ultimo run real
      -- Usa m.last_sync_at (fonte confiavel) para calcular intervalo
      GREATEST(0,
        EXTRACT(EPOCH FROM (
          NOW() - COALESCE(m.last_sync_at, NOW())
        ))::int / 60
      ) AS minutes_since_sync

    FROM mirror.sync_metadata m
    LEFT JOIN latest_logs ll ON ll.view_name = m.view_name
    ORDER BY m.last_sync_at DESC NULLS LAST
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- =============================================================================
-- GRANT + RELOAD
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.rpc_etl_status() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
