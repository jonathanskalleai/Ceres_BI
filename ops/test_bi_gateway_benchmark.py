from __future__ import annotations

from bi_gateway_benchmark import Sample, summarize


def test_summarize_reports_tail_latency_and_cache_rate() -> None:
    samples = [
        Sample(100, 200, "ok", 80, 90, 1200, False, None),
        Sample(200, 200, "ok", 160, 170, 1400, True, None),
        Sample(300, 500, "error", 250, 260, 500, None, "BI_QUERY_FAILED"),
    ]

    report = summarize(samples)

    assert report["samples"] == 3
    assert report["successful"] == 2
    assert report["errors"] == 1
    assert report["wall_ms"]["p50"] == 200
    assert report["wall_ms"]["p95"] == 290
    assert report["cache_hit_rate"] == 0.5
    assert report["error_codes"] == {"BI_QUERY_FAILED": 1}


def test_summarize_handles_transport_failures_without_fabricating_metrics() -> None:
    report = summarize([Sample(35, None, None, None, None, None, None, "TimeoutError")])

    assert report["successful"] == 0
    assert report["errors"] == 1
    assert report["envelope_status_counts"] == {"transport_error": 1}
    assert report["query_ms"]["count"] == 0
    assert report["error_codes"] == {"TimeoutError": 1}
