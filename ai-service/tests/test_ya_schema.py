import asyncio
import unittest

from ya_schema import clear_schema_cache, load_schema


class YaSchemaTests(unittest.TestCase):
    def test_runtime_schema_is_available_to_planner_without_exposing_sensitive_columns(self):
        async def fake_query(sql, params):
            return [
                {"table_schema": "mirror", "table_name": "crm_negocios", "column_name": "ngo_numero", "data_type": "text"},
                {"table_schema": "mirror", "table_name": "crm_negocios", "column_name": "cli_email", "data_type": "text"},
            ]

        clear_schema_cache()
        snapshot = asyncio.run(load_schema(fake_query))
        self.assertEqual(snapshot.table_names, {"mirror.crm_negocios"})
        self.assertIn("ngo_numero", snapshot.prompt_text())
        self.assertNotIn("cli_email", snapshot.prompt_text())


if __name__ == "__main__":
    unittest.main()
