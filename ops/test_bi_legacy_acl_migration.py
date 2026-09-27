from pathlib import Path


MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260931_bi_revoke_legacy_desempenho_grants.sql"


def test_legacy_desempenho_overloads_are_closed_without_dropping_functions() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "date,date,integer,text,text,text" in sql
    assert "date,date,integer,text,text,text,text,text,text,text" in sql
    assert "text[]" in sql
    assert "FROM PUBLIC, anon, authenticated" in sql
    assert "TO authenticated" not in sql
    assert "DROP FUNCTION" not in sql
