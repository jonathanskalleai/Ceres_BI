import { afterEach, describe, expect, it, vi } from "vitest";
import { logClientError, logClientWarning } from "./logger";

describe("client error logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts credentials and contact data from error text", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logClientError("request_failed", new Error("Authorization: Bearer synthetic-token email=ana@example.com (11) 99999-0000"), {
      request_id: "safe-id",
      token: "must-not-be-logged",
    });

    const rendered = JSON.stringify(error.mock.calls[0]);
    expect(rendered).not.toContain("synthetic-token");
    expect(rendered).not.toContain("ana@example.com");
    expect(rendered).not.toContain("99999-0000");
    expect(rendered).not.toContain("must-not-be-logged");
    expect(rendered).toContain("[redacted]");
  });

  it("applies the same redaction to warnings", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    logClientWarning("request_warning", new Error("senha: synthetic-password"));

    const rendered = JSON.stringify(warning.mock.calls[0]);
    expect(rendered).not.toContain("synthetic-password");
    expect(rendered).toContain("[redacted]");
  });
});
