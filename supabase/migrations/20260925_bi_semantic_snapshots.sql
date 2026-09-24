-- Published semantic payloads used by the Import/Hybrid BI API.
-- RPCs remain only as refresh/canary sources while each dashboard migrates.

CREATE SCHEMA IF NOT EXISTS bi;

CREATE TABLE IF NOT EXISTS bi.semantic_snapshots (
    dashboard_id text NOT NULL,
    filter_key text NOT NULL,
    filters jsonb NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'ready'
        CHECK (status IN ('ready', 'refreshing', 'error')),
    data_version bigint NOT NULL DEFAULT 1,
    source_from date,
    source_to date,
    snapshot_at timestamptz NOT NULL DEFAULT now(),
    last_error_code text,
    last_error text,
    PRIMARY KEY (dashboard_id, filter_key)
);

CREATE INDEX IF NOT EXISTS idx_bi_semantic_snapshots_freshness
    ON bi.semantic_snapshots (dashboard_id, snapshot_at DESC);

ALTER TABLE bi.semantic_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS semantic_snapshots_api_read ON bi.semantic_snapshots;
CREATE POLICY semantic_snapshots_api_read
    ON bi.semantic_snapshots
    FOR SELECT
    TO PUBLIC
    USING (true);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
        GRANT USAGE ON SCHEMA bi TO ceres_bi_api;
        GRANT SELECT ON bi.semantic_snapshots TO ceres_bi_api;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bi.publish_semantic_snapshot(
    p_dashboard_id text,
    p_filter_key text,
    p_filters jsonb,
    p_payload jsonb,
    p_source_from date DEFAULT NULL,
    p_source_to date DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bi, pg_catalog
AS $$
DECLARE
    v_version bigint;
BEGIN
    IF p_dashboard_id IS NULL OR btrim(p_dashboard_id) = '' THEN
        RAISE EXCEPTION 'dashboard_id é obrigatório';
    END IF;
    IF p_filter_key IS NULL OR btrim(p_filter_key) = '' THEN
        RAISE EXCEPTION 'filter_key é obrigatório';
    END IF;
    IF p_payload IS NULL THEN
        RAISE EXCEPTION 'payload é obrigatório';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext('ceresbi.bi.semantic_snapshot.' || p_dashboard_id || '.' || p_filter_key)
    );

    SELECT COALESCE(data_version, 0) + 1
      INTO v_version
      FROM bi.semantic_snapshots
     WHERE dashboard_id = p_dashboard_id
       AND filter_key = p_filter_key;
    v_version := COALESCE(v_version, 1);

    INSERT INTO bi.semantic_snapshots (
        dashboard_id, filter_key, filters, payload, status, data_version,
        source_from, source_to, snapshot_at, last_error_code, last_error
    ) VALUES (
        p_dashboard_id, p_filter_key, COALESCE(p_filters, '{}'::jsonb), p_payload,
        'ready', v_version, p_source_from, p_source_to, now(), NULL, NULL
    )
    ON CONFLICT (dashboard_id, filter_key)
    DO UPDATE SET filters = EXCLUDED.filters,
                  payload = EXCLUDED.payload,
                  status = 'ready',
                  data_version = EXCLUDED.data_version,
                  source_from = EXCLUDED.source_from,
                  source_to = EXCLUDED.source_to,
                  snapshot_at = now(),
                  last_error_code = NULL,
                  last_error = NULL;

    RETURN v_version;
END;
$$;

REVOKE ALL ON TABLE bi.semantic_snapshots FROM PUBLIC;
REVOKE ALL ON FUNCTION bi.publish_semantic_snapshot(text, text, jsonb, jsonb, date, date) FROM PUBLIC;

ALTER FUNCTION bi.publish_semantic_snapshot(text, text, jsonb, jsonb, date, date)
    OWNER TO supabase_admin;

-- Refresh only the two highest-value semantic contracts in the first slice.
-- The generic API remains DirectQuery-safe for every other catalogued RPC, so a
-- failed snapshot refresh never blocks a dashboard or fabricates empty values.
CREATE OR REPLACE FUNCTION bi.refresh_semantic_snapshots(
    p_from date DEFAULT date_trunc('year', current_date)::date,
    p_to date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bi, public, mirror, pg_catalog
AS $$
DECLARE
    v_from date := COALESCE(p_from, date_trunc('year', current_date)::date);
    v_to date := COALESCE(p_to, current_date);
    v_filters jsonb;
    v_year_filters jsonb;
    v_empty_filters jsonb := '{}'::jsonb;
    v_count integer := 0;
    v_payload jsonb;
BEGIN
    IF v_from > v_to THEN
        RAISE EXCEPTION 'p_from não pode ser posterior a p_to';
    END IF;

    v_filters := jsonb_strip_nulls(jsonb_build_object('p_from', v_from, 'p_to', v_to));

    v_payload := public.rpc_desempenho_vendas_bi(
        v_from, v_to, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    )::jsonb;
    v_year_filters := jsonb_build_object('p_ano', EXTRACT(YEAR FROM v_from)::integer);
    PERFORM bi.publish_semantic_snapshot(
        'desempenho', md5(v_filters::text), v_filters, v_payload, v_from, v_to
    );
    PERFORM bi.publish_semantic_snapshot(
        'desempenho', md5(v_year_filters::text), v_year_filters, v_payload, v_from, v_to
    );
    PERFORM bi.publish_semantic_snapshot(
        'desempenho', md5(v_empty_filters::text), v_empty_filters, v_payload, v_from, v_to
    );
    v_count := v_count + 1;

    v_payload := public.rpc_acoes_bi_periodo(v_from, v_to, NULL, NULL, NULL)::jsonb;
    PERFORM bi.publish_semantic_snapshot(
        'rpc.rpc_acoes_bi_periodo', md5(v_filters::text), v_filters, v_payload, v_from, v_to
    );
    v_count := v_count + 1;

    RETURN jsonb_build_object(
        'status', 'ready',
        'source_from', v_from,
        'source_to', v_to,
        'snapshots', v_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'error_code', SQLSTATE,
        'error_message', left(SQLERRM, 500)
    );
END;
$$;

ALTER FUNCTION bi.refresh_semantic_snapshots(date, date) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION bi.refresh_semantic_snapshots(date, date) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_refresh') THEN
        GRANT EXECUTE ON FUNCTION bi.refresh_semantic_snapshots(date, date) TO ceres_bi_refresh;
    END IF;
END;
$$;
