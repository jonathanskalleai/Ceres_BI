import asyncio
import unittest
from datetime import datetime
from decimal import Decimal

from ya_dynamic_query import DynamicQueryExecutor, DynamicQueryValidationError, validate_read_only_sql
from ya_query_models import QuerySpec


class YaDynamicQueryTests(unittest.TestCase):
    def test_accepts_explicit_read_only_query_and_extracts_mirror_tables(self):
        validated = validate_read_only_sql(
            "SELECT n.ngo_conclusao, COUNT(*) AS total FROM mirror.crm_negocios n GROUP BY n.ngo_conclusao",
            {"mirror.crm_negocios"},
        )
        self.assertEqual(validated.tables, ("mirror.crm_negocios",))
        self.assertEqual(len(validated.query_hash), 64)

    def test_accepts_postgres_quoted_business_identifiers(self):
        validated = validate_read_only_sql(
            'SELECT "n"."ngo_conclusao", COUNT(*) AS total FROM "mirror"."crm_negocios" AS n GROUP BY "n"."ngo_conclusao"',
            {"mirror.crm_negocios"},
        )
        self.assertEqual(validated.tables, ("mirror.crm_negocios",))

    def test_accepts_one_trailing_statement_terminator(self):
        validated = validate_read_only_sql(
            "SELECT COUNT(*) AS total FROM mirror.crm_negocios;",
            {"mirror.crm_negocios"},
        )
        self.assertFalse(validated.sql.endswith(";"))

    def test_rejects_writes_comments_system_sources_and_select_star(self):
        invalid = (
            "INSERT INTO mirror.crm_negocios VALUES (1)",
            "SELECT * FROM mirror.crm_negocios",
            "SELECT n.* FROM mirror.crm_negocios n",
            "SELECT pg_read_file('x') FROM mirror.crm_negocios",
            "SELECT pg_stat_file('x') FROM mirror.crm_negocios",
            "SELECT version() FROM mirror.crm_negocios",
            'SELECT "public"."version"() FROM mirror.crm_negocios',
            "WITH RECURSIVE tree AS (SELECT 1) SELECT 1 FROM mirror.crm_negocios",
            "SELECT COUNT(*) FROM mirror.crm_negocios; SELECT 1",
            "SELECT n.ngo_numero, p.pdo_codigointerno FROM mirror.crm_negocios n CROSS JOIN mirror.crm_pedidos p",
            "SELECT n.ngo_numero FROM mirror.crm_negocios n WHERE (n.ngo_conclusao = 'Ganho'",
        )
        for sql in invalid:
            with self.subTest(sql=sql):
                with self.assertRaises(DynamicQueryValidationError):
                    validate_read_only_sql(sql, {"mirror.crm_negocios"})

    def test_requires_explicit_join_and_known_mirror_objects(self):
        invalid = (
            "SELECT n.ngo_numero, p.pdo_vlrpedido FROM mirror.crm_negocios n, mirror.crm_pedidos p",
            "SELECT n.ngo_numero FROM mirror.crm_negocios n JOIN mirror.tabela_inexistente x ON x.id = n.id",
            "SELECT n.ngo_numero FROM mirror.crm_negocios n JOIN mirror.tabela_interna x ON x.id = n.id",
        )
        for sql in invalid:
            with self.subTest(sql=sql):
                with self.assertRaises(DynamicQueryValidationError):
                    validate_read_only_sql(sql, {"mirror.crm_negocios", "mirror.crm_pedidos", "mirror.tabela_interna"})

    def test_allows_percent_literals_without_driver_parameters(self):
        calls = []

        async def fake_read_only(sql, params):
            calls.append((sql, params))
            return [{"total": 2}]

        async def exercise():
            spec = QuerySpec(intent="metric", domain="vendas", mode="data")
            return await DynamicQueryExecutor(fake_read_only).execute(
                spec,
                "SELECT COUNT(*) AS total FROM mirror.crm_negocios WHERE ngo_conclusao LIKE '%ganho%'",
                "user-test",
                {"status": "known", "refreshed_at": None},
                {"mirror.crm_negocios"},
            )

        asyncio.run(exercise())
        self.assertIsNone(calls[0][1])
        self.assertIn("LIKE '%ganho%'", calls[0][0])

    def test_allows_cte_but_requires_underlying_mirror_table(self):
        validated = validate_read_only_sql(
            "WITH totals AS (SELECT ngo_conclusao, COUNT(*) AS total FROM mirror.crm_negocios GROUP BY ngo_conclusao) SELECT ngo_conclusao, total FROM totals",
            {"mirror.crm_negocios"},
        )
        self.assertEqual(validated.tables, ("mirror.crm_negocios",))

    def test_executor_limits_and_redacts_result_without_persisting_sql(self):
        calls = []

        async def fake_read_only(sql, params):
            calls.append((sql, params))
            return [{
                "consultor": "Ana",
                "valor": Decimal("12.50"),
                "email": "ana@empresa.com",
                "cliente_id": 99,
                "atualizado": datetime(2024, 5, 31, 12, 0),
            }]

        async def exercise():
            spec = QuerySpec(intent="metric", domain="vendas", mode="data")
            return await DynamicQueryExecutor(fake_read_only).execute(
                spec,
                "SELECT n.ngo_conclusao, COUNT(*) AS total FROM mirror.crm_negocios n GROUP BY n.ngo_conclusao",
                "user-test",
                {"status": "known", "refreshed_at": "2024-05-31T12:00:00"},
                {"mirror.crm_negocios"},
            )

        name, data, source, _ = asyncio.run(exercise())
        self.assertEqual(name, "dynamic_read_only")
        self.assertIsNone(calls[0][1])
        self.assertIn("LIMIT 101", calls[0][0])
        self.assertEqual(data["rows"][0]["valor"], 12.5)
        self.assertNotIn("email", data["rows"][0])
        self.assertNotIn("cliente_id", data["rows"][0])
        self.assertEqual(source.lineage["tables"], ["mirror.crm_negocios"])
        self.assertNotIn("sql", source.lineage)


if __name__ == "__main__":
    unittest.main()
