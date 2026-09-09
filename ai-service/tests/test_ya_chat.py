import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from auth import CurrentUser
from ya_chat import _prepare_turn
from ya_memory import ThreadMemory
from ya_models import YaChatRequest, YaSource
from ya_schema import SchemaSnapshot


class YaChatTests(unittest.TestCase):
    def test_greeting_is_answered_without_schema_planning_or_data_gateway(self):
        memory = ThreadMemory(summary="", state={}, history=[], last_sources=[])
        request = YaChatRequest(message="Bom dia")
        user = CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin", full_name="Admin")

        async def fake_ensure(*args, **kwargs):
            return "conversation-1"

        async def fake_persist(*args, **kwargs):
            return "message-1"

        async def exercise():
            with patch("ya_chat.ensure_conversation", new=AsyncMock(side_effect=fake_ensure)), \
                    patch("ya_chat.load_thread_memory", new=AsyncMock(return_value=memory)), \
                    patch("ya_chat.load_schema", new=AsyncMock()) as schema, \
                    patch("ya_chat._plan_query", new=AsyncMock()) as planner, \
                    patch("ya_chat.persist_message", new=AsyncMock(side_effect=fake_persist)), \
                    patch("ya_chat._gateway.execute", new=AsyncMock()) as gateway:
                prepared = await _prepare_turn(request, user)
                return prepared, schema, planner, gateway

        prepared, schema, planner, gateway = asyncio.run(exercise())
        self.assertIn("Bom dia", prepared.answer_override or "")
        schema.assert_not_awaited()
        planner.assert_not_awaited()
        gateway.assert_not_awaited()

    def test_open_question_reaches_the_validated_read_only_gateway(self):
        source = YaSource(
            id="dynamic:123",
            label="Consulta analítica ao banco do BI",
            lineage={"executor": "dynamic_read_only", "tables": ["mirror.crm_negocios"]},
        )
        memory = ThreadMemory(summary="", state={}, history=[], last_sources=[])
        request = YaChatRequest(message="Quantos negócios existem por etapa?")
        user = CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin", full_name="Admin")

        async def fake_ensure(*args, **kwargs):
            return "conversation-1"

        async def fake_persist(*args, **kwargs):
            return "message-1"

        async def exercise():
            with patch("ya_chat.ensure_conversation", new=AsyncMock(side_effect=fake_ensure)), \
                    patch("ya_chat.load_thread_memory", new=AsyncMock(return_value=memory)), \
                    patch("ya_chat.load_schema", new=AsyncMock(return_value=SchemaSnapshot({"mirror.crm_negocios": ("ngo_numero",)}, 0))), \
                    patch("ya_chat._plan_query", new=AsyncMock(return_value={
                        "mode": "data",
                        "intent": "metric",
                        "domain": "negocios",
                        "metrics": [],
                        "sql": "SELECT ngo_etapa, COUNT(*) AS total FROM mirror.crm_negocios GROUP BY ngo_etapa",
                    })), \
                    patch("ya_chat.persist_message", new=AsyncMock(side_effect=fake_persist)), \
                    patch("ya_chat.persist_tool_run", new=AsyncMock()), \
                    patch("ya_chat._gateway.execute", new=AsyncMock(return_value=[("dynamic_read_only", {"rows": [{"total": 3}]}, source, False)])) as gateway:
                prepared = await _prepare_turn(request, user)
                return prepared, gateway

        prepared, gateway = asyncio.run(exercise())
        gateway.assert_awaited_once()
        kwargs = gateway.await_args.kwargs
        self.assertIn("SELECT ngo_etapa", kwargs["dynamic_sql"])
        self.assertEqual(prepared.query_spec["dynamic_tables"], ["mirror.crm_negocios"])
        self.assertEqual(prepared.sources[0].lineage["executor"], "dynamic_read_only")

    def test_source_follow_up_uses_last_evidence_instead_of_planner_error(self):
        source = YaSource(
            id="sales",
            label="Vendas",
            lineage={"executor": "sales_overview"},
            metric_definitions=[{"label": "Faturamento", "definition": "Soma dos pedidos aprovados"}],
            applied_scope={"period": {"from": "2024-05-01", "to": "2024-05-31"}, "filters": {}},
        )
        memory = ThreadMemory(summary="", state={}, history=[], last_sources=[source])
        request = YaChatRequest(message="De onde você tirou essa informação?")
        user = CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin", full_name="Admin")

        async def fake_ensure(*args, **kwargs):
            return "conversation-1"

        async def fake_persist(*args, **kwargs):
            return "message-1"

        async def exercise():
            with patch("ya_chat.ensure_conversation", new=AsyncMock(side_effect=fake_ensure)), \
                    patch("ya_chat.load_thread_memory", new=AsyncMock(return_value=memory)), \
                    patch("ya_chat.persist_message", new=AsyncMock(side_effect=fake_persist)), \
                    patch("ya_chat._gateway.execute", new=AsyncMock()) as gateway:
                prepared = await _prepare_turn(request, user)
                return prepared, gateway

        prepared, gateway = asyncio.run(exercise())
        self.assertIn("sales_overview", prepared.answer_override or "")
        self.assertIn("01/05/2024", prepared.answer_override or "")
        gateway.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
