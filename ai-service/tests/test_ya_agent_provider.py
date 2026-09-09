import asyncio
import unittest
from unittest.mock import patch

from ya_provider import complete_with_tools, normalize_tool_calls, parse_json_object


class _FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}], "model": "test-model"}


class _FakeClient:
    payload = None

    def __init__(self, **kwargs):
        self.options = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, *, json, headers):
        _FakeClient.payload = json
        return _FakeResponse()


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

    def test_sends_forced_tool_choice_to_openrouter(self):
        with patch("ya_provider.OPENROUTER_API_KEY", "configured"), patch("ya_provider.httpx.AsyncClient", _FakeClient):
            asyncio.run(complete_with_tools([], [], tool_choice={"type": "function", "function": {"name": "consultar_desempenho_vendas"}}))
        self.assertEqual(_FakeClient.payload["tool_choice"]["function"]["name"], "consultar_desempenho_vendas")

    def test_structured_classifier_accepts_json_mode_contract(self):
        from ya_provider import complete_structured

        with patch("ya_provider.OPENROUTER_API_KEY", "configured"), patch("ya_provider.httpx.AsyncClient", _FakeClient):
            result = asyncio.run(complete_structured([], json_mode=True))
        self.assertEqual(result["model"], "test-model")
        self.assertEqual(_FakeClient.payload["response_format"], {"type": "json_object"})


if __name__ == "__main__":
    unittest.main()
