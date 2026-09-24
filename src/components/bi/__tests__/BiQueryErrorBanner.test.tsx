import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { BiQueryErrorBanner } from "@/components/bi/BiQueryErrorBanner";
import { biQuality } from "@/lib/bi/biQualityStore";

function FailingLegacyBiQuery({ queryFn }: { queryFn: () => Promise<never> }) {
  useQuery({ queryKey: ["bi-operacional-rpc"], queryFn, retry: false });
  return null;
}

describe("BiQueryErrorBanner", () => {
  it("shows partial responses and never describes them as zero", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <BiQueryErrorBanner />
      </QueryClientProvider>,
    );

    act(() => biQuality.record({
      source: "rpc_pedidos_bi",
      status: "partial",
      issues: [{ code: "FIELD_MISSING", message: "campo ausente" }],
      occurredAt: new Date().toISOString(),
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent("retornaram apenas parte dos dados");
    expect(screen.getByRole("alert")).toHaveTextContent("Os campos vazios não significam zero");
    act(() => biQuality.clearAll());
  });

  it("shows and retries active BI failures even when the legacy key lacks the rpc prefix", async () => {
    const queryFn = vi.fn(async () => { throw new Error("timeout"); });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FailingLegacyBiQuery queryFn={queryFn} />
        <BiQueryErrorBanner />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Dados incompletos");
    expect(screen.getByRole("alert")).toHaveTextContent("bi operacional rpc");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });
});
