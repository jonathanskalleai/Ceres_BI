-- Ceres BI: physical read models for Import/Composite-style dashboard reads.
-- The mirror schema remains the synchronized source of truth.  The bi schema
-- contains only rebuildable aggregates and publication metadata.

CREATE SCHEMA IF NOT EXISTS bi;

CREATE TABLE IF NOT EXISTS bi.refresh_manifest (
    model_name        text PRIMARY KEY,
    status            text NOT NULL DEFAULT 'never_run'
        CHECK (status IN ('never_run', 'refreshing', 'ready', 'error')),
    data_version      bigint NOT NULL DEFAULT 0,
    source_from       date,
    source_to         date,
    row_count         bigint NOT NULL DEFAULT 0,
    last_started_at   timestamptz,
    last_completed_at timestamptz,
    last_error_code   text,
    last_error        text,
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bi.refresh_runs (
    run_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at   timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    status       text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'error')),
    source_from  date NOT NULL,
    source_to    date NOT NULL,
    row_count    bigint NOT NULL DEFAULT 0,
    error_code   text,
    error_message text
);

CREATE TABLE IF NOT EXISTS bi.acoes_daily (
    day              date NOT NULL,
    vendedor         text NOT NULL DEFAULT '',
    cidade           text NOT NULL DEFAULT '',
    tipo_acao        text NOT NULL DEFAULT '',
    total_acoes      bigint NOT NULL DEFAULT 0,
    acoes_concluidas bigint NOT NULL DEFAULT 0,
    acoes_validas    bigint NOT NULL DEFAULT 0,
    visitas          bigint NOT NULL DEFAULT 0,
    geolocalizadas   bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (day, vendedor, cidade, tipo_acao)
);

CREATE INDEX IF NOT EXISTS idx_bi_acoes_daily_filters
    ON bi.acoes_daily (day, vendedor, cidade);

