from pathlib import Path


ROOT = Path(__file__).parents[1]


def _source_files(*directories: str) -> list[Path]:
    return [path for directory in directories for path in (ROOT / directory).rglob("*") if path.suffix in {".ts", ".tsx"}]


def test_active_bi_pages_do_not_import_legacy_mirror_services() -> None:
    active_sources = "\n".join(path.read_text(encoding="utf-8") for path in _source_files("src/pages/bi", "src/components/bi"))
    assert "services/bi/pedidosBIService" not in active_sources
    assert "services/bi/servicosBIService" not in active_sources
    assert 'supabase.schema("mirror")' not in active_sources


def test_legacy_service_hooks_keep_the_gateway_boundary() -> None:
    servicos_hook = (ROOT / "src/hooks/bi/useServicosKPIs.ts").read_text(encoding="utf-8")
    sync_hook = (ROOT / "src/hooks/bi/useSyncStatus.ts").read_text(encoding="utf-8")
    assert "fetchOrdensServico" not in servicos_hook
    assert 'supabase.schema("mirror")' not in sync_hook


def test_cross_filter_drilldowns_are_gateway_only() -> None:
    migration = (ROOT / "supabase/migrations/20260927_desempenho_drilldown_cross_filters.sql").read_text(
        encoding="utf-8"
    )
    assert "FROM PUBLIC, anon, authenticated, service_role, ceres_bi_api" in migration
    assert ") TO authenticated;" not in migration
