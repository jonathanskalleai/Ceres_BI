from __future__ import annotations

from bi_baseline import metric_summary, summarize_events


def test_percentiles_use_linear_interpolation_and_tail_gate() -> None:
    assert metric_summary([0, 10, 20, 30]) == {
        "count": 4,
        "p50": 15.0,
        "p95": None,
        "p99": None,
        "tail_ready": False,
    }


def test_summary_separates_error_and_timeout_rates() -> None:
    records = [
        {
            "event": "bi_query",
            "dashboard_id": "acoes",
            "route": "/api/bi/acoes/core",
            "endpoint": "acoes.core",
            "case": "monthly",
            "status": "ok",
            "query_ms": 10,
            "api_ms": 15,
            "payload_bytes": 100,
        },
        {
            "event": "bi_query",
            "dashboard_id": "acoes",
            "route": "/api/bi/acoes/core",
            "endpoint": "acoes.core",
            "case": "monthly",
            "status": "error",
            "error_code": "BI_QUERY_TIMEOUT",
            "query_ms": 100,
            "api_ms": 101,
            "payload_bytes": 200,
        },
    ]
    group = summarize_events(records)["groups"][0]
    assert group["samples"] == 2
    assert group["error_rate"] == 0.5
    assert group["timeout_rate"] == 0.5
    assert group["query_ms"]["p50"] == 55.0


def test_empty_input_is_valid() -> None:
    report = summarize_events([])
    assert report["sample_count"] == 0
    assert report["groups"] == []
