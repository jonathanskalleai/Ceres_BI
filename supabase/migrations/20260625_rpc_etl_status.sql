-- ETL Monitor: exposes mirror.sync_control status for the BI dashboard
CREATE OR REPLACE FUNCTION public.rpc_etl_status()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(sub) ORDER BY sub.last_sync_at DESC)
  INTO result
  FROM (
    SELECT
      table_name,
      source_view,
      rows_synced,
      last_sync_at,
      status,
      error_message,
      EXTRACT(EPOCH FROM (NOW() - last_sync_at))::int / 60 AS minutes_since_sync
    FROM mirror.sync_control
    ORDER BY last_sync_at DESC
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

NOTIFY pgrst, 'reload schema';
