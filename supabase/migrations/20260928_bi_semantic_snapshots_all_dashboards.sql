-------------------------------------------------------------------------------
-- Publica a primeira camada Import dos contratos semânticos do BI.
--
-- A consulta interativa continua sendo DirectQuery parametrizada quando a
-- combinação de filtros não possui snapshot. Para as consultas sem filtro
-- (ou no recorte anual publicado), o gateway pode servir o payload já
-- materializado sem recalcular a RPC durante a abertura da tela.
--
-- A função é fail-open por contrato: uma RPC indisponível não impede as
-- demais publicações e nunca apaga o snapshot anterior.
-------------------------------------------------------------------------------

BEGIN;

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
    v_year_from date;
    v_year_to date;
    v_empty_filters jsonb := '{}'::jsonb;
    v_cutoff_filters jsonb := jsonb_build_object('p_cutoff_anos', 5);
    v_payload jsonb;
    v_count integer := 0;
    v_failures jsonb := '[]'::jsonb;
BEGIN
    IF v_from > v_to THEN
        RAISE EXCEPTION 'p_from não pode ser posterior a p_to';
    END IF;

    v_filters := jsonb_strip_nulls(jsonb_build_object('p_from', v_from, 'p_to', v_to));
    v_year_filters := jsonb_build_object('p_ano', EXTRACT(YEAR FROM v_from)::integer);

    -- Desempenho: o contrato já possui snapshot anual e por ano.
    BEGIN
        v_payload := public.rpc_desempenho_vendas_bi(
            v_from, v_to, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        )::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'desempenho', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );

        v_year_from := make_date(EXTRACT(YEAR FROM v_from)::integer, 1, 1);
        v_year_to := make_date(EXTRACT(YEAR FROM v_from)::integer, 12, 31);
        v_payload := public.rpc_desempenho_vendas_bi(
            v_year_from, v_year_to, EXTRACT(YEAR FROM v_from)::integer,
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        )::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'desempenho', md5(v_year_filters::text), v_year_filters, v_payload, v_year_from, v_year_to
        );
        PERFORM bi.publish_semantic_snapshot(
            'desempenho', md5(v_empty_filters::text), v_empty_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 3;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'desempenho', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    -- Ações: core e funil são os blocos abertos junto com a página.
    BEGIN
        v_payload := public.rpc_acoes_bi_periodo(v_from, v_to, NULL, NULL, NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_acoes_bi_periodo', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_acoes_bi_periodo', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_acoes_funil_gestao_periodo(v_from, v_to, NULL, NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_acoes_funil_gestao_periodo', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_acoes_funil_gestao_periodo', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    -- Comercial/Negócios, Pedidos, Serviços e Inteligência.
    BEGIN
        v_payload := public.rpc_negocios_bi(v_from, v_to, NULL, NULL, NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_negocios_bi', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_negocios_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_resultados_negocios_bi(v_from, v_to, NULL, NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_resultados_negocios_bi', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_resultados_negocios_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_pedidos_bi(v_from, v_to, NULL, NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_pedidos_bi', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_pedidos_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_servicos_bi(v_from, v_to, NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_servicos_bi', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_servicos_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_inteligencia_esforco_bi(v_from, v_to, NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_inteligencia_esforco_bi', md5(v_filters::text), v_filters, v_payload, v_from, v_to
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_inteligencia_esforco_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    -- Dashboards de posição atual: snapshots sem filtro de calendário.
    BEGIN
        v_payload := public.rpc_admin_bi(NULL)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_admin_bi', md5(v_empty_filters::text), v_empty_filters, v_payload
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_admin_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_operacional_bi()::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_operacional_bi', md5(v_empty_filters::text), v_empty_filters, v_payload
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_operacional_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_produtos_bi()::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_produtos_bi', md5(v_empty_filters::text), v_empty_filters, v_payload
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_produtos_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    BEGIN
        v_payload := public.rpc_parque_renovacao_bi(5)::jsonb;
        PERFORM bi.publish_semantic_snapshot(
            'rpc.rpc_parque_renovacao_bi', md5(v_cutoff_filters::text), v_cutoff_filters, v_payload
        );
        v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
            'contract', 'rpc_parque_renovacao_bi', 'code', SQLSTATE, 'message', left(SQLERRM, 240)
        ));
    END;

    RETURN jsonb_build_object(
        'status', CASE WHEN jsonb_array_length(v_failures) = 0 THEN 'ready' ELSE 'degraded' END,
        'source_from', v_from,
        'source_to', v_to,
        'snapshots', v_count,
        'failures', v_failures
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'error_code', SQLSTATE,
        'error_message', left(SQLERRM, 500),
        'snapshots', v_count,
        'failures', v_failures
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

COMMENT ON FUNCTION bi.refresh_semantic_snapshots(date, date) IS
  'Publica snapshots Import dos contratos semânticos do BI; falhas por contrato são fail-open e preservam o snapshot anterior.';

COMMIT;
