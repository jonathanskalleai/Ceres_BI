-- Migration: Drop orphaned sync_control trigger and function
-- Author: @dev (Dex)
-- Date: 2026-06-30
-- Description:
--   Remove artefatos orfaos deixados pela migration 20260628_etl_sync_log_trigger.sql.
--   Essa migration tentou criar um trigger em mirror.sync_control, MAS:
--     - A tabela mirror.sync_control NUNCA existiu no schema (resquicio do Zend)
--     - O ETL Python escreve em mirror.sync_metadata + mirror.sync_log
--     - O trigger e a funcao associada foram criados mas nunca dispararam
--
--   Artefatos removidos:
--     - Trigger: mirror.trg_sync_control_to_log
--     - Function: mirror.fn_sync_log_from_control
--
--   A funcao public.rpc_etl_log (mesma migration) NAO e removida porque
--   ainda e util para ver historico de runs do ETL.
--
-- Prerequisites: Nenhum (verificacao IF EXISTS garante idempotencia).
-- Rollback: Nao aplicavel (cleanup-only).

SET ROLE supabase_admin;

-- =============================================================================
-- 1. REMOVE TRIGGER (se existir)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_control_to_log'
      AND tgrelid = 'mirror.sync_control'::regclass
  ) THEN
    DROP TRIGGER IF EXISTS trg_sync_control_to_log ON mirror.sync_control;
    RAISE NOTICE 'Trigger trg_sync_control_to_log removido.';
  ELSE
    RAISE NOTICE 'Trigger trg_sync_control_to_log nao existe (OK - ja removido ou nunca criado).';
  END IF;
END
$$;

-- =============================================================================
-- 2. REMOVE FUNCTION (se existir)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'fn_sync_log_from_control'
      AND pronamespace = 'mirror'::regnamespace
  ) THEN
    DROP FUNCTION IF EXISTS mirror.fn_sync_log_from_control();
    RAISE NOTICE 'Function mirror.fn_sync_log_from_control() removida.';
  ELSE
    RAISE NOTICE 'Function mirror.fn_sync_log_from_control() nao existe (OK - ja removida ou nunca criada).';
  END IF;
END
$$;

RESET ROLE;

-- NOTIFY pgrst nao necessario (nao ha alteracao de schema visivel ao PostgREST)
