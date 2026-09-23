from __future__ import annotations

import asyncio

from cache import QueryCache, make_cache_key


def test_cache_coalesces_concurrent_computation_and_reuses_result() -> None:
    async def scenario() -> None:
        cache = QueryCache(max_items=4, ttl_seconds=30)
        calls = 0

        async def compute() -> dict[str, int]:
            nonlocal calls
            calls += 1
            await asyncio.sleep(0.01)
            return {"total": 7}

        key = make_cache_key("test", "user-1", "rpc_example", ("2026-01-01",))
        first, second = await asyncio.gather(
            cache.get_or_compute(key, compute),
            cache.get_or_compute(key, compute),
        )
        third = await cache.get_or_compute(key, compute)

        assert calls == 1
        assert first.value == second.value == third.value == {"total": 7}
        assert first.hit is False
        assert second.hit is True
        assert third.hit is True

    asyncio.run(scenario())


def test_cache_can_be_disabled_without_storing_results() -> None:
    async def scenario() -> None:
        cache = QueryCache(max_items=4, ttl_seconds=0)
        calls = 0

        async def compute() -> int:
            nonlocal calls
            calls += 1
            return calls

        first = await cache.get_or_compute("disabled", compute)
        second = await cache.get_or_compute("disabled", compute)

        assert (first.value, second.value) == (1, 2)
        assert first.hit is False and second.hit is False

    asyncio.run(scenario())


def test_cache_does_not_retain_oversized_payloads() -> None:
    async def scenario() -> None:
        cache = QueryCache(max_items=4, ttl_seconds=30, max_entry_bytes=8)
        calls = 0

        async def compute() -> dict[str, str]:
            nonlocal calls
            calls += 1
            return {"payload": "too large"}

        first = await cache.get_or_compute("large", compute)
        second = await cache.get_or_compute("large", compute)

        assert first.value == second.value
        assert first.hit is False and second.hit is False
        assert calls == 2

    asyncio.run(scenario())
