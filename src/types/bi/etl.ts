// Types for rpc_etl_status + rpc_etl_log (server-side aggregation)

export interface EtlSyncStatus {
  table_name: string;
  source_view: string;
  rows_synced: number;
  last_sync_at: string;
  status: string;
  error_message: string | null;
  minutes_since_sync: number;
}

export interface EtlRunLog {
  view_name: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  rows_affected: number | null;
  duration_ms: number | null;
  error_message: string | null;
}
