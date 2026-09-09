import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from auth import CurrentUser
from ya_agent import AgentRunner
from ya_agent_models import AgentArtifact, ToolExecution
from ya_memory import ThreadMemory
from ya_models import YaChatRequest, YaSource
from ya_schema import SchemaSnapshot


USER = CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin", full_name="Admin")


class FakeRegistry:
    def __init__(self):
        self.calls = []

    async def execute(self, tool_call, context):
        self.calls.append(tool_call)
        source = YaSource(id=f"source-{len(self.calls)}", label="Desempenho de vendas", applied_scope={"period": {"from": "2026-09-01", "to": "2026-09-08"}}, execution_metrics={"elapsed_ms": 2, "row_count": 1})
        artifact = AgentArtifact(type="kpi_group", title="Indicadores", rows=[{"label": "Vendas", "value": 5, "unit": "quantidade"}], source_ids=[source.id])
        return ToolExecution(tool_name=tool_call.name, tool_call_id=tool_call.call_id, data={"kpis": {"totalPedidos": 5}}, source=source, artifacts=[artifact])


def patch_runner_dependencies():
    memory = ThreadMemory(summary="", state={}, history=[], last_sources=[], user_memories=[])
    async def persist(*args, **kwargs):
        return "user-message" if args[2] == "user" else "assistant-message"
    return [
        patch("ya_agent.ensure_conversation", new=AsyncMock(return_value="conversation-1")),
        patch("ya_agent.load_agent_memory", new=AsyncMock(return_value=memory)),
        patch("ya_agent.persist_message", new=AsyncMock(side_effect=persist)),
        patch("ya_agent.load_schema", new=AsyncMock(return_value=SchemaSnapshot({"mirror.crm_negocios": ("ngo_numero",)}, 0))),
        patch("ya_agent.update_agent_state", new=AsyncMock(return_value={"active_topic": "vendas"})),
        patch("ya_agent.persist_agent_turn_metrics", new=AsyncMock()),
        patch("ya_agent.persist_agent_tool_run", new=AsyncMock()),
    ]


class YaAgentRunnerTests(unittest.TestCase):
    def test_whitespace_only_messages_are_rejected(self):
        with self.assertRaises(ValueError):
            YaChatRequest(message="   \n\t")

    def test_zero_tool_turn_keeps_casual_conversation(self):
        async def provider(*args, **kwargs):
            return {"message": {"content": '{"answer":"Bom dia! Como posso ajudar?","choices":[]}'}, "usage": {}}
        runner = AgentRunner(provider=provider)
        events = []
        async def emit(event, data):
            events.append(event)
        patches = patch_runner_dependencies()
        for item in patches:
            item.start()
        try:
            result = asyncio.run(runner.run(YaChatRequest(message="Bom dia"), USER, emit))
        finally:
            for item in reversed(patches):
                item.stop()
        self.assertIn("Bom dia", result.answer)
        self.assertEqual(result.stats["tool_call_count"], 0)
        self.assertNotIn("tool_start", events)
        self.assertIn("plan", events)
        self.assertIn("sources", events)

    def test_tool_result_returns_to_provider_with_matching_call_id(self):
        calls = []
        async def provider(messages, tools, **kwargs):
            calls.append(messages)
            if len(calls) == 1:
                return {"message": {"tool_calls": [{"id": "call-1", "type": "function", "function": {"name": "consultar_desempenho_vendas", "arguments": '{"periodo_inicio":"2026-09-01","periodo_fim":"2026-09-08"}'}}]}, "usage": {"prompt_tokens": 10, "completion_tokens": 4}}
            return {"message": {"content": '{"answer":"Foram 5 vendas.","choices":[]}'}, "usage": {"prompt_tokens": 10, "completion_tokens": 5}}
        registry = FakeRegistry()
        runner = AgentRunner(registry=registry, provider=provider)
        patches = patch_runner_dependencies()
        for item in patches:
            item.start()
        try:
            result = asyncio.run(runner.run(YaChatRequest(message="Quantas vendas?"), USER))
        finally:
            for item in reversed(patches):
                item.stop()
        self.assertEqual(result.answer, "Foram 5 vendas.")
        self.assertEqual(registry.calls[0].call_id, "call-1")
        self.assertEqual(calls[1][-1]["role"], "tool")
        self.assertEqual(calls[1][-1]["tool_call_id"], "call-1")

    def test_multiple_tools_and_duplicate_calls_are_bounded(self):
        count = 0
        async def provider(messages, tools, **kwargs):
            nonlocal count
            count += 1
            if count <= 6:
                return {"message": {"tool_calls": [{"id": f"call-{count}", "type": "function", "function": {"name": "consultar_desempenho_vendas", "arguments": '{"periodo_inicio":"2026-09-01","periodo_fim":"2026-09-08"}'}}]}, "usage": {}}
            return {"message": {"content": '{"answer":"Não consegui concluir a análise dentro do limite desta pergunta.","choices":[]}'}, "usage": {}}
        runner = AgentRunner(registry=FakeRegistry(), provider=provider)
        patches = patch_runner_dependencies()
        for item in patches:
            item.start()
        try:
            result = asyncio.run(runner.run(YaChatRequest(message="Repita sem parar"), USER))
        finally:
            for item in reversed(patches):
                item.stop()
        self.assertLessEqual(result.stats["model_rounds"], 6)
        self.assertLessEqual(result.stats["tool_call_count"], 8)


if __name__ == "__main__":
    unittest.main()
