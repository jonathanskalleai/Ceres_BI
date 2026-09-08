import json
import unittest

from ya_models import YaChatRequest
from ya_prompts import answer_messages, planner_messages


class YaPromptTests(unittest.TestCase):
    def test_planner_receives_structured_memory_and_recent_turns(self):
        request = YaChatRequest(message="E no mês anterior?", context={"route": "/bi", "filters": {}})
        messages = planner_messages(
            request.message,
            request,
            {"last_query_spec": {"metrics": ["vendas.faturamento"]}},
            summary="Pergunta anterior: Qual foi o faturamento?",
            history=[{"role": "user", "content": "Qual foi o faturamento?"}],
        )
        payload = json.loads(messages[1]["content"])
        self.assertEqual(payload["estado_anterior"]["last_query_spec"]["metrics"], ["vendas.faturamento"])
        self.assertIn("faturamento", payload["resumo_conversa"])
        self.assertEqual(payload["ultimas_mensagens"][0]["role"], "user")
        self.assertIn("metrics=[]", messages[0]["content"])

    def test_answer_prompt_requires_brazilian_format_and_conversational_style(self):
        prompt = answer_messages(request=YaChatRequest(message="faturamento", context={"route": "/bi", "filters": {}}), prepared=_prepared_turn())[0]["content"]
        self.assertIn("R$ 1.234,56", prompt)
        self.assertIn("Não escreva um relatório", prompt)


def _prepared_turn():
    from ya_models import PreparedTurn

    return PreparedTurn(
        conversation_id="conversation-1",
        user_message_id="message-1",
        history=[],
        summary="",
        conversation_state={},
        query_spec={},
        sources=[],
        executed=[],
        answer_override=None,
        db_ms=0,
        cache_hits=0,
        row_count=0,
    )


if __name__ == "__main__":
    unittest.main()
