import logging
import unittest
from unittest.mock import patch

import ai_logger


class AiLoggerTests(unittest.TestCase):
    def test_log_event_redacts_sensitive_fields_and_values(self):
        with patch.object(ai_logger._logger, "log") as log:
            ai_logger.log_event(
                logging.ERROR,
                "unsafe",
                authorization="Bearer top-secret",
                error="SELECT * FROM mirror.crm_pedidos WHERE email=x@y.test",
                nested={"token": "another-secret", "safe": "kept"},
            )

        rendered = log.call_args.args[1]
        self.assertNotIn("top-secret", rendered)
        self.assertNotIn("another-secret", rendered)
        self.assertNotIn("SELECT *", rendered)
        self.assertIn("redacted", rendered)
        self.assertIn("kept", rendered)

    def test_log_exception_does_not_emit_a_raw_traceback(self):
        with patch.object(ai_logger._logger, "log") as log, patch.object(ai_logger._logger, "exception") as exception:
            ai_logger.log_exception("failed", RuntimeError("SELECT secret_value"))

        self.assertFalse(exception.called)
        rendered = log.call_args.args[1]
        self.assertNotIn("secret_value", rendered)
        self.assertIn("redacted", rendered)


if __name__ == "__main__":
    unittest.main()
