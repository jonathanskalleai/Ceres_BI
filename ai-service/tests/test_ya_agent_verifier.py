import unittest

from ya_agent_verifier import verify_answer


class YaAgentVerifierTests(unittest.TestCase):
    def test_accepts_pt_br_formatting_when_value_is_in_tool_evidence(self):
        result = verify_answer("Foram 5 vendas e R$ 1.660.540,00, com alta de 10,5%.", [{"vendas": 5, "faturamento": 1660540, "variacao": 10.5}])
        self.assertTrue(result.valid)
        self.assertEqual(result.unknown_numbers, ())

    def test_rejects_number_not_present_in_this_turn(self):
        result = verify_answer("Foram 6 vendas.", [{"vendas": 5}])
        self.assertFalse(result.valid)
        self.assertEqual(result.unknown_numbers, ("6",))

    def test_rejects_misformatted_ticket_that_changes_the_numeric_value(self):
        result = verify_answer("O ticket médio foi R$ 4.506.000,00.", [{"ticketMedio": 45060}])
        self.assertFalse(result.valid)
        self.assertIn("4.506.000,00", result.unknown_numbers)

    def test_ignores_enumeration_markers_but_checks_data_numbers(self):
        result = verify_answer("1. Primeiro cenário\n2. Segundo cenário com 3 vendas.", [{"vendas": 3}])
        self.assertTrue(result.valid)


if __name__ == "__main__":
    unittest.main()
