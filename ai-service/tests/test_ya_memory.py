import asyncio
import unittest

from ya_memory import forget_user_memory, load_user_memories, save_user_memory, structured_thread_state, update_state
from ya_models import YaContext, YaSource


class YaMemoryTests(unittest.TestCase):
    def test_durable_memory_is_loaded_for_the_requested_user_and_filters_current_numbers(self):
        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            return [
                {"memory_key": "nome", "category": "identity", "content": "João"},
                {"memory_key": "último total", "category": "context", "content": "vendas: 5"},
            ]

        memories = asyncio.run(load_user_memories(fake_query, "user-a"))
        self.assertEqual(memories, [{"key": "nome", "category": "identity", "content": "João"}])
        self.assertEqual(calls[0][1][0], "user-a")

    def test_sensitive_durable_memory_is_rejected_before_persistence(self):
        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            return []

        with self.assertRaises(ValueError):
            asyncio.run(save_user_memory(
                fake_query,
                user_id="user-a",
                memory_key="contato",
                category="identity",
                content="joao@example.com",
                conversation_id="conversation-1",
                message_id="message-1",
            ))
        self.assertEqual(calls, [])

    def test_thread_state_keeps_topics_separate_and_forgetting_is_user_scoped(self):
        source = YaSource(id="equipe", label="Equipe")
        state = structured_thread_state(
            {"topics": {"vendas": {"period": {"from": "2026-08-01"}}}},
            "Como foi a equipe?",
            "A equipe foi consultada.",
            YaContext(),
            {"domain": "equipe", "intent": "metric"},
            [source],
        )
        self.assertEqual(state["active_topic"], "equipe")
        self.assertEqual(state["topics"]["vendas"]["period"]["from"], "2026-08-01")
        self.assertEqual(state["topics"]["equipe"]["last_evidence_ids"], ["equipe"])

        calls = []

        async def fake_query(sql, params):
            calls.append((sql, params))
            return [{"memory_key": "nome"}]

        result = asyncio.run(forget_user_memory(fake_query, user_id="user-b", memory_key="nome"))
        self.assertEqual(result["status"], "forgotten")
        self.assertEqual(calls[0][1][0], "user-b")

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
