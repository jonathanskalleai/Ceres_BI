from pathlib import Path


MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260930_bi_server_derived_kpis.sql"


def test_derived_kpis_migration_keeps_named_core_backups() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "rpc_acoes_bi_periodo_core" in sql
    assert "rpc_acoes_funil_gestao_periodo_core" in sql
    assert "REVOKE ALL ON FUNCTION public.rpc_acoes_bi_periodo_core" in sql
    assert "REVOKE ALL ON FUNCTION public.rpc_acoes_funil_gestao_periodo_core" in sql


def test_derived_kpis_are_computed_in_postgres() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "{kpis,ticketMedioGanho}" in sql
    assert "{funil,taxaGanho}" in sql
    assert "ROUND(v_valor_ganho / v_pedidos_ganho, 2)" in sql
    assert "ROUND(v_ganhos * 100 / v_oportunidades, 1)" in sql


def test_derived_wrappers_do_not_expose_direct_browser_execution() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "FROM PUBLIC, anon, authenticated" in sql
    assert ") TO authenticated;" not in sql
