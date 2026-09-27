from pathlib import Path

MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260928_bi_semantic_snapshots_all_dashboards.sql"


def test_semantic_snapshot_refresh_covers_all_default_dashboard_contracts() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    expected = (
        "rpc_desempenho_vendas_bi",
        "rpc_acoes_bi_periodo",
        "rpc_acoes_funil_gestao_periodo",
        "rpc_negocios_bi",
        "rpc_resultados_negocios_bi",
        "rpc_pedidos_bi",
        "rpc_servicos_bi",
        "rpc_inteligencia_esforco_bi",
        "rpc_admin_bi",
        "rpc_operacional_bi",
        "rpc_produtos_bi",
        "rpc_parque_renovacao_bi",
    )

    assert all(f"public.{name}" in sql for name in expected)
    assert "CREATE OR REPLACE FUNCTION bi.refresh_semantic_snapshots" in sql
    assert "v_failures := v_failures || jsonb_build_array" in sql
    assert "v_year_from := make_date" in sql
    assert "EXTRACT(YEAR FROM v_from)::integer" in sql
    assert "DROP TABLE" not in sql
    assert "DROP FUNCTION" not in sql


def test_semantic_snapshot_refresh_preserves_previous_payload_on_failure() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "nunca apaga o snapshot anterior" in sql
    assert "EXCEPTION WHEN OTHERS THEN" in sql
    assert "status', CASE WHEN jsonb_array_length(v_failures) = 0 THEN 'ready' ELSE 'degraded' END" in sql
