import { describe, expect, it } from "vitest";
import {
  biQueryRetryDelay,
  isBiTransientError,
  shouldRetryAcoesQuery,
  shouldRetryBiQuery,
} from "@/lib/bi/queryRetry";

describe("BI query retry policy", () => {
  it("retries a failed transport twice and spaces the attempts", () => {
    const error = new TypeError("Failed to fetch");

    expect(isBiTransientError(error)).toBe(true);
    expect(shouldRetryBiQuery(0, error)).toBe(true);
    expect(shouldRetryBiQuery(1, error)).toBe(true);
    expect(shouldRetryBiQuery(2, error)).toBe(false);
    expect(biQueryRetryDelay(0, error)).toBe(750);
    expect(biQueryRetryDelay(1, error)).toBe(1_500);
  });

  it("does not retry aborts or malformed BI contracts", () => {
    const aborted = new Error("The operation was aborted");
    const contract = new Error("payload invalido");
    contract.name = "BiContractError";

    expect(isBiTransientError(aborted)).toBe(false);
    expect(shouldRetryAcoesQuery(0, aborted)).toBe(false);
    expect(shouldRetryAcoesQuery(0, contract)).toBe(false);
  });

  it("keeps one retry for a non-transport server error in the Ações RPCs", () => {
    const error = new Error("db statement failed");

    expect(shouldRetryAcoesQuery(0, error)).toBe(true);
    expect(shouldRetryAcoesQuery(1, error)).toBe(false);
  });
});
