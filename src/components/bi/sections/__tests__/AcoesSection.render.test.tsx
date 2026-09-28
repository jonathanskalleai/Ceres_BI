import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NegociosFilterProvider } from "@/contexts/NegociosFilterContext";
import AcoesSection from "../AcoesSection";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
});

afterAll(() => vi.unstubAllGlobals());

describe("AcoesSection", () => {
  it("renders the contact chart without a missing component reference", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <NegociosFilterProvider>
          <AcoesSection active={false} />
        </NegociosFilterProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("figure", { name: "Tipo de Contato" })).toBeInTheDocument();
  });
});
