import asyncio
import unittest
from datetime import date

from ya_agent_contract import TurnContract, contract_evidence_status
from ya_agent_intent import _build_contract, resolve_turn
from ya_agent_periods import resolve_comparison
from ya_agent_models import ToolExecution
from ya_models import YaChatRequest, YaSource


class YaAgentIntentTests(unittest.TestCase):
    def test_partial_month_comparison_requires_explicit_coverage_choice(self):
        contract = _build_contract(
            {"intent": "sales_comparison", "domain": "vendas", "period_request": "current_to_date", "comparison_scope": "ask"},
            YaChatRequest(message="Como foi este mês até agora comparado com o mês passado"),
            {}, [], date(2026, 9, 9),
        )
        self.assertEqual(contract.intent, "clarify")
        self.assertEqual([item["label"] for item in contract.choices], ["Agosto inteiro", "Mesmos 9 dias"])

    def test_loss_follow_up_inherits_last_sales_period_and_requires_detail_blocks(self):
        contract = _build_contract(
            {"intent": "loss_details", "domain": "vendas", "period_request": "inherit"},
            YaChatRequest(message="Me fala mais sobre essas perdas, quero detalhes"),
            {"topics": {"vendas": {"period": {"from": "2026-08-01", "to": "2026-08-31"}}}}, [], date(2026, 9, 9),
        )
        self.assertEqual(contract.period, {"from": "2026-08-01", "to": "2026-08-31"})
        self.assertEqual(contract.required_tool, "consultar_desempenho_vendas")
        self.assertIn("perdas", contract.required_blocks)
        self.assertIn("produtos", contract.required_blocks)

    def test_loss_follow_up_typo_also_inherits_the_previous_sales_period(self):
        contract = _build_contract(
            {"intent": "loss_diagnosis", "domain": "vendas", "period_request": "current_to_date"},
            YaChatRequest(message="Me manda um diagnóstico dessas percas"),
            {"topics": {"vendas": {"period": {"from": "2026-08-01", "to": "2026-08-31"}}}}, [], date(2026, 9, 9),
        )
        self.assertEqual(contract.period, {"from": "2026-08-01", "to": "2026-08-31"})

    def test_explicit_comparison_periods_are_preserved_and_future_current_is_clamped(self):
        comparison = resolve_comparison(
            "explicit", "full_previous", date(2026, 9, 9),
            {"current_period_start": "2026-09-01", "current_period_end": "2026-09-20", "base_period_start": "2026-08-01", "base_period_end": "2026-08-31"},
        )
        self.assertEqual(comparison["atual"], {"from": "2026-09-01", "to": "2026-09-09"})
        self.assertEqual(comparison["base"], {"from": "2026-08-01", "to": "2026-08-31"})
        self.assertEqual(comparison["scope"], "explicit")

    def test_product_difference_contract_requires_comparison_and_sales_detail(self):
        contract = _build_contract(
            {"intent": "sales_summary", "domain": "vendas", "period_request": "inherit", "comparison_scope": "full_previous"},
            YaChatRequest(message="Volte às vendas; quais produtos explicam a diferença?"),
            {"topics": {"vendas": {"period": {"from": "2026-09-01", "to": "2026-09-09"}}}}, [], date(2026, 9, 9),
        )
        self.assertEqual(contract.intent, "sales_comparison")
        self.assertEqual(contract.tool_names, ("comparar_periodos", "consultar_desempenho_vendas"))
        self.assertEqual(contract.required_blocks, ("produtos", "rankings"))

    def test_repasse_scope_is_server_resolved_from_user_language(self):
        all_funnels = _build_contract(
            {"intent": "sales_summary", "domain": "vendas"},
            YaChatRequest(message="Agora inclua Repasse."), {}, [], date(2026, 9, 9),
        )
        only_repasse = _build_contract(
            {"intent": "sales_summary", "domain": "vendas"},
            YaChatRequest(message="Mostre somente Repasse."), {}, [], date(2026, 9, 9),
        )
        self.assertEqual(all_funnels.funnel_mode, "todos")
        self.assertEqual(only_repasse.funnel_mode, "somente_repasse")

    def test_model_cannot_change_server_period_or_required_tool_arguments(self):
        contract = TurnContract(
            intent="loss_details", domain="vendas", required_tool="consultar_desempenho_vendas",
            required_blocks=("perdas", "rankings"), period={"from": "2026-09-01", "to": "2026-09-09"},
        )
        arguments = contract.tool_arguments("consultar_desempenho_vendas", {"periodo_inicio": "2024-01-01", "periodo_fim": "2024-01-31", "blocos": ["kpis"]})
        self.assertEqual(arguments["periodo_inicio"], "2026-09-01")
        self.assertEqual(arguments["periodo_fim"], "2026-09-09")
        self.assertEqual(arguments["blocos"], ["perdas", "rankings"])

    def test_memory_recall_does_not_call_save_or_forget_tools(self):
        contract = _build_contract(
            {"intent": "memory", "domain": "conversation", "period_request": "none"},
            YaChatRequest(message="Qual é meu nome?"), {}, [], date(2026, 9, 9),
        )
        self.assertEqual(contract.tool_names, ())

    def test_memory_write_and_forget_use_the_matching_explicit_tool(self):
        save = _build_contract(
            {"intent": "memory", "domain": "conversation", "period_request": "none"},
            YaChatRequest(message="Meu nome é João; lembre disso."), {}, [], date(2026, 9, 9),
        )
        forget = _build_contract(
            {"intent": "memory", "domain": "conversation", "period_request": "none"},
            YaChatRequest(message="Esqueça meu nome."), {}, [], date(2026, 9, 9),
        )
        self.assertEqual(save.tool_names, ("guardar_memoria_usuario",))
        self.assertEqual(forget.tool_names, ("esquecer_memoria_usuario",))

        save_arguments = save.tool_arguments(
            "guardar_memoria_usuario",
            {"chave": "nome", "categoria": "identity", "conteudo": "João", "confirmado": False},
        )
        self.assertTrue(save_arguments["confirmado"])

    def test_concept_metric_is_fixed_by_the_server_contract(self):
        contract = _build_contract(
            {"intent": "concept", "domain": "vendas", "metricas": ["vendas.faturamento"]},
            YaChatRequest(message="Como você calculou esse faturamento?"), {}, [], date(2026, 9, 9),
        )
        arguments = contract.tool_arguments("explicar_conceito", {"metrica": "vendas.ticket_medio"})
        self.assertEqual(arguments["metrica"], "vendas.faturamento")

    def test_resolver_uses_structured_model_output_and_records_usage(self):
        async def classifier(*args, **kwargs):
            return {"content": '{"intent":"loss_diagnosis","domain":"vendas","period_request":"current_to_date","comparison_scope":"none","metricas":[]}', "usage": {"prompt_tokens": 11, "completion_tokens": 5}}

        resolution = asyncio.run(resolve_turn(YaChatRequest(message="diagnóstico das perdas"), {}, [], classifier=classifier, session_id="conversation"))
        self.assertEqual(resolution.contract.intent, "loss_diagnosis")
        self.assertEqual(resolution.classifier_input_tokens, 11)
        self.assertEqual(resolution.classifier_output_tokens, 5)

    def test_resolver_recovers_unambiguous_comparison_when_classifier_output_is_invalid(self):
        async def classifier(*args, **kwargs):
            return {"content": "<function=get_vendas_faturamento>{}", "usage": {}}

        resolution = asyncio.run(resolve_turn(
            YaChatRequest(message="Compare setembro até hoje com agosto inteiro"),
            {}, [], classifier=classifier, session_id="conversation",
        ))

        self.assertEqual(resolution.contract.intent, "sales_comparison")
        self.assertEqual(resolution.contract.classifier_status, "fallback")
        self.assertEqual(resolution.contract.tool_names, ("comparar_periodos",))
        self.assertEqual(resolution.contract.comparison["base"], {"from": "2026-08-01", "to": "2026-08-31"})

    def test_resolver_recovers_loss_diagnosis_for_the_common_typo(self):
        async def classifier(*args, **kwargs):
            raise ValueError("invalid provider output")

        resolution = asyncio.run(resolve_turn(
            YaChatRequest(message="Me manda um diagnóstico dessas percas"),
            {}, [], classifier=classifier, session_id="conversation",
        ))

        self.assertEqual(resolution.contract.intent, "loss_diagnosis")
        self.assertEqual(resolution.contract.classifier_status, "fallback")
        self.assertEqual(resolution.contract.tool_names, ("consultar_desempenho_vendas",))

    def test_evidence_postcondition_rejects_wrong_period(self):
        contract = TurnContract(intent="loss_details", domain="vendas", required_tool="consultar_desempenho_vendas", required_blocks=("perdas",), period={"from": "2026-09-01", "to": "2026-09-09"})
        source = YaSource(id="sales", label="Vendas", applied_scope={"period": {"from": "2026-08-01", "to": "2026-08-31"}})
        execution = ToolExecution(tool_name="consultar_desempenho_vendas", tool_call_id="call", data={"perdas": {"motivos": [{"name": "Preço", "valor": 10}]}}, source=source)
        self.assertEqual(contract_evidence_status(contract, [execution], [source]), (False, "required_blocks_or_scope_missing"))


if __name__ == "__main__":
    unittest.main()
