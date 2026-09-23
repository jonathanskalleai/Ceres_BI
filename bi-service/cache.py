"""Bounded process-local cache and request coalescing for BI reads.

This is intentionally an L1 cache. It makes repeated dashboard requests cheap
and prevents a burst of identical requests from opening one database query per
browser component. It is not a replacement for read models or a distributed
cache; the short TTL keeps freshness bounded until ETL-driven invalidation is
available.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CacheResult:
    value: Any
    hit: bool


@dataclass
class _Entry:
    value: Any
    expires_at: float


class QueryCache:
    """A small async-safe TTL cache with single-flight computation."""

    def __init__(self, max_items: int, ttl_seconds: float) -> None:
        self.max_items = max(1, max_items)
        self.ttl_seconds = max(0.0, ttl_seconds)
        self._entries: OrderedDict[str, _Entry] = OrderedDict()
        self._inflight: dict[str, asyncio.Future[Any]] = {}
        self._lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return self.ttl_seconds > 0

    async def get_or_compute(
        self,
        key: str,
        compute: Callable[[], Awaitable[Any]],
    ) -> CacheResult:
        """Return a cached result or let one caller compute it for all waiters."""

        if not self.enabled:
            return CacheResult(await compute(), hit=False)

        owner = False
        async with self._lock:
            now = time.monotonic()
            entry = self._entries.get(key)
            if entry and entry.expires_at > now:
                self._entries.move_to_end(key)
                return CacheResult(entry.value, hit=True)
            if entry:
                self._entries.pop(key, None)

            future = self._inflight.get(key)
            if future is None:
                future = asyncio.get_running_loop().create_future()
                self._inflight[key] = future
                owner = True

        if not owner:
            return CacheResult(await future, hit=True)

        try:
            value = await compute()
        except Exception as exc:
            async with self._lock:
                pending = self._inflight.pop(key, None)
                if pending and not pending.done():
                    pending.set_exception(exc)
                    pending.exception()
            raise

        async with self._lock:
            self._entries[key] = _Entry(value=value, expires_at=time.monotonic() + self.ttl_seconds)
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_items:
                self._entries.popitem(last=False)
            pending = self._inflight.pop(key, None)
            if pending and not pending.done():
                pending.set_result(value)
        return CacheResult(value, hit=False)

    async def clear(self) -> None:
        """Drop completed entries; in-flight reads are allowed to finish."""

        async with self._lock:
            self._entries.clear()


def make_cache_key(scope: str, user_id: str, rpc_name: str, args: tuple[Any, ...]) -> str:
    """Create a non-reversible key without putting filter values in logs."""

    payload = json.dumps(
        {"scope": scope, "user": user_id, "rpc": rpc_name, "args": args},
        default=str,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
