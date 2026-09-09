import json
import unittest

from ya_agent_contract import TurnContract
from ya_agent_prompt import PROMPT_VERSION, build_context
from ya_memory import ThreadMemory
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
            schema_text="SCHEMA RUNTIME:\n- mirror.crm_negocios: ngo_conclusao",
        )
        payload = json.loads(messages[1]["content"])
        self.assertEqual(payload["estado_anterior"]["last_query_spec"]["metrics"], ["vendas.faturamento"])
        self.assertIn("faturamento", payload["resumo_conversa"])
        self.assertEqual(payload["ultimas_mensagens"][0]["role"], "user")
        self.assertIn("metrics=[]", messages[0]["content"])
        self.assertIn("SCHEMA RUNTIME", messages[0]["content"])
        self.assertIn('"mode": "data|conversation|source"', messages[0]["content"])

    def test_answer_prompt_requires_brazilian_format_and_conversational_style(self):
        prompt = answer_messages(request=YaChatRequest(message="faturamento", context={"route": "/bi", "filters": {}}), prepared=_prepared_turn())[0]["content"]
        self.assertIn("R$ 1.234,56", prompt)
        self.assertIn("Não escreva um relatório", prompt)

    def test_v2_prompt_never_uses_previous_answer_numbers_as_current_evidence(self):
        request = YaChatRequest(message="Me explique as perdas deste período")
        memory = ThreadMemory(
            summary=json.dumps({"ultima_resposta": "O ticket médio foi R$ 4.506.000,00."}, ensure_ascii=False),
            state={"last_answer": "O ticket médio foi R$ 4.506.000,00."},
            history=[
                {"role": "user", "content": "Qual foi o ticket?"},
                {"role": "assistant", "content": "O ticket médio foi R$ 4.506.000,00."},
            ],
            last_sources=[],
        )
        prompt = build_context(
            request,
            memory,
            contract=TurnContract(
                intent="loss_details",
                domain="vendas",
                required_tool="consultar_desempenho_vendas",
                required_blocks=("perdas", "rankings", "produtos"),
                period={"from": "2026-09-01", "to": "2026-09-09"},
            ),
        )
        system_text = prompt.messages[0]["content"]
        self.assertIn(PROMPT_VERSION, system_text)
        self.assertIn('"required_tool": "consultar_desempenho_vendas"', system_text)
        self.assertNotIn("4.506.000", json.dumps(prompt.messages, ensure_ascii=False))


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
