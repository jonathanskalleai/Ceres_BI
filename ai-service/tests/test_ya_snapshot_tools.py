import unittest
from datetime import datetime

from ya_semantics import build_query_spec
from ya_tools import ToolGateway


class YaSnapshotToolTests(unittest.TestCase):
    def test_products_breakdown_uses_the_snapshot_rpc_and_marks_scope(self):
        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            if "sync_control" in sql:
                return [{"refreshed_at": datetime(2024, 5, 31, 12, 0)}]
            return [{"payload": {
                "kpis": {"totalMaquinas": 12},
                "porMarca": [{"name": "Ceres", "value": 8}, {"name": "Outra", "value": 4}],
            }}]

        async def exercise():
            spec = build_query_spec("Parque por marca.")
            return spec, await ToolGateway(fake_query).execute(spec, "snapshot-test")

        spec, result = _run_async(exercise())
        self.assertIsNone(spec.period)
        self.assertEqual(result[0][0], "get_breakdown")
        self.assertEqual(result[0][1]["rows"][0]["name"], "Ceres")
        self.assertTrue(result[0][2].applied_scope["snapshot"])
        self.assertEqual(calls[1][1], ())
        self.assertIn("rpc_produtos_bi", calls[1][0])

    def test_snapshot_comparison_is_rejected_before_any_database_call(self):
        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            return []

        async def exercise():
            spec = build_query_spec("Compare as máquinas instaladas.")
            return spec, await ToolGateway(fake_query).execute(spec, "snapshot-compare-test")

        spec, result = _run_async(exercise())
        self.assertTrue(spec.clarification)
        self.assertEqual(result, [])
        self.assertEqual(calls, [])


def _run_async(coroutine):
    import asyncio

    return asyncio.run(coroutine)


if __name__ == "__main__":
    unittest.main()
