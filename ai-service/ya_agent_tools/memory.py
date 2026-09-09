"""Explicit, user-owned durable-memory tools."""

from __future__ import annotations

import logging
from typing import Any

from ai_logger import log_event
from ya_agent_models import ForgetMemoryToolInput, SaveMemoryToolInput
from ya_agent_tools.common import ToolContext, compact_result, source_for
from ya_memory import forget_user_memory, save_user_memory


async def execute_save_memory(context: ToolContext, input_data: SaveMemoryToolInput, call_id: str):
    source_id = f"memoria:{context.conversation_id}:{call_id}"
    if not input_data.confirmado:
        warning = "Só guardo isso depois de uma confirmação explícita."
        source = source_for(source_id=source_id, label="Memória do usuário", intent="agent_tool", metric_definitions=[], period=None, filters={}, warnings=[warning], lineage_executor="user_memory")
        return _Result({"status": "confirmation_required", "key": input_data.chave}, source, [], [warning])
    try:
        saved = await save_user_memory(
            context.state_query,
            user_id=context.user_id,
            memory_key=input_data.chave,
            category=input_data.categoria,
            content=input_data.conteudo,
            conversation_id=context.conversation_id,
            message_id=context.message_id,
        )
    except ValueError as error:
        log_event(logging.WARNING, "ai_agent_memory_save_blocked", error_type=type(error).__name__)
        warning = "Essa memória não pode ser guardada porque contém conteúdo não permitido."
        source = source_for(source_id=source_id, label="Memória do usuário", intent="agent_tool", metric_definitions=[], period=None, filters={}, warnings=[warning], lineage_executor="user_memory")
        return _Result({"status": "blocked", "motivo": warning}, source, [], [warning])
    source = source_for(source_id=source_id, label="Memória do usuário", intent="agent_tool", metric_definitions=[], period=None, filters={}, warnings=[], lineage_executor="user_memory")
    return _Result(compact_result(saved), source, [], [])


async def execute_forget_memory(context: ToolContext, input_data: ForgetMemoryToolInput, call_id: str):
    source_id = f"memoria:{context.conversation_id}:{call_id}"
    try:
        result = await forget_user_memory(context.state_query, user_id=context.user_id, memory_key=input_data.chave)
    except ValueError as error:
        log_event(logging.DEBUG, "ai_agent_memory_forget_not_found", error_type=type(error).__name__)
        result = {"status": "not_found"}
    source = source_for(source_id=source_id, label="Memória do usuário", intent="agent_tool", metric_definitions=[], period=None, filters={}, warnings=[], lineage_executor="user_memory")
    return _Result(compact_result(result), source, [], [])


class _Result:
    def __init__(self, data: dict[str, Any], source: Any, artifacts: list[Any], warnings: list[str]):
        self.data = data
        self.source = source
        self.artifacts = artifacts
        self.warnings = warnings
