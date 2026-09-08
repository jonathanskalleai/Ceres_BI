import unittest
from datetime import date, timedelta

from ya_catalog import CATALOG_VERSION, METRICS
from ya_semantics import QueryValidationError, build_query_spec, previous_period


class YaSemanticTests(unittest.TestCase):
    def test_catalog_has_versioned_metrics(self):
        self.assertEqual(CATALOG_VERSION, "2026-09-08.1")
        self.assertIn("vendas.faturamento", METRICS)
        self.assertIn("acoes.ganhos", METRICS)

    def test_previous_period_is_equivalent_and_adjacent(self):
        current = build_query_spec(
            "faturamento",
            context_filters={"from": "2024-05-10", "to": "2024-05-19"},
        ).period
        assert current is not None
        baseline = previous_period(current)
        self.assertEqual(str(baseline.from_date), "2024-04-30")
        self.assertEqual(str(baseline.to_date), "2024-05-09")

    def test_compare_keeps_dimension_and_creates_baseline(self):
        spec = build_query_spec(
            "compare faturamento por vendedor",
            context_filters={"from": "2024-05-01", "to": "2024-05-31", "vendedor": "Ana"},
        )
        self.assertEqual(spec.intent, "compare")
        self.assertEqual(spec.metrics, ["vendas.faturamento"])
        self.assertEqual(spec.dimensions, ["vendedor"])
        self.assertEqual(spec.filters["vendedor"], "Ana")
        self.assertIsNotNone(spec.comparison)
        assert spec.comparison is not None
        self.assertEqual(str(spec.comparison.baseline.from_date), "2024-03-31")
        self.assertEqual(str(spec.comparison.baseline.to_date), "2024-04-30")

    def test_compare_same_period_last_year_keeps_current_scope(self):
        spec = build_query_spec(
            "compare faturamento com o mesmo período do ano passado",
            context_filters={"from": "2026-05-01", "to": "2026-05-31"},
        )
        assert spec.period is not None and spec.comparison is not None
        self.assertEqual((spec.period.from_date.isoformat(), spec.period.to_date.isoformat()), ("2026-05-01", "2026-05-31"))
        self.assertEqual(spec.comparison.kind, "same_period_previous_year")
        self.assertEqual((spec.comparison.baseline.from_date.isoformat(), spec.comparison.baseline.to_date.isoformat()), ("2025-05-01", "2025-05-31"))

    def test_unsupported_context_filter_is_explicit(self):
        spec = build_query_spec(
            "faturamento",
            context_filters={"from": "2024-05-01", "to": "2024-05-31", "categoria": "industrial"},
        )
        self.assertIsNotNone(spec.clarification)
        self.assertIn("categoria", spec.clarification or "")

    def test_follow_up_inherits_cohort_and_period(self):
        first = build_query_spec(
            "faturamento",
            context_filters={"from": "2024-05-01", "to": "2024-05-31", "vendedor": "Ana"},
        )
        state = {"last_query_spec": first.model_dump(mode="json")}
        follow_up = build_query_spec("agora por cidade", memory_state=state)
        self.assertEqual(follow_up.metrics, ["vendas.faturamento"])
        self.assertEqual(follow_up.dimensions, ["cidade"])
        self.assertEqual(follow_up.filters["vendedor"], "Ana")
        assert follow_up.period is not None
        self.assertEqual(str(follow_up.period.from_date), "2024-05-01")
        self.assertEqual(str(follow_up.period.to_date), "2024-05-31")

    def test_unrelated_question_does_not_reuse_previous_metric(self):
        first = build_query_spec(
            "faturamento",
            context_filters={"from": "2024-05-01", "to": "2024-05-31"},
        )
        state = {"last_query_spec": first.model_dump(mode="json")}
        unrelated = build_query_spec("Por que a meta não bateu?", memory_state=state)
        self.assertEqual(unrelated.metrics, [])
        self.assertIsNotNone(unrelated.clarification)

    def test_natural_recent_window_overrides_screen_period(self):
        spec = build_query_spec(
            "faturamento dos últimos 7 dias",
            context_filters={"from": "2024-05-01", "to": "2024-05-31"},
        )
        assert spec.period is not None
        self.assertEqual(spec.period.to_date, date.today())
        self.assertEqual(spec.period.from_date, date.today() - timedelta(days=6))

    def test_natural_previous_month_is_a_metric_query(self):
        spec = build_query_spec("faturamento do mês passado", context_filters={"from": "2024-05-01", "to": "2024-05-31"})
        self.assertEqual(spec.intent, "metric")
        self.assertEqual(spec.metrics, ["vendas.faturamento"])
        assert spec.period is not None
        self.assertEqual(spec.period.from_date.month, (date.today().month - 2) % 12 + 1)

    def test_context_alias_is_canonicalized_and_empty_filters_are_dropped(self):
        spec = build_query_spec(
            "faturamento",
            context_filters={"from": "2024-05-01", "to": "2024-05-31", "motivoPerda": "Preço", "funis": []},
        )
        self.assertEqual(spec.filters, {"motivo_perda": "Preço"})
        self.assertEqual(spec.requested_filters, {"motivo_perda": "Preço"})

    def test_correlation_fallback_selects_two_compatible_metrics(self):
        spec = build_query_spec(
            "correlacione visitas e ganhos por consultor",
            context_filters={"from": "2024-05-01", "to": "2024-05-31"},
        )
        self.assertEqual(spec.metrics, ["acoes.visitas", "acoes.ganhos"])
        self.assertIsNone(spec.clarification)

    def test_unsupported_vague_question_does_not_pick_a_default_kpi(self):
        spec = build_query_spec("resuma a situação comercial", context_filters={"from": "2024-05-01", "to": "2024-05-31"})
        self.assertEqual(spec.metrics, [])
        self.assertIsNotNone(spec.clarification)

    def test_entity_query_requires_a_name(self):
        missing = build_query_spec("quero a visão cliente 360")
        self.assertEqual(missing.intent, "entity_360")
        self.assertIsNotNone(missing.clarification)

        named = build_query_spec("quero a visão do cliente Acme Brasil")
        self.assertEqual(named.intent, "entity_360")
        self.assertEqual(named.entity, {"type": "cliente", "name": "Acme Brasil"})
        self.assertIsNone(named.clarification)

    def test_invalid_planner_metric_is_rejected(self):
        with self.assertRaises(QueryValidationError):
            build_query_spec("faturamento", planned={"metrics": ["metric.sql_injection"]})

    def test_plural_loss_reasons_are_a_breakdown(self):
        spec = build_query_spec(
            "Quais motivos explicam as perdas?",
            context_filters={"from": "2024-05-01", "to": "2024-05-31"},
        )
        self.assertEqual(spec.intent, "breakdown")
        self.assertEqual(spec.metrics, ["vendas.negocios_perdidos"])
        self.assertEqual(spec.dimensions, ["motivo_perda"])

    def test_business_loss_phrase_prefers_loss_metric(self):
        spec = build_query_spec(
            "Quantos negócios foram perdidos?",
            context_filters={"from": "2024-05-01", "to": "2024-05-31"},
        )
        self.assertEqual(spec.metrics, ["negocios.perdidos"])

    def test_approved_orders_use_sales_order_metric(self):
        spec = build_query_spec(
            "Quantos pedidos aprovados tivemos?",
            context_filters={"from": "2024-05-01", "to": "2024-05-31"},
        )
        self.assertEqual(spec.domain, "vendas")
        self.assertEqual(spec.metrics, ["vendas.pedidos_aprovados"])


if __name__ == "__main__":
    unittest.main()
