import json
import unittest
from pathlib import Path


class YaAgentGoldenQuestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).with_name("agent_golden_questions.json")
        cls.cases = json.loads(path.read_text(encoding="utf-8"))

    def test_matrix_has_the_fifteen_planned_cases(self):
        self.assertEqual([case["id"] for case in self.cases], [f"g{index:02d}" for index in range(1, 16)])
        for case in self.cases:
            with self.subTest(case=case["id"]):
                self.assertTrue(case["question"].strip())
                self.assertIsInstance(case["tools"], list)
                self.assertTrue("clarification" in case or "concept" in case)

    def test_matrix_does_not_store_sensitive_or_implementation_payloads(self):
        serialized = json.dumps(self.cases, ensure_ascii=False).casefold()
        for forbidden in ("select ", "password", "bearer ", "api_key", "cpf", "cnpj"):
            self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
