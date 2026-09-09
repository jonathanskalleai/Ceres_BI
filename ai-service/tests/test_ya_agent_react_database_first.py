import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from auth import CurrentUser
from ya_agent import AgentRunner
from ya_agent_models import AgentArtifact, ToolExecution
from ya_agent_prompt import build_context, PROMPT_VERSION
from ya_agent_verifier import verify_answer
from ya_memory import ThreadMemory
from ya_models import YaChatRequest, YaSource
from ya_schema import SchemaSnapshot


USER = CurrentUser(id="00000000-0000-0000-0000-000000000001", role="admin", full_name="Admin")


class DatabaseFirstRegistry:
    def __init__(self):
        self.calls = []

    async def execute(self, tool_call, context):
        self.calls.append(tool_call)
        source = YaSource(
            id="db-source-1",
            label="consulta ao banco de dados do BI",
            applied_scope={"sql": tool_call.arguments.get("sql")},
            execution_metrics={"elapsed_ms": 15, "row_count": 2},
        )
        artifact = AgentArtifact(
            type="table",
            title="Comparação de Faturamento",
            rows=[
                {"periodo": "01/09 a 09/09", "faturamento": 225300, "pedidos": 5},
                {"periodo": "01/08 a 09/08", "faturamento": 52700, "pedidos": 2},
            ],
            source_ids=[source.id],
        )
        return ToolExecution(
            tool_name=tool_call.name,
            tool_call_id=tool_call.call_id,
            data={
                "status": "computed",
                "rows": [
                    {"periodo": "atual", "faturamento": 225300, "pedidos": 5},
                    {"periodo": "anterior", "faturamento": 52700, "pedidos": 2},
                ],
                "row_count": 2,
            },
            source=source,
            artifacts=[artifact],
        )


def patch_runner_dependencies():
    memory = ThreadMemory(summary="", state={}, history=[], last_sources=[], user_memories=[])
    async def persist(*args, **kwargs):
        return "user-message" if args[2] == "user" else "assistant-message"
    return [
        patch("ya_agent_runner.ensure_conversation", new=AsyncMock(return_value="conversation-1")),
        patch("ya_agent_runner.load_agent_memory", new=AsyncMock(return_value=memory)),
        patch("ya_agent_runner.persist_message", new=AsyncMock(side_effect=persist)),
        patch("ya_agent_runner.load_schema", new=AsyncMock(return_value=SchemaSnapshot({"mirror.crm_negocios": ("ngo_numero", "ngo_funil", "ngo_conclusao"), "mirror.crm_pedidos": ("pdo_vlr_pedido", "pdo_dth_aprovacao")}, 0))),
        patch("ya_agent_runner.update_agent_state", new=AsyncMock(return_value={"active_topic": "vendas"})),
        patch("ya_agent_runner.persist_agent_turn_metrics", new=AsyncMock()),
        patch("ya_agent_runner.persist_agent_tool_run", new=AsyncMock()),
    ]


class YaAgentReactDatabaseFirstTests(unittest.TestCase):
    def test_prompt_contains_semantic_business_rules(self):
        request = YaChatRequest(message="Como foram as vendas deste mês?", context={"route": "/bi/vendas", "filters": {}})
        memory = ThreadMemory(summary="", state={}, history=[], last_sources=[], user_memories=[])
        context = build_context(request, memory)
        prompt = context.messages[0]["content"]

        self.assertIn("REGRAS DE NEGÓCIO ESSENCIAIS DO CERES BI", prompt)
        self.assertIn("REPASSE", prompt)
        self.assertIn("pdo_situacao_pedido ILIKE '%aprovado%'", prompt)
        self.assertIn("ngo_conclusao = 'GANHO'", prompt)
        self.assertIn("consultar_banco_bi", prompt)

    def test_database_first_tool_call_is_executed_and_answered_natively(self):
        async def scenario():
            registry = DatabaseFirstRegistry()
            turns = [
                {
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call-sql-1",
                                "type": "function",
                                "function": {
                                    "name": "consultar_banco_bi",
                                    "arguments": '{"sql": "SELECT COUNT(DISTINCT pdo_codigo_interno) as pedidos, SUM(pdo_vlr_pedido) as faturamento FROM mirror.crm_pedidos WHERE pdo_situacao_pedido ILIKE \'%aprovado%\'", "objetivo": "Calcular faturamento e pedidos aprovados", "apresentacao": "tabela"}',
                                },
                            }
                        ],
                    }
                },
                {
                    "message": {
                        "role": "assistant",
                        "content": "No mês atual até agora tivemos R$ 225.300,00 em faturamento e 5 pedidos aprovados, comparado a R$ 52.700,00 e 2 pedidos no mesmo período do mês anterior. O crescimento foi de 328% no faturamento.",
                    }
                },
            ]

            async def fake_provider(messages, tools, **kwargs):
                return turns.pop(0)

            patches = patch_runner_dependencies()
            for p in patches:
                p.start()
            try:
                runner = AgentRunner(registry=registry, provider=fake_provider)
                request = YaChatRequest(message="qual o resultado desse mes comparado com o mes anterior")
                result = await runner.run(request, USER)

                self.assertEqual(len(registry.calls), 1)
                self.assertEqual(registry.calls[0].name, "consultar_banco_bi")
                self.assertIn("225.300", result.answer)
                self.assertIn("328%", result.answer)
                self.assertEqual(len(result.artifacts), 1)
                self.assertEqual(result.artifacts[0].type, "table")
                self.assertEqual(result.stats["status"], "completed")
            finally:
                for p in patches:
                    p.stop()

        asyncio.run(scenario())

    def test_verifier_accepts_rounded_percentages_and_formatted_currency(self):
        evidence = [
            {
                "status": "computed",
                "rows": [
                    {"periodo": "atual", "faturamento": 225300, "pedidos": 5},
                    {"periodo": "base", "faturamento": 52700, "pedidos": 2},
                ],
                "variacao": 327.5142,
            }
        ]
        answer = "O faturamento foi de R$ 225.300,00 contra R$ 52.700,00, uma alta de 328% com 5 pedidos."
        result = verify_answer(answer, evidence)
        self.assertTrue(result.valid)
        self.assertEqual(result.unknown_numbers, ())


if __name__ == "__main__":
    unittest.main()
