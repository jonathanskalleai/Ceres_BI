"""Constrained read-only exploratory SQL tool."""

from __future__ import annotations

from typing import Any

from ai_logger import log_event
from ya_agent_models import ExploratoryToolInput
from ya_agent_tools.common import ToolContext, ToolUnavailable
from ya_dynamic_query import DynamicQueryExecutor, DynamicQueryValidationError, validate_read_only_sql
from ya_query_models import QuerySpec


async def execute_exploratory(context: ToolContext, input_data: ExploratoryToolInput, call_id: str):
    if not context.schema_available:
        raise ToolUnavailable("O schema permitido do BI não está disponível nesta rodada.")
    try:
        validated = validate_read_only_sql(input_data.sql, context.schema_tables)
    except DynamicQueryValidationError as error:
        log_event(30, "ai_agent_exploratory_sql_rejected", error_type=type(error).__name__, error_message=str(error))
        return _Result(
            {
                "status": "error",
                "error": str(error),
                "hint": "Regras de SQL: apenas SELECT, colunas explícitas (sem SELECT *), JOINs explícitos, apenas tabelas mirror.* e sem comentários ou UNION.",
            },
            None,
            [],
            [str(error)],
        )
    spec = QuerySpec(
        intent="exploratory",
        domain="exploratory",
        mode="data",
        output=input_data.apresentacao,
        dynamic_requested=True,
        dynamic_query_hash=validated.query_hash,
        dynamic_tables=list(validated.tables),
        warnings=["Análise no banco de dados do BI."],
    )
    _, data, source, _ = await DynamicQueryExecutor(context.analytical_query).execute(
        spec,
        validated.sql,
        context.user_id,
        {"status": "fonte oficial"},
        set(validated.tables),
    )
    artifacts = []
    rows = data.get("rows") if isinstance(data, dict) else []
    if rows and input_data.apresentacao != "texto":
        from ya_agent_tools.common import table_artifact
        art = table_artifact(input_data.objetivo or "Resultado da Consulta", rows[:50], source.id)
        if art:
            artifacts.append(art)
    return _Result(data, source, artifacts, source.warnings)


class _Result:
    def __init__(self, data: dict[str, Any], source: Any, artifacts: list[Any], warnings: list[str]):
        self.data = data
        self.source = source
        self.artifacts = artifacts
        self.warnings = warnings
