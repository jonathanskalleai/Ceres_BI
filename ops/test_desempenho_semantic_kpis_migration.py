from pathlib import Path


MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260929_desempenho_semantic_kpis.sql"


def test_desempenho_contract_derivations_stay_server_side() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "rpc_desempenho_vendas_bi_core" in sql
    assert "jsonb_set" in sql
    assert "taxaConversao" in sql
    assert "totalPedidos" in sql
    assert "totalPerdido" in sql
    assert "qtdPerdido" in sql
    assert "SECURITY DEFINER" in sql
    assert "SET search_path TO public, mirror, pg_catalog" in sql


def test_desempenho_kpi_migration_is_additive_and_does_not_drop_the_rpc() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")

    assert "CREATE OR REPLACE FUNCTION" in sql
    assert "DROP FUNCTION" not in sql
    assert "DROP TABLE" not in sql
    assert "REVOKE ALL" in sql
