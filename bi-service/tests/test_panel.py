from __future__ import annotations

import asyncio

from auth import CurrentUser
from fastapi.testclient import TestClient
from main import app, database, query_cache, require_panel_user
from panel import compose_panel_kpis


def _negocios(total: int) -> dict[str, object]:
    return {"kpis": {"totalNegocios": total, "andamento": total - 2, "taxaConversao": 20}}


def _acoes(total: int, gain_value: int) -> dict[str, object]:
    return {
        "kpis": {
            "totalAcoes": total,
            "visitas": total // 2,
            "negociosGanho": 2,
            "negociosPerdido": 1,
            "valorGanho": gain_value,
            "valorPerdido": 100,
            "negociosOutrosStatus": 0,
        },
        "porTipoAcao": [{"name": "Ligação", "value": total}],
    }


def _funil(total: int) -> dict[str, object]:
    return {
        "funil": {"oportunidades": total, "valorOportunidades": total * 100, "visitasPorOportunidade": 2},
        "diasParados": {"mediana": 4},
    }


def test_compose_panel_moves_ticket_and_trend_calculations_to_server() -> None:
    data, missing = compose_panel_kpis(
        _negocios(10),
        _negocios(5),
        _acoes(8, 1_000),
        _acoes(4, 600),
        _funil(3),
        _funil(2),
        {"kpis": {"eventosAgenda": 7}},
    )

    assert missing == []
    assert data["ticketMedio"] == {
        "value": 500,
        "previousValue": 300,
        "trend": "up",
        "valueStatus": "ready",
        "previousValueStatus": "ready",
    }
    assert data["totalNegocios"]["trend"] == "up"
    assert data["dataQuality"] == {"status": "ready", "missing": []}


def test_compose_panel_marks_missing_sources_as_partial_instead_of_silent_zero() -> None:
    data, missing = compose_panel_kpis({}, {}, {}, {}, {}, {}, {})

    assert missing
    assert data["dataQuality"]["status"] == "partial"
    assert "current.totalNegocios" in missing


def test_panel_endpoint_returns_composed_contract(monkeypatch) -> None:
    async def fake_user() -> CurrentUser:
        return CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin")

    def fake_execute(name, args):
        if name == "rpc_negocios_bi":
            return _negocios(10 if args[0].year == 2026 else 5)
        if name == "rpc_acoes_bi_periodo":
            return _acoes(8 if args[0].year == 2026 else 4, 1_000 if args[0].year == 2026 else 600)
        if name == "rpc_acoes_funil_gestao_periodo":
            return _funil(3 if args[0].year == 2026 else 2)
        if name == "rpc_operacional_bi":
            return {"kpis": {"eventosAgenda": 7}}
        raise AssertionError(name)

    app.dependency_overrides[require_panel_user] = fake_user
    asyncio.run(query_cache.clear())
    monkeypatch.setattr(database, "execute_rpc", fake_execute)
    try:
        response = TestClient(app).get("/api/bi/painel/kpis?from=2026-01-01&to=2026-09-20")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["data"]["ticketMedio"]["value"] == 500
    assert payload["data"]["ticketMedio"]["previousValue"] == 300
