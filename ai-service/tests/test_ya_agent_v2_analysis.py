import asyncio
import unittest

from ya_agent_models import CompareToolInput, CorrelationToolInput
from ya_agent_tools.analysis import execute_compare, execute_correlation
from ya_agent_tools.common import ToolContext


class AnalysisRuntime:
    def __init__(self):
        self.sales_calls = 0

    async def __call__(self, sql, params):
        if "pg_proc" in sql:
            function = params[0]
            if function == "rpc_desempenho_vendas_bi":
                names = ["p_from", "p_to", "p_ano", "p_vendedor", "p_cidade", "p_condicao", "p_produto", "p_origem", "p_banco", "p_motivo_perda", "p_funis"]
                return [{"signature": "public.rpc_desempenho_vendas_bi(...) ", "argument_names": names, "arguments": "p_from date, p_to date, p_ano integer"}]
            if function == "rpc_etl_status":
                return [{"signature": "public.rpc_etl_status()", "argument_names": [], "arguments": ""}]
            return []
        if "rpc_etl_status()" in sql:
            return [{"payload": {"status": "ok", "refreshed_at": "2026-09-08T10:00:00-03:00"}}]
        if "rpc_desempenho_vendas_bi" in sql:
            self.sales_calls += 1
            if self.sales_calls == 1:
                return [{"payload": {"kpis": {"faturamento": 120, "totalPedidos": 3}, "rankingVendedores": [
                    {"name": "Ana", "valor": 10, "qtd": 1},
                    {"name": "Bia", "valor": 20, "qtd": 2},
                    {"name": "Caio", "valor": 30, "qtd": 3},
                ]}}]
            if self.sales_calls == 2:
                return [{"payload": {"kpis": {"faturamento": 100, "totalPedidos": 2}}}]
            return [{"payload": {"kpis": {"faturamento": 10, "totalPedidos": 1}, "rankingVendedores": [
                {"name": "Ana", "valor": 10, "qtd": 1},
                {"name": "Bia", "valor": 20, "qtd": 2},
                {"name": "Caio", "valor": 30, "qtd": 3},
            ]}}]
        return []


class YaAgentAnalysisTests(unittest.TestCase):
    def test_compare_calculates_absolute_percentage_and_comparison_scope(self):
        runtime = AnalysisRuntime()
        context = ToolContext("user", "conversation", "message", runtime, runtime, runtime)
        result = asyncio.run(execute_compare(context, CompareToolInput(
            dominio="vendas",
            metricas=["vendas.faturamento"],
            periodo_atual_inicio="2026-09-01",
            periodo_atual_fim="2026-09-08",
            periodo_base_inicio="2026-08-01",
            periodo_base_fim="2026-08-08",
        ), "compare"))
        comparison = result.data["comparacoes"][0]
        self.assertEqual(comparison["variacao"]["absolute"], 20)
        self.assertEqual(comparison["variacao"]["percentage"], 20)
        self.assertFalse(comparison["variacao"]["baseline_zero"])
        self.assertIn("comparacao", result.source.applied_scope)

    def test_correlation_requires_three_paired_points_and_marks_association(self):
        runtime = AnalysisRuntime()
        context = ToolContext("user", "conversation", "message", runtime, runtime, runtime)
        result = asyncio.run(execute_correlation(context, CorrelationToolInput(
            metrica_a="vendas.faturamento",
            metrica_b="vendas.pedidos_aprovados",
            granularidade="consultor",
            periodo_inicio="2026-09-01",
            periodo_fim="2026-09-08",
        ), "correlation"))
        self.assertEqual(result.data["status"], "computed")
        self.assertEqual(result.data["n"], 3)
        self.assertEqual(result.data["coeficiente"], 1.0)
        self.assertFalse(result.data["causalidade"])


if __name__ == "__main__":
    unittest.main()
