import { describe, expect, it } from "vitest";
import {
  isBiAbortError,
  isFiniteNumber,
  isValidCoordinate,
  requireFiniteNumber,
  requireRecord,
  unwrapBiPayload,
} from "@/lib/bi/runtime";
import { BiContractError } from "@/types/biRuntime";

describe("BI runtime contract", () => {
  it("unwraps a single RPC array and a future data/meta envelope", () => {
    expect(unwrapBiPayload([{ value: 7 }])).toEqual({ value: 7 });
    expect(unwrapBiPayload({ data: { value: 8 }, meta: { version: 2 } })).toEqual({ value: 8 });
  });

  it("does not turn null or a missing object into a valid payload", () => {
    expect(() => requireRecord(null, "rpc")).toThrow(BiContractError);
    expect(() => requireRecord(undefined, "rpc")).toThrow(/objeto JSON/);
  });

  it("accepts zero but rejects NaN and Infinity", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(() => requireFiniteNumber(0, "kpi")).not.toThrow();
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(() => requireFiniteNumber(Number.NaN, "kpi")).toThrow(/numero finito/);
  });

  it("enforces geographic coordinate domains", () => {
    expect(isValidCoordinate(-27.1, -52.6)).toBe(true);
    expect(isValidCoordinate(91, -52.6)).toBe(false);
    expect(isValidCoordinate(-27.1, 181)).toBe(false);
    expect(isValidCoordinate(Number.NaN, -52.6)).toBe(false);
  });

  it("classifies AbortError and cancellation messages", () => {
    expect(isBiAbortError(new DOMException("The operation was aborted", "AbortError"))).toBe(true);
    expect(isBiAbortError(new Error("request canceled by caller"))).toBe(true);
    expect(isBiAbortError(new Error("database unavailable"))).toBe(false);
  });
});
