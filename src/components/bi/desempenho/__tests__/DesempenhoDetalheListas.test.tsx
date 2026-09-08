import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DesempenhoDetalheListas } from "../DesempenhoDetalheListas";
import * as pedidosHook from "@/hooks/bi/usePedidosGanhosRpc";
import * as perdidosHook from "@/hooks/bi/useNegociosPerdidosRpc";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DesempenhoDetalheListas", () => {
  it("renders both tabs with accurate totals and switches between Pedidos Ganhos and Negócios Perdidos", () => {
    vi.spyOn(pedidosHook, "usePedidosGanhosRpc").mockReturnValue({
      data: {
        rows: [
          {
            pedidoCodigo: "PED-001",
            negocioNumero: "NEG-100",
            cliente: "FAZENDA MODELO",
            cidade: "LINHARES",
            consultor: "CAROLINE CALIMAN",
            produto: "TRATOR 5075E",
            observacaoNegocio: "Venda concluída",
            dataAprovacao: "2026-09-05T10:00:00Z",
            valorPedido: 350000,
          },
        ],
        total: 1,
      },
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(perdidosHook, "useNegociosPerdidosRpc").mockReturnValue({
      data: {
        rows: [
          {
            negocioNumero: "NEG-200",
            cliente: "AGRO SOUSA",
            cidade: "COLATINA",
            consultor: "GABRIEL NOGUEIRA",
            produto: "COLHEITADEIRA S700",
            observacaoNegocio: "Preço acima da concorrência",
            dataFechamento: "2026-09-06T14:00:00Z",
            valorPerdido: 1200000,
          },
        ],
        total: 5,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(
      <DesempenhoDetalheListas
        from="2026-09-01"
        to="2026-09-30"
        vendedor=""
        cidade=""
        defaultTab="ganhos"
      />
    );

    // Section title & eyebrow
    expect(screen.getByText("DRILL-DOWN ANALÍTICO")).toBeInTheDocument();
    expect(screen.getByText("Detalhamento de Pedidos e Negócios")).toBeInTheDocument();

    // Tab buttons & badges
    expect(screen.getByText("Pedidos Ganhos")).toBeInTheDocument();
    expect(screen.getByText("Negócios Perdidos")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    // Pedidos Ganhos content visible by default
    expect(screen.getByText("PED-001")).toBeInTheDocument();
    expect(screen.getByText("FAZENDA MODELO")).toBeInTheDocument();
    expect(screen.getByText("TRATOR 5075E")).toBeInTheDocument();

    // Switch to Negócios Perdidos
    fireEvent.click(screen.getByText("Negócios Perdidos"));

    expect(screen.getByText("NEG-200")).toBeInTheDocument();
    expect(screen.getByText("AGRO SOUSA")).toBeInTheDocument();
    expect(screen.getByText("COLHEITADEIRA S700")).toBeInTheDocument();
  });
});
