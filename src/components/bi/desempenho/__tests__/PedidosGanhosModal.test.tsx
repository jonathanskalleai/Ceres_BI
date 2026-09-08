import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PedidosGanhosModal } from "../PedidosGanhosModal";
import * as pedidosHook from "@/hooks/bi/usePedidosGanhosRpc";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("PedidosGanhosModal", () => {
  it("renders modal with list of approved orders and allows search filtering", () => {
    vi.spyOn(pedidosHook, "usePedidosGanhosRpc").mockReturnValue({
      data: {
        rows: [
          {
            pedidoCodigo: "PED-101",
            negocioNumero: "NEG-501",
            cliente: "AGROPECUARIA SANTA FE",
            cidade: "SAO MATEUS",
            consultor: "CAROLINE CALIMAN",
            produto: "PULVERIZADOR M4040",
            observacaoNegocio: "Entrega programada",
            dataAprovacao: "2026-09-02T15:30:00Z",
            valorPedido: 850000,
          },
          {
            pedidoCodigo: "PED-102",
            negocioNumero: "NEG-502",
            cliente: "FAZENDA BOA VISTA",
            cidade: "LINHARES",
            consultor: "GABRIEL NOGUEIRA",
            produto: "TRATOR 6115J",
            observacaoNegocio: "Financiamento bancário",
            dataAprovacao: "2026-09-04T11:00:00Z",
            valorPedido: 420000,
          },
        ],
        total: 2,
      },
      isLoading: false,
      error: null,
    } as any);

    renderWithClient(
      <PedidosGanhosModal
        open={true}
        onOpenChange={vi.fn()}
        from="2026-09-01"
        to="2026-09-30"
        periodoLabel="Setembro 2026"
      />
    );

    // Modal title & subtitle
    expect(screen.getByText("Detalhamento dos Pedidos Ganhos")).toBeInTheDocument();
    expect(screen.getByText("Setembro 2026")).toBeInTheDocument();

    // Table rows
    expect(screen.getByText("#PED-101")).toBeInTheDocument();
    expect(screen.getByText("AGROPECUARIA SANTA FE")).toBeInTheDocument();
    expect(screen.getByText("PULVERIZADOR M4040")).toBeInTheDocument();

    expect(screen.getByText("#PED-102")).toBeInTheDocument();
    expect(screen.getByText("FAZENDA BOA VISTA")).toBeInTheDocument();
    expect(screen.getByText("TRATOR 6115J")).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByPlaceholderText("Buscar por cliente, pedido, consultor, produto ou cidade...");
    fireEvent.change(searchInput, { target: { value: "SANTA FE" } });

    expect(screen.getByText("#PED-101")).toBeInTheDocument();
    expect(screen.queryByText("#PED-102")).not.toBeInTheDocument();
  });
});
