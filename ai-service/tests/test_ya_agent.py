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


class ContractRegistry:
    def __init__(self):
        self.calls = []

    async def execute(self, tool_call, context):
        self.calls.append(tool_call)
        source = YaSource(id="loss-source", label="Desempenho de vendas", applied_scope={"period": {"from": tool_call.arguments["periodo_inicio"], "to": tool_call.arguments["periodo_fim"]}}, execution_metrics={"elapsed_ms": 2, "row_count": 2})
        return ToolExecution(
            tool_name=tool_call.name,
            tool_call_id=tool_call.call_id,
            data={"kpis": {"valorPerdido": 100, "totalPerdido": 2}, "perdas": {"motivos": [{"motivo": "Preço", "valor": 100}], "vendedores": [{"vendedor": "Ana", "valor": 100}], "produtos": [{"produto": "Máquina", "valor": 100}]}, "rankings": {"vendedores": [{"name": "Ana", "valor": 100}]}},
            source=source,
        )


class MultiToolRegistry:
    def __init__(self):
        self.calls = []

    async def execute(self, tool_call, context):
        self.calls.append(tool_call)
        if tool_call.name == "comparar_periodos":
            source = YaSource(
                id="comparison-source", label="Comparação de períodos",
                applied_scope={"comparacao": {
                    "atual": {"from": tool_call.arguments["periodo_atual_inicio"], "to": tool_call.arguments["periodo_atual_fim"]},
                    "base": {"from": tool_call.arguments["periodo_base_inicio"], "to": tool_call.arguments["periodo_base_fim"]},
                }}, execution_metrics={"elapsed_ms": 2, "row_count": 1},
            )
            data = {"comparacoes": [{"metrica": "vendas.faturamento", "atual": 100, "base": 80, "variacao": {"percentage": 25}}]}
        else:
            source = YaSource(
                id="sales-detail-source", label="Desempenho de vendas",
                applied_scope={"period": {"from": tool_call.arguments["periodo_inicio"], "to": tool_call.arguments["periodo_fim"]}},
                execution_metrics={"elapsed_ms": 2, "row_count": 2},
            )
            data = {"produtos": [{"produto": "Máquina", "valor": 100}], "rankings": {"produtos": [{"produto": "Máquina", "valor": 100}]}}
        return ToolExecution(tool_name=tool_call.name, tool_call_id=tool_call.call_id, data=data, source=source)


def patch_runner_dependencies():
    memory = ThreadMemory(summary="", state={}, history=[], last_sources=[], user_memories=[])
    async def persist(*args, **kwargs):
        return "user-message" if args[2] == "user" else "assistant-message"
    return [
        patch("ya_agent_runner.ensure_conversation", new=AsyncMock(return_value="conversation-1")),
        patch("ya_agent_runner.load_agent_memory", new=AsyncMock(return_value=memory)),
        patch("ya_agent_runner.persist_message", new=AsyncMock(side_effect=persist)),
        patch("ya_agent_runner.load_schema", new=AsyncMock(return_value=SchemaSnapshot({"mirror.crm_negocios": ("ngo_numero",)}, 0))),
        patch("ya_agent_runner.update_agent_state", new=AsyncMock(return_value={"active_topic": "vendas"})),
        patch("ya_agent_runner.persist_agent_turn_metrics", new=AsyncMock()),
        patch("ya_agent_runner.persist_agent_tool_run", new=AsyncMock()),
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

    def test_invalid_provider_response_is_explicitly_rejected(self):
        async def provider(*args, **kwargs):
            return {"unexpected": True}

        runner = AgentRunner(provider=provider)
        patches = patch_runner_dependencies()
        for item in patches:
            item.start()
        try:
            with self.assertRaisesRegex(Exception, "formato válido"):
                asyncio.run(runner.run(YaChatRequest(message="Quantas vendas?"), USER))
        finally:
            for item in reversed(patches):
                item.stop()

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

    def test_semantic_contract_forces_loss_tool_scope_and_records_real_intent(self):
        main_calls = []

        async def classifier(*args, **kwargs):
            return {"content": '{"intent":"loss_details","domain":"vendas","period_request":"current_to_date","comparison_scope":"none","metricas":[]}', "usage": {"prompt_tokens": 7, "completion_tokens": 3}}

        async def provider(messages, tools, **kwargs):
            main_calls.append(kwargs)
            if len(main_calls) == 1:
                return {"message": {"tool_calls": [{"id": "loss-call", "type": "function", "function": {"name": "consultar_desempenho_vendas", "arguments": '{"periodo_inicio":"2024-01-01","periodo_fim":"2024-01-31","blocos":["kpis"]}'}}]}, "usage": {}}
            return {"message": {"content": '{"answer":"As perdas foram detalhadas por motivo, vendedor e produto.","choices":[]}'}, "usage": {}}

        registry = ContractRegistry()
        runner = AgentRunner(registry=registry, provider=provider, intent_provider=classifier)
        patches = patch_runner_dependencies()
        for item in patches:
            item.start()
        try:
            result = asyncio.run(runner.run(YaChatRequest(message="Me fale mais sobre essas perdas, quero detalhes"), USER))
        finally:
            for item in reversed(patches):
                item.stop()
        self.assertEqual(main_calls[0]["tool_choice"]["function"]["name"], "consultar_desempenho_vendas")
        self.assertEqual(registry.calls[0].arguments["periodo_inicio"], "2026-09-01")
        self.assertEqual(registry.calls[0].arguments["periodo_fim"], "2026-09-09")
        self.assertEqual(registry.calls[0].arguments["blocos"], ["perdas", "rankings", "produtos"])
        self.assertEqual(result.query_spec["intent"], "loss_details")
        self.assertEqual(result.query_spec["contract_status"], "passed")

    def test_multi_tool_contract_requires_comparison_then_product_detail(self):
        main_calls = []

        async def classifier(*args, **kwargs):
            return {"content": '{"intent":"sales_summary","domain":"vendas","period_request":"current_to_date","comparison_scope":"full_previous","metricas":["vendas.faturamento"]}', "usage": {}}

        async def provider(messages, tools, **kwargs):
            main_calls.append(kwargs)
            if len(main_calls) == 1:
                return {"message": {"tool_calls": [{"id": "compare-call", "type": "function", "function": {"name": "comparar_periodos", "arguments": "{}"}}]}, "usage": {}}
            if len(main_calls) == 2:
                return {"message": {"tool_calls": [{"id": "detail-call", "type": "function", "function": {"name": "consultar_desempenho_vendas", "arguments": "{}"}}]}, "usage": {}}
            return {"message": {"content": '{"answer":"A comparação foi feita e os produtos detalham a diferença.","choices":[]}'}, "usage": {}}

        registry = MultiToolRegistry()
        runner = AgentRunner(registry=registry, provider=provider, intent_provider=classifier)
        patches = patch_runner_dependencies()
        for item in patches:
            item.start()
        try:
            result = asyncio.run(runner.run(YaChatRequest(message="Volte às vendas; quais produtos explicam a diferença?"), USER))
        finally:
            for item in reversed(patches):
                item.stop()
        self.assertEqual([call.name for call in registry.calls], ["comparar_periodos", "consultar_desempenho_vendas"])
        self.assertEqual(main_calls[0]["tool_choice"]["function"]["name"], "comparar_periodos")
        self.assertEqual(main_calls[1]["tool_choice"]["function"]["name"], "consultar_desempenho_vendas")
        self.assertEqual(registry.calls[1].arguments["blocos"], ["produtos", "rankings"])
        self.assertEqual(result.query_spec["contract_status"], "passed")


if __name__ == "__main__":
    unittest.main()
