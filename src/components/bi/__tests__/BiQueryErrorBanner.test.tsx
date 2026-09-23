import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { BiQueryErrorBanner } from "@/components/bi/BiQueryErrorBanner";

function FailingLegacyBiQuery({ queryFn }: { queryFn: () => Promise<never> }) {
  useQuery({ queryKey: ["bi-operacional-rpc"], queryFn, retry: false });
  return null;
}

describe("BiQueryErrorBanner", () => {
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
