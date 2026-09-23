"""Aggregate ``bi_query`` JSONL/CSV events into a reproducible baseline.

Examples:
    python ops/bi_baseline.py events.jsonl
    cat events.csv | python ops/bi_baseline.py - --format csv

The command writes JSON to stdout and exits non-zero only when the input cannot
be parsed. Empty input is valid and produces an empty report.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from collections import Counter, defaultdict
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TextIO

MIN_TAIL_SAMPLES = 20
METRIC_FIELDS = ("query_ms", "api_ms", "frontend_ms", "payload_bytes")


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number >= 0 else None


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values or (percentile > 0.5 and len(values) < MIN_TAIL_SAMPLES):
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return round(ordered[lower], 3)
    fraction = position - lower
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * fraction, 3)


def metric_summary(values: Iterable[Any]) -> dict[str, Any]:
    numbers = [number for value in values if (number := _number(value)) is not None]
    return {
        "count": len(numbers),
        "p50": _percentile(numbers, 0.50),
        "p95": _percentile(numbers, 0.95),
        "p99": _percentile(numbers, 0.99),
        "tail_ready": len(numbers) >= MIN_TAIL_SAMPLES,
    }


def _normalise(record: dict[str, Any]) -> dict[str, Any]:
    """Keep only baseline fields and normalize legacy aliases."""

    normalized = dict(record)
    normalized["dashboard_id"] = normalized.get("dashboard_id") or normalized.get("dashboard") or "unknown"
    normalized["case"] = normalized.get("case") or normalized.get("period_case") or "custom"
    normalized["route"] = normalized.get("route") or "unknown"
    normalized["endpoint"] = normalized.get("endpoint") or "unknown"
    normalized["status"] = str(normalized.get("status") or "unknown").lower()
    return normalized


def _is_timeout(record: dict[str, Any]) -> bool:
    status = str(record.get("status") or "").lower()
    code = str(record.get("error_code") or "").upper()
    return status == "timeout" or "TIMEOUT" in code


def summarize_events(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    total_records = 0
    for raw in records:
        record = _normalise(raw)
        key = (str(record["dashboard_id"]), str(record["route"]), str(record["endpoint"]), str(record["case"]))
        groups[key].append(record)
        total_records += 1

    output_groups: list[dict[str, Any]] = []
    for (dashboard_id, route, endpoint, case), group in sorted(groups.items()):
        statuses = Counter(str(row.get("status") or "unknown") for row in group)
        errors = sum(status in {"error", "timeout"} for status in statuses.elements())
        timeouts = sum(_is_timeout(row) for row in group)
        result: dict[str, Any] = {
            "dashboard_id": dashboard_id,
            "route": route,
            "endpoint": endpoint,
            "case": case,
            "samples": len(group),
            "status_counts": dict(sorted(statuses.items())),
            "error_rate": round(errors / len(group), 6) if group else 0,
            "timeout_rate": round(timeouts / len(group), 6) if group else 0,
        }
        for field in METRIC_FIELDS:
            result[field] = metric_summary(row.get(field) for row in group)
        output_groups.append(result)

    return {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sample_count": total_records,
        "min_tail_samples": MIN_TAIL_SAMPLES,
        "groups": output_groups,
    }


def read_records(stream: TextIO, input_format: str) -> list[dict[str, Any]]:
    if input_format == "csv":
        return [dict(row) for row in csv.DictReader(stream)]
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(stream, start=1):
        stripped = line.strip()
        if not stripped:
            continue
        value = json.loads(stripped)
        if not isinstance(value, dict):
            raise TypeError(f"linha {line_number}: esperado objeto JSON")
        records.append(value)
    return records


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="arquivo JSONL/CSV ou '-' para stdin")
    parser.add_argument("--format", choices=("jsonl", "csv"), default=None, dest="input_format")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    stream: TextIO
    close_stream = False
    if args.input == "-":
        stream = sys.stdin
    else:
        path = Path(args.input)
        stream = path.open("r", encoding="utf-8", newline="")
        close_stream = True
    try:
        input_format = args.input_format or ("csv" if str(args.input).lower().endswith(".csv") else "jsonl")
        report = summarize_events(read_records(stream, input_format))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"bi_baseline: input inválido: {exc}", file=sys.stderr)
        return 2
    finally:
        if close_stream:
            stream.close()
    json.dump(report, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
