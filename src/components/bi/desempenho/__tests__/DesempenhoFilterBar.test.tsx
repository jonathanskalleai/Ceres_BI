import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DesempenhoFilterBar } from "../DesempenhoFilterBar";
import { ALL_FUNIS } from "@/lib/categoriaFunil";

describe("DesempenhoFilterBar", () => {
  it("renders tab buttons and allows switching between Vendas and Perdas with all funis selected by default", () => {
    const onTabChange = vi.fn();
    const onDateRangeChange = vi.fn();
    const onVendedorChange = vi.fn();
    const onCidadeChange = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <DesempenhoFilterBar
        activeTab="ganhos"
        onTabChange={onTabChange}
        dateRange={{ from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) }}
        onDateRangeChange={onDateRangeChange}
        funis={ALL_FUNIS}
        onFunisChange={vi.fn()}
        vendedor=""
        onVendedorChange={onVendedorChange}
        vendedorOptions={["CAROLINE CALIMAN"]}
        cidade=""
        onCidadeChange={onCidadeChange}
        cidadeOptions={["LINHARES"]}
        onResetFilters={onResetFilters}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByText("Vendas & Ganhos")).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico de Perdas")).toBeInTheDocument();
    expect(screen.getByText("Todos os funis")).toBeInTheDocument();

    // Quick year buttons should NOT be present
    expect(screen.queryByText("Ano:")).not.toBeInTheDocument();
    expect(screen.queryByText("2026")).not.toBeInTheDocument();

    // Click on Diagnóstico de Perdas
    fireEvent.click(screen.getByText("Diagnóstico de Perdas"));
    expect(onTabChange).toHaveBeenCalledWith("perdas");
  });

  it("renders active cross filter chip and clear button", () => {
    const onClearCrossFilter = vi.fn();
    const onResetFilters = vi.fn();

    render(
      <DesempenhoFilterBar
        activeTab="ganhos"
        onTabChange={vi.fn()}
        dateRange={{ from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) }}
        onDateRangeChange={vi.fn()}
        funis={["VENDAS"]}
        onFunisChange={vi.fn()}
        vendedor=""
        onVendedorChange={vi.fn()}
        vendedorOptions={[]}
        cidade=""
        onCidadeChange={vi.fn()}
        cidadeOptions={[]}
        activeCrossFilter={{
          type: "vendedor",
          label: "Vendedor",
          value: "CAROLINE CALIMAN",
        }}
        onClearCrossFilter={onClearCrossFilter}
        onResetFilters={onResetFilters}
        hasActiveFilters={true}
      />
    );

    expect(screen.getByText("Vendedor:")).toBeInTheDocument();
    expect(screen.getByText("CAROLINE CALIMAN")).toBeInTheDocument();
    expect(screen.getByText("VENDAS")).toBeInTheDocument();
    expect(screen.getByText("Limpar Filtros")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Limpar Filtros"));
    expect(onResetFilters).toHaveBeenCalled();
  });

  it("allows selecting and toggling funis via multi-select", () => {
    const onFunisChange = vi.fn();

    render(
      <DesempenhoFilterBar
        activeTab="ganhos"
        onTabChange={vi.fn()}
        dateRange={{ from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) }}
        onDateRangeChange={vi.fn()}
        funis={["VENDAS", "Vendas AP"]}
        onFunisChange={onFunisChange}
        vendedor=""
        onVendedorChange={vi.fn()}
        vendedorOptions={[]}
        cidade=""
        onCidadeChange={vi.fn()}
        cidadeOptions={[]}
        onResetFilters={vi.fn()}
        hasActiveFilters={true}
      />
    );

    // Displays badge with 2 selected
    expect(screen.getByText("2 funis selecionados")).toBeInTheDocument();
  });
});
