-- =============================================================================
-- Migration: Fix table_name regex - only split between lowercase->uppercase
-- Author: @dev (Dex)
-- Date: 2026-06-30
-- =============================================================================
-- Problem:
--   Regex anterior inseria underscore em TODA letra maiuscula, causando:
--     VW_Ceres_CRM_Acoes -> c_r_m__acoes (errado)
--     VW_Ceres_AtendimentoOS -> atendimento_o_s (errado)
--
-- Solution:
--   1. Strip prefix VW_Ceres_
--   2. Inserir underscore APENAS entre sequencia lowercase->uppercase
--   3. TRIM underscores das pontas
--   4. Converter para lowercase
--
-- Regex melhorada: '([a-z])([A-Z])' -> '\1_\2'
--   - Match: lowercase seguido de uppercase
--   - VW_Ceres_CRM_Acoes -> CRM_Acoes -> (no split) -> crm_acoes
--   - VW_Ceres_AtendimentoOS -> AtendimentoOS -> Atendimento_OS -> atendimento_os
--
-- Prerequisites:
--   - Migration 20260630_fix_table_name_regex.sql aplicada
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

      -- last_sync_at: momento do ultimo sync (prioriza finished_at do log, fallback para sync_metadata)
      COALESCE(ll.finished_at, m.last_sync_at) AS last_sync_at,

      -- status: derivado do log mais recente (running/success/error/null)
      COALESCE(ll.status, 'unknown'::text) AS status,

      -- error_message: mensagem de erro do log mais recente
      ll.error_message AS error_message,

      -- minutes_since_sync: minutos desde o ultimo run real
      GREATEST(0,
        EXTRACT(EPOCH FROM (
          NOW() - COALESCE(ll.started_at, m.last_sync_at)
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