import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AcoesFunilConversao } from "../AcoesFunilConversao";
import type { AcoesFunil } from "@/types/biRpc";

const funilCheio: AcoesFunil = {
  visitas: 3679,
  oportunidades: 662,
  ganhos: 48,
  visitasPorOportunidade: 5.56,
  oportPorFechamento: 13.77,
};

describe("AcoesFunilConversao", () => {
  it("should render the three stages with pt-BR formatted counts", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);
    expect(screen.getByText("3.679")).toBeInTheDocument();
    expect(screen.getByText("662")).toBeInTheDocument();
    expect(screen.getByText("48")).toBeInTheDocument();
  });

  it("should render a dash — never 0, Infinity or NaN — when there is no denominator", () => {
    render(
      <AcoesFunilConversao
        funil={{ visitas: 120, oportunidades: 0, ganhos: 0, visitasPorOportunidade: null, oportPorFechamento: null }}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText(/Infinity|NaN/)).toBeNull();
  });

  it("should always carry the window caveat — the number is only comparable between consultores", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);
    expect(screen.getByText(/artefato de janela/i)).toBeInTheDocument();
    expect(screen.getByText(/entre consultores/i)).toBeInTheDocument();
  });

  it("should show an explicit error state instead of a 0 → 0 → 0 funnel when the query fails", () => {
    render(
      <AcoesFunilConversao
        funil={{ visitas: 0, oportunidades: 0, ganhos: 0, visitasPorOportunidade: null, oportPorFechamento: null }}
        error={new Error("PGRST202: function not found")}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/PGRST202/)).toBeInTheDocument();
    // o funil NAO pode ser renderizado com zeros quando a consulta falhou
    expect(screen.queryByText("Visitas")).toBeNull();
  });
});
