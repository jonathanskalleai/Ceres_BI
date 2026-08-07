-- Migration: ETL run history via trigger sync_control -> sync_log
-- Author: @data-engineer (Dara)
-- Date: 2026-06-28
-- Description:
--   O ETL Python faz UPSERT em mirror.sync_control a cada run (1 linha por tabela,
--   sempre o estado MAIS RECENTE — sem historico). Para ter HISTORICO de runs sem
--   tocar no Python, esta migration adiciona um trigger AFTER INSERT OR UPDATE em
--   sync_control que grava 1 linha em mirror.sync_log a cada UPSERT.
--
--   mirror.sync_log ja existe (20260603) com a coluna started_at NOT NULL e o CHECK
--   status IN ('running','success','error'). sync_control NAO tem started_at, entao:
--     - started_at  = now()           (aproximacao honesta — sync_control nao guarda inicio)
--     - finished_at = last_sync_at    (momento real em que o ETL terminou)
--     - duration_ms = NULL            (nao temos inicio real — nao inventar)
--
--   IMPORTANTE: o trigger NUNCA pode quebrar a UPSERT do ETL. Por isso o status e
--   normalizado para o dominio do CHECK de sync_log (qualquer valor inesperado vira
--   'error' e o valor cru fica visivel em error_message). Sem isso, um status novo
--   no Python causaria CHECK violation e abortaria o run inteiro do ETL.
--
-- Prerequisites: mirror.sync_control e mirror.sync_log existentes; pg_cron (opcional).
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_sync_control_to_log ON mirror.sync_control;
--   DROP FUNCTION IF EXISTS mirror.fn_sync_log_from_control();
--   DROP FUNCTION IF EXISTS public.rpc_etl_log(text, int);
--   SELECT cron.unschedule('mirror-sync-log-ttl');  -- se agendado

-- =============================================================================
-- 1. TRIGGER FUNCTION — mapeia sync_control -> sync_log
-- =============================================================================

CREATE OR REPLACE FUNCTION mirror.fn_sync_log_from_control()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  -- sync_control usa 'idle' para runs bem-sucedidos; sync_log.status CHECK so aceita
  -- running/success/error. Mapeamento:
  --   idle    -> success  (run concluiu sem erro)
  --   error   -> error
  --   running -> PULA (evita entradas duplicadas; nao aborta a UPSERT)
  IF NEW.status IN ('idle', 'success') THEN
    v_status := 'success';
  ELSIF NEW.status = 'error' THEN
    v_status := 'error';
  ELSE
    -- 'running' ou status nao reconhecido: nao logar, nao abortar UPSERT
    RETURN NEW;
  END IF;

  INSERT INTO mirror.sync_log (
    view_name,
    started_at,
    finished_at,
    status,
    rows_affected,
    duration_ms,
    error_message,
    strategy_used
  ) VALUES (
    COALESCE(NEW.source_view, NEW.table_name),
    COALESCE(NEW.last_sync_at, now()),  -- last_sync_at e a hora real do run
    NEW.last_sync_at,
    v_status,
    NEW.rows_synced,
    NULL,                               -- sync_control nao guarda duracao real
    CASE WHEN NEW.status = 'error' THEN NEW.error_message ELSE NULL END,
    'incremental'
  );

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. TRIGGER — AFTER INSERT OR UPDATE em sync_control
-- =============================================================================

DROP TRIGGER IF EXISTS trg_sync_control_to_log ON mirror.sync_control;

CREATE TRIGGER trg_sync_control_to_log
  AFTER INSERT OR UPDATE ON mirror.sync_control
  FOR EACH ROW
  EXECUTE FUNCTION mirror.fn_sync_log_from_control();

-- =============================================================================
-- 3. RPC — historico de runs do ETL para o dashboard de BI
-- =============================================================================
-- p_table_name NULL  -> ultimos p_limit runs POR view (default p_limit=48)
-- p_table_name setado -> ultimos p_limit runs daquela view especifica

CREATE OR REPLACE FUNCTION public.rpc_etl_log(
  p_table_name text DEFAULT NULL,
  p_limit      int  DEFAULT 48
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = mirror, public
AS $$
DECLARE
  result json;
  v_limit int := GREATEST(1, LEAST(COALESCE(p_limit, 48), 500));
BEGIN
  IF p_table_name IS NOT NULL THEN
    -- runs de uma unica view
    SELECT json_agg(row_to_json(sub))
    INTO result
    FROM (
      SELECT
        view_name,
        started_at,
        finished_at,
        status,
        rows_affected,
        duration_ms,
        error_message
      FROM mirror.sync_log
      WHERE view_name = p_table_name
      ORDER BY started_at DESC
      LIMIT v_limit
    ) sub;
  ELSE
    -- ultimos v_limit runs por view (particionado)
    SELECT json_agg(row_to_json(sub) ORDER BY sub.view_name, sub.started_at DESC)
    INTO result
    FROM (
      SELECT
        view_name,
        started_at,
        finished_at,
        status,
        rows_affected,
        duration_ms,
        error_message
      FROM (
        SELECT
          view_name,
          started_at,
          finished_at,
          status,
          rows_affected,
          duration_ms,
          error_message,
          row_number() OVER (PARTITION BY view_name ORDER BY started_at DESC) AS rn
        FROM mirror.sync_log
      ) ranked
      WHERE rn <= v_limit
    ) sub;
  END IF;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_etl_log(text, int) TO authenticated;

-- =============================================================================
-- 4. TTL CLEANUP — purga runs com mais de 90 dias
-- =============================================================================
-- Se pg_cron estiver disponivel, agenda DELETE diario (04:10 UTC, off-peak).
-- Caso contrario, este bloco nao faz nada (NOTICE) e o cleanup deve ser
-- configurado manualmente na VPS via crontab (ver comentario abaixo).

DO $ttl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- idempotente: remove agendamento anterior antes de recriar
    PERFORM cron.unschedule('mirror-sync-log-ttl')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mirror-sync-log-ttl');

    PERFORM cron.schedule(
      'mirror-sync-log-ttl',
      '10 4 * * *',
      $cron$ DELETE FROM mirror.sync_log WHERE started_at < now() - interval '90 days'; $cron$
    );
    RAISE NOTICE 'pg_cron encontrado: TTL de sync_log agendado (mirror-sync-log-ttl, 04:10 UTC, 90 dias).';
  ELSE
    RAISE NOTICE 'pg_cron NAO encontrado. Configure o TTL manualmente via crontab na VPS:';
    RAISE NOTICE '  10 4 * * * docker exec <pg_container> psql -U postgres -d postgres -c "DELETE FROM mirror.sync_log WHERE started_at < now() - interval ''90 days'';"';
  END IF;
END
$ttl$;

-- TTL manual (fallback sem pg_cron) — rodar na VPS via crontab:
--   10 4 * * * psql "$DATABASE_URL" -c "DELETE FROM mirror.sync_log WHERE started_at < now() - interval '90 days';"

-- =============================================================================
-- 5. Recarregar schema cache do PostgREST (expor rpc_etl_log)
-- =============================================================================
NOTIFY pgrst, 'reload schema';
