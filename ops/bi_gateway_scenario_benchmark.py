"""Run a bounded authenticated benchmark with varied BI query scenarios.

The regular gateway benchmark repeats one payload, which is useful for cache
and single-flight checks but can hide slow filters.  This runner mixes a
versioned scenario file and reports aggregate, per-RPC and per-scenario
latency.  It never prints scenario parameters or the bearer token.

Example:
    BI_BENCHMARK_TOKEN='***' \
      python ops/bi_gateway_scenario_benchmark.py \
      --url https://ceresbi.vouxconsultoria.com.br \
      --scenario-file ops/bi_gateway_scenarios.json \
      --requests 60 --concurrency 12
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bi_gateway_benchmark import Sample, _request_once, summarize

_LABEL_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
_RPC_RE = re.compile(r"^[a-z][a-z0-9_]{1,120}$")


@dataclass(frozen=True)
class Scenario:
    label: str
    rpc: str
    params: dict[str, Any]


def _validate_scenario(raw: Any, index: int) -> Scenario:
    if not isinstance(raw, dict):
        raise ValueError(f"cenário {index}: esperado objeto")
    label = raw.get("label")
    rpc = raw.get("rpc")
    params = raw.get("params", {})
    if not isinstance(label, str) or not _LABEL_RE.fullmatch(label):
        raise ValueError(f"cenário {index}: label inválido")
    if not isinstance(rpc, str) or not _RPC_RE.fullmatch(rpc):
        raise ValueError(f"cenário {index}: rpc inválida")
    if not isinstance(params, dict):
        raise ValueError(f"cenário {index}: params precisa ser objeto")
    return Scenario(label=label, rpc=rpc, params=params)


def load_scenarios(path: str | Path) -> list[Scenario]:
    """Load and validate scenarios without echoing their filter values."""

    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    raw_scenarios = payload.get("scenarios") if isinstance(payload, dict) else payload
    if not isinstance(raw_scenarios, list) or not raw_scenarios:
        raise ValueError("arquivo de cenários precisa conter uma lista não vazia")
    if len(raw_scenarios) > 100:
        raise ValueError("arquivo de cenários excede o limite de 100 itens")
    scenarios = [_validate_scenario(raw, index) for index, raw in enumerate(raw_scenarios)]
    labels = [scenario.label for scenario in scenarios]
    if len(labels) != len(set(labels)):
        raise ValueError("labels de cenário precisam ser únicos")
    return scenarios


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="base URL, sem /api/bi")
    parser.add_argument("--scenario-file", required=True, help="JSON de cenários versionado")
    parser.add_argument("--requests", type=int, default=60)
    parser.add_argument("--concurrency", type=int, default=12)
    parser.add_argument("--timeout", type=float, default=35.0)
    return parser


def _run_request(
    url: str,
    scenario: Scenario,
    token: str,
    timeout: float,
) -> tuple[Scenario, Sample]:
    return scenario, _request_once(url, scenario.rpc, scenario.params, token, timeout)


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
        scenarios = load_scenarios(args.scenario_file)
    except (OSError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise SystemExit(f"bi_gateway_scenario_benchmark: arquivo inválido: {exc}") from exc

    assignments = [scenarios[index % len(scenarios)] for index in range(args.requests)]
    results: list[tuple[Scenario, Sample]] = []
    with ThreadPoolExecutor(max_workers=min(args.concurrency, args.requests)) as executor:
        futures = [executor.submit(_run_request, args.url, scenario, token, args.timeout) for scenario in assignments]
        for future in as_completed(futures):
            results.append(future.result())

    all_samples = [sample for _, sample in results]
    by_rpc: dict[str, list[Sample]] = defaultdict(list)
    by_scenario: dict[str, list[Sample]] = defaultdict(list)
    for scenario, sample in results:
        by_rpc[scenario.rpc].append(sample)
        by_scenario[scenario.label].append(sample)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "url": args.url,
        "scenario_count": len(scenarios),
        "requests": args.requests,
        "concurrency": args.concurrency,
        "timeout_seconds": args.timeout,
        "summary": summarize(all_samples),
        "by_rpc": {rpc: summarize(samples) for rpc, samples in sorted(by_rpc.items())},
        "by_scenario": {
            label: summarize(samples) for label, samples in sorted(by_scenario.items())
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["summary"]["errors"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
