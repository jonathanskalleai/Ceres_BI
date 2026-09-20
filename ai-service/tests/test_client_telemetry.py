from datetime import datetime, timezone
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from client_telemetry import ClientTelemetryPayload, TelemetryRateLimiter, rate_limiter, router
from ya_chat import router as ya_router


class ClientTelemetryTests(unittest.TestCase):
    def setUp(self) -> None:
        rate_limiter.windows.clear()
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def test_payload_accepts_bounded_redacted_event(self) -> None:
        payload = ClientTelemetryPayload(
            event="bi_query_failed",
            error="request_timeout",
            fields={"query_hash": "safe-hash", "attempt": 1},
            at=datetime.now(timezone.utc),
        )

        self.assertEqual(payload.event, "bi_query_failed")

    def test_payload_rejects_excess_fields(self) -> None:
        with self.assertRaises(ValidationError):
            ClientTelemetryPayload(
                event="bi_query_failed",
                error="request_timeout",
                fields={f"field_{index}": index for index in range(13)},
                at=datetime.now(timezone.utc),
            )

    def test_rate_limiter_blocks_after_limit(self) -> None:
        limiter = TelemetryRateLimiter(limit=2, window_seconds=60)
        limiter.check("client")
        limiter.check("client")

        with self.assertRaises(HTTPException) as raised:
            limiter.check("client")

        self.assertEqual(raised.exception.status_code, 429)

    def test_endpoint_accepts_and_logs_a_valid_event(self) -> None:
        with patch("client_telemetry.log_event") as mocked_log:
            response = self.client.post(
                "/telemetry",
                json={
                    "event": "bi_query_failed",
                    "error": "request_timeout",
                    "fields": {"query_hash": "safe-hash"},
                    "at": datetime.now(timezone.utc).isoformat(),
                },
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"accepted": True})
        mocked_log.assert_called_once()

    def test_route_is_mounted_at_the_frontend_contract_path(self) -> None:
        telemetry_paths = [route.path for route in ya_router.routes if "telemetry" in route.path]

        self.assertEqual(telemetry_paths, ["/ai/telemetry"])

    def test_endpoint_rejects_empty_payload(self) -> None:
        response = self.client.post("/telemetry", json={})

        self.assertEqual(response.status_code, 422)

    def test_endpoint_rejects_oversized_and_nested_input(self) -> None:
        oversized = self.client.post(
            "/telemetry",
            json={
                "event": "x" * 121,
                "error": "request_timeout",
                "fields": {},
                "at": datetime.now(timezone.utc).isoformat(),
            },
        )
        nested = self.client.post(
            "/telemetry",
            json={
                "event": "bi_query_failed",
                "error": "request_timeout",
                "fields": {"unexpected": {"nested": "value"}},
                "at": datetime.now(timezone.utc).isoformat(),
            },
        )
        unknown_field = self.client.post(
            "/telemetry",
            json={
                "event": "bi_query_failed",
                "error": "request_timeout",
                "fields": {},
                "at": datetime.now(timezone.utc).isoformat(),
                "unbounded_payload": "x",
            },
        )

        self.assertEqual(oversized.status_code, 422)
        self.assertEqual(nested.status_code, 422)
        self.assertEqual(unknown_field.status_code, 422)

    def test_endpoint_accepts_unicode_without_exposing_it_in_response(self) -> None:
        with patch("client_telemetry.log_event"):
            response = self.client.post(
                "/telemetry",
                json={
                    "event": "falha_telemetria_ç_🚜",
                    "error": "conexão interrompida",
                    "fields": {"origem": "São Paulo"},
                    "at": datetime.now(timezone.utc).isoformat(),
                },
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {"accepted": True})


if __name__ == "__main__":
    unittest.main()
