import { afterEach, describe, expect, it, vi } from "vitest";
import { isTransientNetworkError, resilientFetch, retryTransient } from "./resilientFetch";

describe("resilient network requests", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retries a failed safe read and then returns the response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const response = await resilientFetch("/api/test", undefined, { retryDelayMs: 0 });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry mutating requests by default", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(resilientFetch("/api/test", { method: "POST" }, { retryDelayMs: 0 }))
      .rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient async work without treating ordinary errors as transport failures", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new TypeError("NetworkError when attempting to fetch resource"))
      .mockResolvedValueOnce("ok");

    await expect(retryTransient(operation, { retryDelayMs: 0 })).resolves.toBe("ok");
    expect(isTransientNetworkError(new Error("invalid BI contract"))).toBe(false);
    expect(isTransientNetworkError(Object.assign(new Error("Tempo esgotado ao carregar os dados."), { name: "TimeoutError" }))).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
