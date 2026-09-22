import { describe, expect, it } from "vitest";
import { resolveSupabaseUrl } from "../url";

describe("resolveSupabaseUrl", () => {
  it("uses the BI origin in production", () => {
    expect(resolveSupabaseUrl({
      configuredUrl: "https://ceressupabasebi.vouxconsultoria.com.br",
      isProduction: true,
      origin: "https://ceresbi.vouxconsultoria.com.br/",
    })).toBe("https://ceresbi.vouxconsultoria.com.br/supabase");
  });

  it("keeps the configured endpoint outside production", () => {
    expect(resolveSupabaseUrl({
      configuredUrl: "http://127.0.0.1:54321",
      isProduction: false,
      origin: "http://localhost:5173",
    })).toBe("http://127.0.0.1:54321");
  });
});
