-- Fix rpc_etl_status: usa sync_log para calcular freshness real do ETL.
-- Antes: last_sync_at = sync_control.last_sync_at (só atualiza quando há dados novos).
-- Depois: last_sync_at = MAX(sync_log.started_at) por view (quando o ETL rodou de fato).
-- Resultado: views que rodam mas não têm dados novos aparecem como OK em vez de ATENÇÃO.

SET ROLE supabase_admin;

DROP FUNCTION IF EXISTS public.rpc_etl_status();

CREATE FUNCTION public.rpc_etl_status()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(sub) ORDER BY sub.last_sync_at DESC NULLS LAST)
  INTO result
  FROM (
    SELECT
      sc.table_name,
      sc.source_view,
      sc.rows_synced,
      COALESCE(sl.last_run_at, sc.last_sync_at) AS last_sync_at,
      sc.status,
      sc.error_message,
      EXTRACT(EPOCH FROM (NOW() - COALESCE(sl.last_run_at, sc.last_sync_at)))::int / 60
        AS minutes_since_sync
    FROM mirror.sync_control sc
    LEFT JOIN (
      SELECT view_name, MAX(started_at) AS last_run_at
      FROM mirror.sync_log
      WHERE status IN ('success', 'running')
      GROUP BY view_name
    ) sl ON sl.view_name = sc.source_view
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_etl_status() TO anon, authenticated;

RESET ROLE;

NOTIFY pgrst, 'reload schema';
