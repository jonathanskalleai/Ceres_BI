import { describe, expect, it, vi } from "vitest";

const { useQueryMock, fetchMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(() => ({ data: undefined })),
  fetchMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
  keepPreviousData: Symbol("keepPreviousData"),
}));
vi.mock("@/services/bi/acoesRuntimeService", () => ({ fetchAcoesRuntime: fetchMock }));
vi.mock("@/lib/bi/runtime", () => ({ isBiAbortError: vi.fn(() => false) }));

import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";

describe("useAcoesBIRpc runtime contract handling", () => {
  it("throws only contract errors so WidgetErrorBoundary can isolate invalid payloads", () => {
    useAcoesBIRpc({ enabled: true });
    const calls = useQueryMock.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const options = calls[0]?.[0] as {
      throwOnError: (error: Error) => boolean;
      queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
    };
    const contractError = new Error("payload invalido");
    contractError.name = "BiContractError";
    expect(options.throwOnError(contractError)).toBe(true);
    expect(options.throwOnError(new Error("timeout"))).toBe(false);
  });

  it("forwards the query cancellation signal to the runtime service", async () => {
    fetchMock.mockResolvedValue({});
    useAcoesBIRpc({ enabled: true });
    const calls = useQueryMock.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const options = calls[calls.length - 1]?.[0] as {
      queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
    };
    const signal = new AbortController().signal;
    await options.queryFn({ signal });
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ signal }));
  });
});
