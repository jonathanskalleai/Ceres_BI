"""OpenRouter transport isolated from conversational orchestration."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, AsyncIterator, Optional

import httpx
from fastapi import HTTPException

from ai_logger import log_event, log_exception


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
YA_MODEL = os.getenv("YA_CHAT_MODEL", os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct"))


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}


def parse_json_object(value: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError as error:
        log_event(logging.WARNING, "ai_provider_invalid_json", error_type=type(error).__name__)
        start, end = value.find("{"), value.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(value[start : end + 1])
                return parsed if isinstance(parsed, dict) else None
            except json.JSONDecodeError as nested_error:
                log_event(logging.WARNING, "ai_provider_json_recovery_failed", error_type=type(nested_error).__name__)
        return None


async def complete(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
    json_mode: bool = False,
    session_id: Optional[str] = None,
) -> str:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="OpenRouter não configurado")
    payload: dict[str, Any] = {
        "model": YA_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    if session_id:
        payload["session_id"] = session_id[:256]
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(OPENROUTER_URL, json=payload, headers=_headers())
            response.raise_for_status()
            body = response.json()
            return str(body["choices"][0]["message"]["content"])
    except (httpx.HTTPError, KeyError, IndexError, TypeError) as error:
        log_exception("ai_provider_completion_failed", error, model=YA_MODEL)
        raise HTTPException(status_code=502, detail="A AI não conseguiu concluir a análise agora") from error


async def stream(
    messages: list[dict[str, str]],
    *,
    session_id: str,
    temperature: float = 0.2,
    max_tokens: int = 700,
) -> AsyncIterator[str]:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="OpenRouter não configurado")
    payload = {
        "model": YA_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
        "session_id": session_id[:256],
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, read=90.0)) as client:
            async with client.stream("POST", OPENROUTER_URL, json=payload, headers=_headers()) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    body = line[5:].strip()
                    if not body or body == "[DONE]":
                        continue
                    try:
                        event = json.loads(body)
                        delta = event.get("choices", [{}])[0].get("delta", {}).get("content")
                    except (json.JSONDecodeError, AttributeError, IndexError, TypeError) as error:
                        log_event(logging.WARNING, "ai_provider_stream_chunk_skipped", error_type=type(error).__name__)
                        continue
                    if isinstance(delta, str) and delta:
                        yield delta
    except httpx.HTTPError as error:
        log_exception("ai_provider_stream_failed", error, model=YA_MODEL)
        raise HTTPException(status_code=502, detail="A AI não conseguiu concluir a análise agora") from error
