import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDelayedReady } from "@/hooks/useDelayedReady";

describe("useDelayedReady", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defers secondary work and resets when filters change", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ resetKey }) => useDelayedReady(true, 600, resetKey),
      { initialProps: { resetKey: "first" } },
    );

    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(600));
    expect(result.current).toBe(true);

    rerender({ resetKey: "second" });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(600));
    expect(result.current).toBe(true);
  });
});
