import unittest

from ya_provider import normalize_tool_calls, parse_json_object


class YaAgentProviderTests(unittest.TestCase):
    def test_normalizes_openai_tool_calls_without_executing_arguments(self):
        calls = normalize_tool_calls({
            "tool_calls": [
                {
                    "id": "call-1",
                    "function": {
                        "name": "consultar_desempenho_vendas",
                        "arguments": '{"periodo_inicio":"2026-09-01"}',
                    },
                },
                {
                    "function": {"name": "consultar_banco_bi", "arguments": "not-json"},
                },
                {"function": {"name": ""}},
            ]
        })
        self.assertEqual(calls[0]["id"], "call-1")
        self.assertEqual(calls[0]["arguments"], {"periodo_inicio": "2026-09-01"})
        self.assertIsInstance(calls[1]["arguments"], str)
        self.assertEqual(len(calls), 2)

    def test_recovers_json_object_only_when_the_provider_added_surrounding_text(self):
        self.assertEqual(parse_json_object('prefix {"answer":"ok"} suffix'), {"answer": "ok"})
        self.assertIsNone(parse_json_object("not an object"))


if __name__ == "__main__":
    unittest.main()
