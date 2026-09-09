import asyncio
import unittest

from ya_memory import update_state
from ya_models import YaContext, YaSource


class YaMemoryTests(unittest.TestCase):
    def test_last_sources_are_retained_after_a_conversational_turn(self):
        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            if sql.startswith("SELECT COALESCE"):
                return [{"conversation_state": {"last_sources": [{"id": "old", "label": "old"}]}}]
            return []

        source = YaSource(
            id="sales",
            label="Vendas",
            lineage={"executor": "sales_overview"},
            applied_scope={"filters": {}},
        )
        state = asyncio.run(update_state(
            fake_query,
            "conversation-1",
            "",
            "Bom dia",
            "Bom dia!",
            YaContext(),
            {"intent": "conversation"},
            [],
        ))
        self.assertEqual(state["last_sources"][0]["id"], "old")
        self.assertEqual(len(calls), 2)

        state = asyncio.run(update_state(
            fake_query,
            "conversation-1",
            "",
            "faturamento",
            "R$ 10",
            YaContext(),
            {"intent": "metric"},
            [source],
        ))
        self.assertEqual(state["last_sources"][0]["id"], "sales")
        self.assertNotIn("preview", state["last_sources"][0])


if __name__ == "__main__":
    unittest.main()
