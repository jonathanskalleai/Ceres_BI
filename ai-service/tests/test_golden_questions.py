import json
import unittest
from pathlib import Path

from ya_semantics import build_query_spec


class GoldenQuestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).with_name("golden_questions.json")
        cls.cases = json.loads(path.read_text(encoding="utf-8"))["cases"]

    def test_all_golden_questions_match_semantic_contract(self):
        for case in self.cases:
            with self.subTest(case=case["id"]):
                spec = build_query_spec(
                    case["question"],
                    context_filters=case.get("context_filters", {}),
                    memory_state=case.get("memory_state", {}),
                    planned=case.get("planned", {}),
                )
                if "intent" in case:
                    self.assertEqual(spec.intent, case["intent"])
                if "domain" in case:
                    self.assertEqual(spec.domain, case["domain"])
                if "metrics" in case:
                    self.assertEqual(spec.metrics, case["metrics"])
                if "dimensions" in case:
                    self.assertEqual(spec.dimensions, case["dimensions"])
                if "filters" in case:
                    self.assertEqual(spec.filters, case["filters"])
                if "clarification" in case:
                    self.assertEqual(bool(spec.clarification), case["clarification"])


if __name__ == "__main__":
    unittest.main()
