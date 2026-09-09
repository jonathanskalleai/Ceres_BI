import asyncio
import unittest

from ya_agent_models import ExploratoryToolInput, SalesToolInput, TeamToolInput
from ya_agent_runtime import RuntimeRpcAdapter
from ya_agent_tools.common import ToolContext, ToolUnavailable, funnel_scope
from ya_agent_tools.exploratory import execute_exploratory
from ya_agent_tools.official import execute_sales, execute_team
from ya_agent_tools.registry import TOOL_DEFINITIONS


class FakeRuntimeQuery:
    def __init__(self):
        self.calls = []

    async def __call__(self, sql, params):
        self.calls.append((sql, params))
        if "pg_proc" in sql:
            function = params[0]
            signatures = {
                "rpc_desempenho_vendas_bi": ("p_from date, p_to date, p_ano integer, p_vendedor text, p_cidade text, p_condicao text, p_produto text, p_origem text, p_banco text, p_motivo_perda text, p_funis text[]", ["p_from", "p_to", "p_ano", "p_vendedor", "p_cidade", "p_condicao", "p_produto", "p_origem", "p_banco", "p_motivo_perda", "p_funis"]),
                "rpc_equipe_desempenho_mensal_v2": ("p_ano integer, p_consultor text, p_cidade text", ["p_ano", "p_consultor", "p_cidade"]),
            }
            if function not in signatures:
                return []
            arguments, names = signatures[function]
            return [{"signature": f"public.{function}({arguments})", "argument_names": names, "arguments": arguments}]
        if "rpc_desempenho_vendas_bi" in sql:
            return [{"payload": {"kpis": {"faturamento": 1000, "totalPedidos": 2, "ticketMedio": 500}, "serieMensal": [{"name": "2026-09", "faturamento": 1000}], "rankingVendedores": [{"name": "Ana", "qtd": 2, "valor": 1000}]}}]
        if "rpc_equipe_desempenho_mensal_v2" in sql:
            return [{"payload": {"rows": [{"competencia": "2026-09-01", "consultor": "Ana", "quantidade_vendas": 2, "faturamento": 1000}], "team": [{"competencia": "2026-09-01", "quantidade_vendas": 2, "faturamento": 1000}]}}]
        return []


class LossRuntimeQuery(FakeRuntimeQuery):
    async def __call__(self, sql, params):
        if "rpc_desempenho_vendas_bi" in sql:
            if "pg_proc" in sql:
                return await super().__call__(sql, params)
            return [{"payload": {"kpis": {"faturamento": 1000, "totalPedidos": 2, "ticketMedio": 500, "valorPerdido": 900, "totalPerdido": 3}, "perdas": {"motivosPerda": [{"motivo": "Preço", "quantidade": 2, "valor": 700}], "rankingVendedores": [{"vendedor": "Ana", "quantidade": 2, "valor": 700}], "rankingProdutos": [{"produto": "Máquina", "quantidade": 1, "valor": 200}]}}}]
        return await super().__call__(sql, params)


class YaAgentToolTests(unittest.TestCase):
    def test_all_ten_tool_schemas_are_strict(self):
        self.assertEqual(len(TOOL_DEFINITIONS), 10)
        for definition in TOOL_DEFINITIONS:
            self.assertTrue(definition["function"]["strict"])
            self.assertFalse(definition["function"]["parameters"].get("additionalProperties", True))

    def test_funnel_modes_are_explicit_and_repasse_is_normalized(self):
        self.assertEqual(funnel_scope("padrao", []), (None, []))
        selected, _ = funnel_scope("selecionados", [" Repasse de Máquina "])
        self.assertEqual(selected, ["REPASSE DE MAQUINA"])
        repasse, _ = funnel_scope("somente_repasse", [])
        self.assertIn("REPASSE DE MAQUINA", repasse)
        self.assertIn("REPASSE DE MÁQUINA", repasse)

    def test_runtime_signature_accepts_consultor_contract_without_guessing_vendedor(self):
        fake = FakeRuntimeQuery()
        adapter = RuntimeRpcAdapter(fake)
        result = asyncio.run(adapter.call("rpc_equipe_desempenho_mensal_v2", {"p_ano": (2026, "integer"), "p_vendedor": ("Ana", "text"), "p_consultor": ("Ana", "text"), "p_cidade": (None, "text")}, required_arguments=("p_ano",)))
        self.assertIsInstance(result, dict)
        invocation = fake.calls[-1][0]
        self.assertIn("p_consultor =>", invocation)
        self.assertNotIn("p_vendedor =>", invocation)

    def test_sales_and_team_tools_return_human_scope_and_derived_team_ticket(self):
        fake = FakeRuntimeQuery()
        context = ToolContext("user", "conversation", "message", fake, fake, fake)
        sales = asyncio.run(execute_sales(context, SalesToolInput(periodo_inicio="2026-09-01", periodo_fim="2026-09-08", blocos=["kpis", "serie", "rankings"], apresentacao="linha"), "call-sales"))
        self.assertIn("Repasse de Máquina excluído", sales.data["concept"])
        self.assertEqual(sales.source.applied_scope["competencias"], ["aprovação do pedido", "fechamento do negócio"])
        self.assertTrue(sales.artifacts)
        team = asyncio.run(execute_team(context, TeamToolInput(ano=2026, indicadores=["vendas", "faturamento"]), "call-team"))
        self.assertEqual(team.data["rows"][0]["ticket_medio"], 500.0)

    def test_loss_diagnosis_returns_detail_tables_instead_of_only_kpis(self):
        fake = LossRuntimeQuery()
        context = ToolContext("user", "conversation", "message", fake, fake, fake)
        result = asyncio.run(execute_sales(context, SalesToolInput(periodo_inicio="2026-09-01", periodo_fim="2026-09-09", blocos=["perdas", "rankings", "produtos"], apresentacao="tabela"), "call-loss"))
        titles = {artifact.title for artifact in result.artifacts}
        self.assertIn("Perdas por motivo", titles)
        self.assertIn("Perdas por vendedor", titles)
        self.assertIn("Perdas por produto", titles)
        self.assertGreaterEqual(len(result.artifacts), 3)

    def test_product_drilldown_exposes_product_ranking_and_artifact(self):
        fake = FakeRuntimeQuery()
        original = fake.__call__

        async def product_query(sql, params):
            if "rpc_desempenho_vendas_bi" in sql and "pg_proc" not in sql:
                return [{"payload": {"kpis": {}, "rankingProdutos": [{"produto": "Máquina", "valor": 100}]}}]
            return await original(sql, params)

        context = ToolContext("user", "conversation", "message", product_query, product_query, product_query)
        result = asyncio.run(execute_sales(context, SalesToolInput(periodo_inicio="2026-09-01", periodo_fim="2026-09-09", blocos=["produtos", "rankings"], apresentacao="tabela"), "call-product"))
        self.assertEqual(result.data["rankings"]["produtos"][0]["produto"], "Máquina")
        self.assertIn("Ranking de produtos", {artifact.title for artifact in result.artifacts})

    def test_exploration_is_blocked_when_runtime_schema_is_unavailable(self):
        async def no_query(sql, params):
            raise AssertionError("schema indisponível não deve consultar o banco")

        context = ToolContext("user", "conversation", "message", no_query, no_query, no_query, schema_available=False, schema_tables=set())
        with self.assertRaises(ToolUnavailable):
            asyncio.run(execute_exploratory(context, ExploratoryToolInput(objetivo="teste", sql="SELECT 1 FROM mirror.crm_negocios"), "call-exploration"))


if __name__ == "__main__":
    unittest.main()
