import unittest
from datetime import datetime

from ya_catalog import get_metric
from ya_semantics import build_query_spec

from ya_tool_utils import compare_data
from ya_tools import _compact, pearson


class YaToolTests(unittest.TestCase):
    def test_pearson_requires_a_real_paired_sample(self):
        self.assertEqual(pearson([(1, 2), (2, 4), (3, 6)]), 1.0)
        self.assertIsNone(pearson([(1, 2), (2, 4)]))
        self.assertIsNone(pearson([(1, 2), (1, 4), (1, 6)]))

    def test_compact_limits_nested_result_size(self):
        compacted = _compact({"rows": list(range(100))})
        self.assertEqual(len(compacted["rows"]), 50)

    def test_compact_removes_sensitive_identity_fields_and_redacts_text(self):
        compacted = _compact({"clienteId": "internal-id", "observacao": "contato 11999998888 e a@empresa.com"})
        self.assertNotIn("clienteId", compacted)
        self.assertIn("[oculto]", compacted["observacao"])

    def test_gateway_uses_only_an_approved_rpc_and_returns_evidence_preview(self):
        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            if "sync_control" in sql:
                return [{"refreshed_at": datetime(2024, 5, 31, 12, 0)}]
            return [{"payload": {"kpis": {"faturamento": 1234.5}}}]

        async def exercise():
            spec = build_query_spec(
                "faturamento",
                context_filters={"from": "2024-05-01", "to": "2024-05-31", "vendedor": "Ana"},
            )
            from ya_tools import ToolGateway

            return await ToolGateway(fake_query).execute(spec, "user-gateway-test")

        gateway_result = _run_async(exercise())
        self.assertEqual(len(gateway_result), 1)
        self.assertEqual(gateway_result[0][2].preview["value"], 1234.5)
        self.assertEqual(gateway_result[0][2].lineage["executor"], "sales_overview")
        self.assertEqual(len(calls), 2)
        self.assertIn("rpc_desempenho_vendas_bi", calls[1][0])
        self.assertNotIn("SELECT *", calls[1][0])

    def test_gateway_does_not_query_when_plan_requires_clarification(self):
        calls = []

        async def fake_query(sql, params):
            calls.append(sql)
            return []

        async def exercise():
            from ya_tools import ToolGateway

            spec = build_query_spec("faturamento", context_filters={"categoria": "industrial"})
            return await ToolGateway(fake_query).execute(spec, "user-clarification-test")

        self.assertEqual(_run_async(exercise()), [])
        self.assertEqual(calls, [])

    def test_correlation_reads_metric_specific_columns_from_a_shared_ranking(self):
        async def fake_query(sql, params):
            if "sync_control" in sql:
                return [{"refreshed_at": datetime(2024, 5, 31, 12, 0)}]
            return [{"payload": {"rankingConsultores": [
                {"consultor": "Ana", "visitas": 10, "ganhos": 2},
                {"consultor": "Bia", "visitas": 20, "ganhos": 4},
                {"consultor": "Caio", "visitas": 30, "ganhos": 6},
            ]}}]

        async def exercise():
            spec = build_query_spec(
                "correlacione visitas e ganhos por consultor",
                context_filters={"from": "2024-05-01", "to": "2024-05-31"},
            )
            from ya_tools import ToolGateway

            return await ToolGateway(fake_query).execute(spec, "user-correlation-test")

        result = _run_async(exercise())[0]
        self.assertEqual(result[1]["status"], "computed")
        self.assertEqual(result[1]["n"], 3)
        self.assertEqual(result[1]["coefficient"], 1.0)

    def test_compare_uses_the_requested_metric_column_in_a_shared_ranking(self):
        result = compare_data(
            {"dimension": "consultor", "rows": [{"consultor": "Ana", "visitas": 10, "ganhos": 2}]},
            {"dimension": "consultor", "rows": [{"consultor": "Ana", "visitas": 8, "ganhos": 1}]},
            get_metric("acoes.ganhos"),
        )
        self.assertEqual(result["variation"]["rows"][0]["absolute"], 1.0)

    def test_filter_values_uses_the_canonical_filter_rpc(self):
        calls = []

        async def fake_query(sql, params):
            calls.append(sql)
            if "sync_control" in sql:
                return [{"refreshed_at": None}]
            return [{"payload": {"vendedores": ["Ana", "Bia"], "cidades": ["Cascavel"]}}]

        async def exercise():
            spec = build_query_spec("quais vendedores disponíveis", context_filters={"from": "2024-05-01", "to": "2024-05-31"})
            from ya_tools import ToolGateway

            return await ToolGateway(fake_query).execute(spec, "user-filter-test")

        result = _run_async(exercise())[0]
        self.assertEqual(result[1]["values"], ["Ana", "Bia"])
        self.assertIn("rpc_listas_filtros", calls[1])

    def test_freshness_includes_etl_status_without_exposing_raw_sql(self):
        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            if "sync_control" in sql:
                return [{"refreshed_at": datetime(2024, 5, 31, 12, 0)}]
            return [{"payload": [{"table_name": "crm_pedidos", "status": "success", "rows_synced": 12}]}]

        async def exercise():
            from ya_tools import ToolGateway

            spec = build_query_spec("Os dados estão atualizados?")
            return await ToolGateway(fake_query).execute(spec, "user-freshness-test")

        result = _run_async(exercise())[0]
        self.assertEqual(result[1]["etl"][0]["status"], "success")
        self.assertIn("rpc_etl_status", calls[1][0])
        self.assertNotIn("SELECT *", calls[1][0])

    def test_business_breakdown_uses_the_named_business_rpc_block(self):
        async def fake_query(sql, params):
            if "sync_control" in sql:
                return [{"refreshed_at": None}]
            return [{"payload": {"kpis": {"totalNegocios": 5}, "funilPorEtapa": [{"name": "Oportunidade", "qtd": 5, "valor": 100}]}}]

        async def exercise():
            spec = build_query_spec(
                "negócios por etapa",
                context_filters={"from": "2024-05-01", "to": "2024-05-31"},
            )
            from ya_tools import ToolGateway

            return await ToolGateway(fake_query).execute(spec, "user-business-test")

        result = _run_async(exercise())[0]
        self.assertEqual(result[1]["rows"][0]["name"], "Oportunidade")


def _run_async(coroutine):
    import asyncio

    return asyncio.run(coroutine)


if __name__ == "__main__":
    unittest.main()