CREATE TABLE IF NOT EXISTS bi.negocios_daily (
    day            date NOT NULL,
    vendedor       text NOT NULL DEFAULT '',
    cidade         text NOT NULL DEFAULT '',
    funil          text NOT NULL DEFAULT '',
    etapa          text NOT NULL DEFAULT '',
    conclusao      text NOT NULL DEFAULT '',
    total_negocios bigint NOT NULL DEFAULT 0,
    valor_total    numeric(18, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (day, vendedor, cidade, funil, etapa, conclusao)
);

CREATE INDEX IF NOT EXISTS idx_bi_negocios_daily_filters
    ON bi.negocios_daily (day, vendedor, cidade, funil);

CREATE TABLE IF NOT EXISTS bi.pedidos_daily (
    day            date NOT NULL,
    vendedor       text NOT NULL DEFAULT '',
    cidade         text NOT NULL DEFAULT '',
    situacao       text NOT NULL DEFAULT '',
    total_pedidos  bigint NOT NULL DEFAULT 0,
    valor_total    numeric(18, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (day, vendedor, cidade, situacao)
);

CREATE INDEX IF NOT EXISTS idx_bi_pedidos_daily_filters
    ON bi.pedidos_daily (day, vendedor, cidade, situacao);

CREATE TABLE IF NOT EXISTS bi.servicos_daily (
    day             date NOT NULL,
    cidade          text NOT NULL DEFAULT '',
    status          text NOT NULL DEFAULT '',
    total_os        bigint NOT NULL DEFAULT 0,
    os_encerradas   bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (day, cidade, status)
);

CREATE INDEX IF NOT EXISTS idx_bi_servicos_daily_filters
    ON bi.servicos_daily (day, cidade, status);

INSERT INTO bi.refresh_manifest (model_name)
VALUES ('acoes_daily'), ('negocios_daily'), ('pedidos_daily'), ('servicos_daily')
ON CONFLICT (model_name) DO NOTHING;

CREATE OR REPLACE FUNCTION bi.refresh_read_models(
    p_from date DEFAULT (current_date - 730),
    p_to date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = bi, mirror, public, pg_catalog
AS $$
DECLARE
    v_from date := COALESCE(p_from, current_date - 730);
    v_to date := COALESCE(p_to, current_date);
    v_run_id uuid := gen_random_uuid();
    v_rows bigint := 0;
    v_model text;
BEGIN
    IF v_from > v_to THEN
        RAISE EXCEPTION 'p_from não pode ser posterior a p_to';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('ceresbi.bi.refresh_read_models'));

    INSERT INTO bi.refresh_runs (run_id, source_from, source_to)
    VALUES (v_run_id, v_from, v_to);

    UPDATE bi.refresh_manifest
       SET status = 'refreshing',
           source_from = v_from,
           source_to = v_to,
           last_started_at = now(),
           last_error_code = NULL,
           last_error = NULL,
           updated_at = now()
     WHERE model_name IN ('acoes_daily', 'negocios_daily', 'pedidos_daily', 'servicos_daily');

    DELETE FROM bi.acoes_daily WHERE day BETWEEN v_from AND v_to;
    INSERT INTO bi.acoes_daily (
        day, vendedor, cidade, tipo_acao, total_acoes, acoes_concluidas,
        acoes_validas, visitas, geolocalizadas
    )
    SELECT
        aco_dthconclusao::date,
        COALESCE(NULLIF(btrim(aco_vendedor), ''), '(sem vendedor)'),
        COALESCE(NULLIF(btrim(emp_cidade), ''), '(sem cidade)'),
        COALESCE(NULLIF(btrim(aco_tipoacao), ''), '(sem tipo)'),
        count(*),
        count(*) FILTER (WHERE lower(COALESCE(aco_status, '')) IN
            ('concluida', 'concluído', 'concluida ', 'finalizada', 'finalizado', 'concluido')),
        count(*) FILTER (WHERE lower(COALESCE(aco_acaovalida, '')) IN ('s', 'sim', 'true', '1')),
        count(*) FILTER (WHERE upper(COALESCE(aco_tipocontato, '')) LIKE '%VISIT%'),
        count(*) FILTER (WHERE aco_lat IS NOT NULL AND aco_lon IS NOT NULL)
    FROM mirror.crm_acoes
    WHERE aco_dthconclusao IS NOT NULL
      AND aco_dthconclusao::date BETWEEN v_from AND v_to
    GROUP BY 1, 2, 3, 4;

    UPDATE bi.refresh_manifest
       SET row_count = (SELECT count(*) FROM bi.acoes_daily WHERE day BETWEEN v_from AND v_to),
           data_version = data_version + 1,
           status = 'ready',
           last_completed_at = now(),
           updated_at = now()
     WHERE model_name = 'acoes_daily';

    DELETE FROM bi.negocios_daily WHERE day BETWEEN v_from AND v_to;
    INSERT INTO bi.negocios_daily (
        day, vendedor, cidade, funil, etapa, conclusao, total_negocios, valor_total
    )
    WITH canonical AS (
        SELECT DISTINCT ON (ngo_numero)
            COALESCE(ngo_datafechamento, ngo_datacadastro, dthregistro)::date AS day,
            COALESCE(NULLIF(btrim(ngo_vendedores), ''), '(sem vendedor)') AS vendedor,
            COALESCE(NULLIF(btrim(emp_cidade), ''), '(sem cidade)') AS cidade,
            COALESCE(NULLIF(btrim(ngo_funil), ''), '(sem funil)') AS funil,
            COALESCE(NULLIF(btrim(ngo_etapa), ''), '(sem etapa)') AS etapa,
            COALESCE(NULLIF(btrim(ngo_conclusao), ''), '(sem conclusão)') AS conclusao,
            COALESCE(ngo_vlrtotalnegociado, 0)::numeric AS valor_total
        FROM mirror.crm_negocios
        WHERE COALESCE(ngo_datafechamento, ngo_datacadastro, dthregistro)::date
              BETWEEN v_from AND v_to
        ORDER BY ngo_numero, ngo_dataatualizacao DESC NULLS LAST,
                 dthregistro DESC NULLS LAST, prd_idnegocioxproduto DESC
    )
    SELECT day, vendedor, cidade, funil, etapa, conclusao,
           count(*), sum(valor_total)
    FROM canonical
    GROUP BY 1, 2, 3, 4, 5, 6;

    UPDATE bi.refresh_manifest
       SET row_count = (SELECT count(*) FROM bi.negocios_daily WHERE day BETWEEN v_from AND v_to),
           data_version = data_version + 1,
           status = 'ready',
           last_completed_at = now(),
           updated_at = now()
     WHERE model_name = 'negocios_daily';

    DELETE FROM bi.pedidos_daily WHERE day BETWEEN v_from AND v_to;
    INSERT INTO bi.pedidos_daily (day, vendedor, cidade, situacao, total_pedidos, valor_total)
    SELECT
        pdo_dthpedido::date,
        COALESCE(NULLIF(btrim(pdo_vendedor), ''), '(sem vendedor)'),
        COALESCE(NULLIF(btrim(emp_cidade), ''), '(sem cidade)'),
        COALESCE(NULLIF(btrim(pdo_situacaopedido), ''), '(sem situação)'),
        count(*),
        sum(COALESCE(pdo_vlrpedido, 0))
    FROM mirror.crm_pedidos
    WHERE pdo_dthpedido IS NOT NULL
      AND pdo_dthpedido::date BETWEEN v_from AND v_to
    GROUP BY 1, 2, 3, 4;

    UPDATE bi.refresh_manifest
       SET row_count = (SELECT count(*) FROM bi.pedidos_daily WHERE day BETWEEN v_from AND v_to),
           data_version = data_version + 1,
           status = 'ready',
           last_completed_at = now(),
           updated_at = now()
     WHERE model_name = 'pedidos_daily';

    DELETE FROM bi.servicos_daily WHERE day BETWEEN v_from AND v_to;
    INSERT INTO bi.servicos_daily (day, cidade, status, total_os, os_encerradas)
    SELECT
        COALESCE(os_dthabertura, dthregistro)::date,
        COALESCE(NULLIF(btrim(emp_cidade), ''), '(sem cidade)'),
        COALESCE(NULLIF(btrim(os_fstatus), ''), '(sem status)'),
        count(*),
        count(*) FILTER (WHERE os_dthencerramento IS NOT NULL)
    FROM mirror.ordens_servico
    WHERE COALESCE(os_dthabertura, dthregistro)::date BETWEEN v_from AND v_to
    GROUP BY 1, 2, 3;

    UPDATE bi.refresh_manifest
       SET row_count = (SELECT count(*) FROM bi.servicos_daily WHERE day BETWEEN v_from AND v_to),
           data_version = data_version + 1,
           status = 'ready',
           last_completed_at = now(),
           updated_at = now()
     WHERE model_name = 'servicos_daily';

    SELECT COALESCE(sum(row_count), 0) INTO v_rows
    FROM bi.refresh_manifest
    WHERE model_name IN ('acoes_daily', 'negocios_daily', 'pedidos_daily', 'servicos_daily');

    UPDATE bi.refresh_runs
       SET status = 'success', completed_at = now(), row_count = v_rows
     WHERE run_id = v_run_id;

    RETURN jsonb_build_object(
        'status', 'ready',
        'run_id', v_run_id,
        'source_from', v_from,
        'source_to', v_to,
        'row_count', v_rows
    );
EXCEPTION WHEN OTHERS THEN
    UPDATE bi.refresh_manifest
       SET status = 'error',
           last_error_code = SQLSTATE,
           last_error = left(SQLERRM, 1000),
           updated_at = now()
     WHERE model_name IN ('acoes_daily', 'negocios_daily', 'pedidos_daily', 'servicos_daily');
    INSERT INTO bi.refresh_runs (
        run_id, started_at, completed_at, status, source_from, source_to,
        row_count, error_code, error_message
    ) VALUES (
        v_run_id, now(), now(), 'error', v_from, v_to,
        0, SQLSTATE, left(SQLERRM, 1000)
    )
    ON CONFLICT (run_id) DO UPDATE
       SET completed_at = EXCLUDED.completed_at,
           status = 'error',
           error_code = EXCLUDED.error_code,
           error_message = EXCLUDED.error_message;
    RETURN jsonb_build_object(
        'status', 'error',
        'run_id', v_run_id,
        'error_code', SQLSTATE,
        'source_from', v_from,
        'source_to', v_to
    );
END;
$$;

-- The local Supabase administrator owns the mirror tables in this deployment.
-- Keep the refresh function under that owner so SECURITY DEFINER can write the
-- rebuildable read models without granting the worker broad table privileges.
ALTER FUNCTION bi.refresh_read_models(date, date) OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION bi.refresh_read_models(date, date) FROM PUBLIC;

CREATE OR REPLACE FUNCTION bi.read_model_quality()
RETURNS TABLE (
    model_name text,
    status text,
    source_rows bigint,
    model_rows bigint,
    delta bigint,
    checked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = bi, mirror, public, pg_catalog
AS $$
    WITH ranges AS (
        SELECT model_name, source_from, source_to
        FROM bi.refresh_manifest
        WHERE status = 'ready'
    ), counts AS (
        SELECT
            'acoes_daily'::text AS model_name,
            (SELECT count(*) FROM mirror.crm_acoes a, ranges r
              WHERE r.model_name = 'acoes_daily'
                AND a.aco_dthconclusao::date BETWEEN r.source_from AND r.source_to) AS source_rows,
            (SELECT COALESCE(sum(a.total_acoes), 0) FROM bi.acoes_daily a, ranges r
              WHERE r.model_name = 'acoes_daily'
                AND a.day BETWEEN r.source_from AND r.source_to) AS model_rows
        UNION ALL
        SELECT
            'negocios_daily',
            (SELECT count(DISTINCT n.ngo_numero) FROM mirror.crm_negocios n, ranges r
              WHERE r.model_name = 'negocios_daily'
                AND COALESCE(n.ngo_datafechamento, n.ngo_datacadastro, n.dthregistro)::date
                    BETWEEN r.source_from AND r.source_to),
            (SELECT COALESCE(sum(n.total_negocios), 0) FROM bi.negocios_daily n, ranges r
              WHERE r.model_name = 'negocios_daily'
                AND n.day BETWEEN r.source_from AND r.source_to)
        UNION ALL
        SELECT
            'pedidos_daily',
            (SELECT count(*) FROM mirror.crm_pedidos p, ranges r
              WHERE r.model_name = 'pedidos_daily'
                AND p.pdo_dthpedido::date BETWEEN r.source_from AND r.source_to),
            (SELECT COALESCE(sum(p.total_pedidos), 0) FROM bi.pedidos_daily p, ranges r
              WHERE r.model_name = 'pedidos_daily'
                AND p.day BETWEEN r.source_from AND r.source_to)
        UNION ALL
        SELECT
            'servicos_daily',
            (SELECT count(*) FROM mirror.ordens_servico s, ranges r
              WHERE r.model_name = 'servicos_daily'
                AND COALESCE(s.os_dthabertura, s.dthregistro)::date
                    BETWEEN r.source_from AND r.source_to),
            (SELECT COALESCE(sum(s.total_os), 0) FROM bi.servicos_daily s, ranges r
              WHERE r.model_name = 'servicos_daily'
                AND s.day BETWEEN r.source_from AND r.source_to)
    )
    SELECT
        counts.model_name,
        CASE WHEN counts.source_rows = counts.model_rows THEN 'ready' ELSE 'mismatch' END,
        counts.source_rows,
        counts.model_rows,
        counts.model_rows - counts.source_rows,
        now()
    FROM counts
    ORDER BY counts.model_name;
$$;

ALTER FUNCTION bi.read_model_quality() OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION bi.read_model_quality() FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
        GRANT USAGE ON SCHEMA bi TO ceres_bi_api;
        GRANT SELECT ON bi.refresh_manifest, bi.acoes_daily, bi.negocios_daily,
            bi.pedidos_daily, bi.servicos_daily TO ceres_bi_api;
        GRANT EXECUTE ON FUNCTION bi.read_model_quality() TO ceres_bi_api;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_refresh') THEN
        GRANT USAGE ON SCHEMA bi TO ceres_bi_refresh;
        GRANT EXECUTE ON FUNCTION bi.refresh_read_models(date, date) TO ceres_bi_refresh;
    END IF;
END;
$$;
