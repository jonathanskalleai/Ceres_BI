import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EquipeDesempenhoTable } from "../EquipeDesempenhoTable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockData: EquipeDesempenhoData = {
  team: [
    {
      competencia: "2026-07-01",
      oportunidade: 100000,
      cotacao: 50000,
      proposta: 30000,
      total: 180000,
      crescimento_oportunidade: 5.2,
      meta: 200000,
      total_venda: 190000,
      desempenho_meta: 95.0,
      negocios: 10,
      oportunidades_abertas: 4,
      quantidade_vendas: 8,
      ticket_medio: 23750,
      clientes: 15,
      taxa_conversao_negocios: 80.0,
      prospeccao_maquina: 20,
      taxa_conversao_maquina: 40.0,
    },
    {
      competencia: "2026-08-01",
      oportunidade: 120000,
      cotacao: 60000,
      proposta: 40000,
      total: 220000,
      crescimento_oportunidade: 22.2,
      meta: 250000,
      total_venda: 240000,
      desempenho_meta: 96.0,
      negocios: 12,
      oportunidades_abertas: 5,
      quantidade_vendas: 9,
      ticket_medio: 26666,
      clientes: 18,
      taxa_conversao_negocios: 75.0,
      prospeccao_maquina: 25,
      taxa_conversao_maquina: 36.0,
    },
  ],
  rows: [
    {
      competencia: "2026-08-01",
      consultor: "ANA PAULA",
      oportunidade: 60000,
      cotacao: 30000,
      proposta: 20000,
      total: 110000,
      crescimento_oportunidade: 10.0,
      meta: 120000,
      total_venda: 115000,
      desempenho_meta: 95.8,
      negocios: 6,
      oportunidades_abertas: 2,
      quantidade_vendas: 5,
      ticket_medio: 23000,
      clientes: 9,
      taxa_conversao_negocios: 83.3,
      prospeccao_maquina: 12,
      taxa_conversao_maquina: 41.7,
    },
    {
      competencia: "2026-08-01",
      consultor: "BRUNO SILVA",
      oportunidade: 60000,
      cotacao: 30000,
      proposta: 20000,
      total: 110000,
      crescimento_oportunidade: 15.0,
      meta: 130000,
      total_venda: 125000,
      desempenho_meta: 96.2,
      negocios: 6,
      oportunidades_abertas: 3,
      quantidade_vendas: 4,
      ticket_medio: 31250,
      clientes: 9,
      taxa_conversao_negocios: 66.7,
      prospeccao_maquina: 13,
      taxa_conversao_maquina: 30.8,
    },
  ],
};

describe("EquipeDesempenhoTable", () => {
  it("renderiza a aba Principal por padrão com os consultores no período atual e linha de Total da Equipe", () => {
    const onSelectConsultor = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <EquipeDesempenhoTable
          ano={2026}
          data={mockData}
          isAdmin={true}
          filters={{
            cidade: "",
            tipoAcao: "",
            categoria: "",
            funil: "",
            dateRange: { from: "2026-08-01", to: "2026-08-31" },
          }}
          onSelectConsultor={onSelectConsultor}
        />
      </QueryClientProvider>
    );

    // Headers
    expect(screen.getByText("Consultor")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Visão por Período")).toBeInTheDocument();

    // Total da Equipe row
    expect(screen.getByText("TOTAL DA EQUIPE")).toBeInTheDocument();

    // Consultor rows
    expect(screen.getByText("ANA PAULA")).toBeInTheDocument();
    expect(screen.getByText("BRUNO SILVA")).toBeInTheDocument();

    // Click consultor
    fireEvent.click(screen.getByText("ANA PAULA"));
    expect(onSelectConsultor).toHaveBeenCalledWith("ANA PAULA");
  });

  it("permite alternar para a aba 'Visão por Período' e expandir os meses", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EquipeDesempenhoTable
          ano={2026}
          data={mockData}
          isAdmin={true}
          filters={{
            cidade: "",
            tipoAcao: "",
            categoria: "",
            funil: "",
            dateRange: { from: "2026-08-01", to: "2026-08-31" },
          }}
        />
      </QueryClientProvider>
    );

    // Click "Visão por Período" tab
    const tabPeriodo = screen.getByRole("tab", { name: /Visão por Período/i });
    fireEvent.click(tabPeriodo);

    // Now header shows "Período"
    expect(screen.getByText("Período")).toBeInTheDocument();
    expect(screen.getByText("ago/2026")).toBeInTheDocument();
    expect(screen.getByText("jul/2026")).toBeInTheDocument();

    // Click to expand ago/2026
    const btnAgosto = screen.getByRole("button", { name: /ago\/2026/i });
    fireEvent.click(btnAgosto);

    // Consultores under the month should appear
    expect(screen.getByText("ANA PAULA")).toBeInTheDocument();
  });

  it("ordena os consultores na tabela priorizando a quantidade de vendas", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EquipeDesempenhoTable
          ano={2026}
          data={mockData}
          isAdmin={true}
          filters={{
            cidade: "",
            tipoAcao: "",
            categoria: "",
            funil: "",
            dateRange: { from: "2026-08-01", to: "2026-08-31" },
          }}
        />
      </QueryClientProvider>
    );

    // ANA PAULA tem 5 vendas (115.000) e BRUNO SILVA tem 4 vendas (125.000).
    // ANA PAULA deve ser ordenada primeiro por ter maior quantidade de vendas.
    const rows = screen.getAllByRole("row");
    const consultorTexts = rows
      .map((r) => r.textContent ?? "")
      .filter((t) => t.includes("ANA PAULA") || t.includes("BRUNO SILVA"));

    expect(consultorTexts[0]).toContain("ANA PAULA");
    expect(consultorTexts[1]).toContain("BRUNO SILVA");
  });
});
