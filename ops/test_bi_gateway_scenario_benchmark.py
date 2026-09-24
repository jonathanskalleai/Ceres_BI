from __future__ import annotations

import json

import pytest

from bi_gateway_scenario_benchmark import load_scenarios


def test_load_scenarios_accepts_versioned_list_without_echoing_values(tmp_path) -> None:
    path = tmp_path / "scenarios.json"
    path.write_text(
        json.dumps({
            "schema_version": "1.0",
            "scenarios": [{"label": "month", "rpc": "rpc_acoes_bi_periodo", "params": {"p_from": "2026-01-01"}}],
        }),
        encoding="utf-8",
    )

    scenarios = load_scenarios(path)

    assert scenarios[0].label == "month"
    assert scenarios[0].rpc == "rpc_acoes_bi_periodo"


@pytest.mark.parametrize(
    "payload",
    [
        {"scenarios": []},
        {"scenarios": [{"label": "bad label", "rpc": "rpc_ok", "params": {}}]},
        {"scenarios": [{"label": "same", "rpc": "rpc_a", "params": {}}, {"label": "same", "rpc": "rpc_b", "params": {}}]},
    ],
)
def test_load_scenarios_rejects_invalid_or_ambiguous_input(tmp_path, payload) -> None:
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError):
        load_scenarios(path)
