import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DesempenhoTableCard } from "../DesempenhoTableCard";
import { DesempenhoDonutCard } from "../DesempenhoDonutCard";

describe("DesempenhoTableCard", () => {
  it("renders eyebrow, title and tabular data accurately", () => {
    const rows = [
      { name: "CAROLINE CALIMAN", qtd: 25, percent: 34.2, ticketMedio: 111900, valor: 2797620 },
      { name: "WERICK SILVA", qtd: 12, percent: 16.4, ticketMedio: 116030, valor: 1392350 },
    ];

    render(
      <DesempenhoTableCard
        eyebrow="POR VENDEDOR"
        title="Quem vende mais"
        firstColumnHeader="VENDEDOR"
        rows={rows}
      />
    );

    expect(screen.getByText("POR VENDEDOR")).toBeInTheDocument();
    expect(screen.getByText("Quem vende mais")).toBeInTheDocument();
    expect(screen.getByText("CAROLINE CALIMAN")).toBeInTheDocument();
    expect(screen.getByText("WERICK SILVA")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("34.2%")).toBeInTheDocument();
  });

  it("renders empty state message when no data is provided", () => {
    render(
      <DesempenhoTableCard
        eyebrow="POR PRODUTO"
        title="Produtos mais vendidos"
        rows={[]}
        emptyMessage="Sem produtos registrados."
      />
    );

    expect(screen.getByText("Sem produtos registrados.")).toBeInTheDocument();
  });
});

describe("DesempenhoDonutCard", () => {
  it("renders donut items and legend values", () => {
    const items = [
      { name: "Prospecção", qtd: 52, valor: 5775960, percent: 71.2 },
      { name: "Indicação", qtd: 16, valor: 1829840, percent: 21.9 },
    ];

    render(
      <DesempenhoDonutCard
        eyebrow="ORIGEM DO LEAD"
        title="Ativações por origem"
        items={items}
      />
    );

    expect(screen.getByText("ORIGEM DO LEAD")).toBeInTheDocument();
    expect(screen.getByText("Ativações por origem")).toBeInTheDocument();
    expect(screen.getByText("Prospecção")).toBeInTheDocument();
    expect(screen.getByText("Indicação")).toBeInTheDocument();
  });
});
