import unittest

from ya_conversation import greeting_answer, source_answer
from ya_models import YaSource


class YaConversationTests(unittest.TestCase):
    def test_greeting_has_a_natural_fallback_without_a_data_query(self):
        self.assertIn("Bom dia", greeting_answer("Bom dia"))

    def test_source_answer_explains_dynamic_lineage_without_sql(self):
        answer = source_answer([
            YaSource(
                id="dynamic:123",
                label="Consulta analítica ao banco do BI",
                lineage={"executor": "dynamic_read_only", "tables": ["mirror.crm_negocios"]},
                applied_scope={"period": {"from": "2024-05-01", "to": "2024-05-31"}},
            ),
        ])
        self.assertIn("mirror.crm_negocios", answer)
        self.assertIn("01/05/2024", answer)
        self.assertIn("investigação aberta", answer)
        self.assertNotIn("SELECT", answer)


if __name__ == "__main__":
    unittest.main()
