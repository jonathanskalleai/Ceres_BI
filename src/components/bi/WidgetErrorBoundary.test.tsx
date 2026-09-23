import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { WidgetErrorBoundary } from "@/components/bi/WidgetErrorBoundary";

vi.mock("@/lib/logger", () => ({ reportClientError: vi.fn() }));

function BrokenWidget(): ReactElement {
  throw new Error("render shape invalid");
}

describe("WidgetErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("isolates a render failure and offers a local retry", () => {
    render(
      <WidgetErrorBoundary widgetName="grafico">
        <BrokenWidget />
      </WidgetErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/grafico/);
    expect(screen.getByRole("button", { name: /Tentar novamente/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
