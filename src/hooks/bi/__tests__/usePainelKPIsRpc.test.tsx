import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePainelKPIsRpc } from "@/hooks/bi/usePainelKPIsRpc";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useAcoesFunilRpc } from "@/hooks/bi/useAcoesFunilRpc";

vi.mock("@/hooks/bi/useNegociosBIRpc", () => ({
  useNegociosBIRpc: vi.fn(() => ({ data: undefined, isLoading: false })),
}));
vi.mock("@/hooks/bi/useAcoesBIRpc", () => ({
  useAcoesBIRpc: vi.fn(() => ({ data: undefined, isLoading: false })),
}));
vi.mock("@/hooks/bi/useAcoesFunilRpc", () => ({
  useAcoesFunilRpc: vi.fn(() => ({ data: undefined, isLoading: false })),
}));
vi.mock("@/hooks/bi/useOperacionalBIRpc", () => ({
  useOperacionalBIRpc: vi.fn(() => ({
    data: { kpis: { eventosAgenda: 0 } },
    isLoading: false,
  })),
}));

describe("usePainelKPIsRpc", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("starts current queries immediately and defers only previous-period queries", () => {
    vi.useFakeTimers();
    renderHook(() => usePainelKPIsRpc(
      { from: new Date(2026, 0, 1), to: new Date(2026, 8, 20) },
      "__all__",
      "__all__",
    ));

    expect(vi.mocked(useAcoesBIRpc).mock.calls[0][0].enabled).toBe(true);
    expect(vi.mocked(useAcoesBIRpc).mock.calls[1][0].enabled).toBe(false);
    expect(vi.mocked(useAcoesFunilRpc).mock.calls[0][0].enabled).toBe(true);
    expect(vi.mocked(useAcoesFunilRpc).mock.calls[1][0].enabled).toBe(false);

    act(() => vi.advanceTimersByTime(600));

    const acoesCalls = vi.mocked(useAcoesBIRpc).mock.calls;
    const funilCalls = vi.mocked(useAcoesFunilRpc).mock.calls;
    expect(acoesCalls.at(-2)?.[0].enabled).toBe(true);
    expect(acoesCalls.at(-1)?.[0].enabled).toBe(true);
    expect(funilCalls.at(-2)?.[0].enabled).toBe(true);
    expect(funilCalls.at(-1)?.[0].enabled).toBe(true);
  });
});
