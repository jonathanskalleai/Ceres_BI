import { describe, expect, it } from "vitest";
import { formatChatDateTime, formatChatText, formatEvidenceValue } from "../yaChatFormatters";

describe("ya chat formatters", () => {
  it("formats model currency, dates and percentages for Brazil", () => {
    expect(formatChatText("Faturamento: $ 1,234.56 em 2026-09-08; conversão 12.5%."))
      .toBe("Faturamento: R$ 1.234,56 em 08/09/2026; conversão 12,5%.");
  });

  it("normalizes an unambiguous US date without changing an ambiguous date", () => {
    expect(formatChatText("Até 08/31/2026 e desde 09/08/2026.")).toBe("Até 31/08/2026 e desde 09/08/2026.");
  });

  it("formats evidence timestamps in the Sao Paulo timezone", () => {
    expect(formatChatDateTime("2026-09-08T15:30:00Z")).toBe("08/09/2026, 12:30");
    expect(formatChatDateTime("2026-09-08")).toBe("08/09/2026");
  });

  it("uses the metric unit when formatting evidence values", () => {
    expect(formatEvidenceValue(1500.5, "BRL")).toBe("R$ 1.500,50");
    expect(formatEvidenceValue(12.5, "%")).toBe("12,5%");
    expect(formatEvidenceValue(1500, "count")).toBe("1.500");
  });
});
