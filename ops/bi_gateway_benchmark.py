"""Run a bounded authenticated benchmark against the BI gateway.

The script is deliberately external to the service: it exercises the same
HTTP path the browser will use and reports latency/response metadata without
printing the bearer token or filter values.

Example:
    BI_BENCHMARK_TOKEN='***' \
      python ops/bi_gateway_benchmark.py \
      --url https://ceresbi-bi-canary.internal \
      --rpc rpc_desempenho_vendas_bi \
      --params '{"p_from":"2026-01-01","p_to":"2026-12-31","p_funis":null}' \
      --requests 20 --concurrency 4
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class Sample:
    wall_ms: float
    http_status: int | None
    envelope_status: str | None
    query_ms: float | None
    api_ms: float | None
    payload_bytes: int | None
    cache_hit: bool | None
    error_code: str | None


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * percentile
    lower = int(index)
    upper = min(lower + 1, len(ordered) - 1)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower), 3)


def summarize(samples: list[Sample]) -> dict[str, Any]:
    wall = [sample.wall_ms for sample in samples]
    query = [sample.query_ms for sample in samples if sample.query_ms is not None]
    api = [sample.api_ms for sample in samples if sample.api_ms is not None]
    payload = [sample.payload_bytes for sample in samples if sample.payload_bytes is not None]
    successful = [sample for sample in samples if sample.envelope_status in {"ok", "partial"}]
    errors = [
        sample
        for sample in samples
        if sample.http_status is None
        or sample.envelope_status == "error"
        or (sample.http_status or 0) >= 400
    ]
    cache_values = [sample.cache_hit for sample in samples if sample.cache_hit is not None]
    return {
        "samples": len(samples),
        "successful": len(successful),
        "errors": len(errors),
        "http_status_counts": _counts(str(sample.http_status) for sample in samples),
        "envelope_status_counts": _counts(sample.envelope_status or "transport_error" for sample in samples),
        "wall_ms": _summary(wall),
        "query_ms": _summary(query),
        "api_ms": _summary(api),
        "payload_bytes": _summary(payload),
        "cache_hit_rate": round(sum(cache_values) / len(cache_values), 6) if cache_values else None,
        "error_codes": _counts(sample.error_code for sample in errors if sample.error_code),
    }


def _summary(values: list[float]) -> dict[str, Any]:
    return {
        "count": len(values),
        "min": round(min(values), 3) if values else None,
        "mean": round(statistics.fmean(values), 3) if values else None,
        "p50": _percentile(values, 0.50),
        "p95": _percentile(values, 0.95),
        "p99": _percentile(values, 0.99),
        "max": round(max(values), 3) if values else None,
    }


def _counts(values: Any) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        if value is None:
            continue
        key = str(value)
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items()))


def _request_once(url: str, rpc: str, params: dict[str, Any], token: str, timeout: float) -> Sample:
    endpoint = f"{url.rstrip('/')}/api/bi/rpc/{quote(rpc, safe='')}"
    body = json.dumps({"params": params}, separators=(",", ":")).encode("utf-8")
    request = Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "X-Request-ID": f"benchmark-{time.time_ns()}",
        },
    )
    started = time.perf_counter()
    http_status: int | None = None
    try:
        with urlopen(request, timeout=timeout) as response:
            http_status = response.status
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        http_status = exc.code
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except (OSError, ValueError):
            payload = {}
    except (OSError, URLError, TimeoutError) as exc:
        return Sample(_elapsed_ms(started), None, None, None, None, None, None, type(exc).__name__)

    metrics = payload.get("metrics") if isinstance(payload, dict) else {}
    metrics = metrics if isinstance(metrics, dict) else {}
    issues = payload.get("issues") if isinstance(payload, dict) else []
    first_issue = issues[0] if isinstance(issues, list) and issues else {}
    error_code = first_issue.get("code") if isinstance(first_issue, dict) else None
    return Sample(
        _elapsed_ms(started),
        http_status,
        payload.get("status") if isinstance(payload, dict) else None,
        _number(metrics.get("query_ms")),
        _number(metrics.get("api_ms")),
        int(metrics["payload_bytes"]) if isinstance(metrics.get("payload_bytes"), (int, float)) else None,
        metrics.get("cache_hit") if isinstance(metrics.get("cache_hit"), bool) else None,
        str(error_code) if error_code else None,
    )


def _elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 3)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="base URL do serviço, sem /api/bi")
    parser.add_argument("--rpc", required=True, help="RPC allow-listed a ser testada")
    parser.add_argument("--params", default="{}", help="objeto JSON de parâmetros; não é impresso")
    parser.add_argument("--requests", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--timeout", type=float, default=35.0)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    token = os.getenv("BI_BENCHMARK_TOKEN", "").strip()
    if not token:
        raise SystemExit("BI_BENCHMARK_TOKEN precisa estar definido no ambiente")
    if not 1 <= args.requests <= 1000:
        raise SystemExit("--requests precisa estar entre 1 e 1000")
    if not 1 <= args.concurrency <= 100:
        raise SystemExit("--concurrency precisa estar entre 1 e 100")
    if args.timeout <= 0:
        raise SystemExit("--timeout precisa ser positivo")
    try:
        params = json.loads(args.params)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"--params inválido: {exc}") from exc
    if not isinstance(params, dict):
        raise SystemExit("--params precisa ser um objeto JSON")

    samples: list[Sample] = []
    with ThreadPoolExecutor(max_workers=min(args.concurrency, args.requests)) as executor:
        futures = [executor.submit(_request_once, args.url, args.rpc, params, token, args.timeout) for _ in range(args.requests)]
        for future in as_completed(futures):
            samples.append(future.result())

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "url": args.url,
        "rpc": args.rpc,
        "requests": args.requests,
        "concurrency": args.concurrency,
        "timeout_seconds": args.timeout,
        "summary": summarize(samples),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["summary"]["errors"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
