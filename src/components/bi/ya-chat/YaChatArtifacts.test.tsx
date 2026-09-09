import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { YaChatArtifacts } from "./YaChatArtifacts";

vi.mock("../charts/BarChart", () => ({ default: () => <div role="img" aria-label="mock bar chart" /> }));
vi.mock("../charts/LineChart", () => ({ default: () => <div role="img" aria-label="mock line chart" /> }));

describe("YaChatArtifacts", () => {
  it("renders table, KPI, bar, line and human choices without exposing sensitive columns", () => {
    const onChoice = vi.fn();
    render(<YaChatArtifacts
      onChoice={onChoice}
      choices={[{ label: "Agosto inteiro", value: "Compare com agosto inteiro" }]}
      artifacts={[
        { type: "table", title: "Tabela", columns: [{ key: "name", label: "Nome" }, { key: "email", label: "E-mail" }], rows: [{ name: "Ana", email: "hidden@example.com" }] },
        { type: "kpi_group", title: "KPIs", rows: [{ label: "Vendas", value: 3, unit: "quantidade" }] },
        { type: "bar", title: "Barras", x_key: "name", series: [{ key: "value", label: "Valor" }], rows: [{ name: "Ana", value: 3 }] },
        { type: "line", title: "Linha", x_key: "name", series: [{ key: "value", label: "Valor" }], rows: [{ name: "set/2026", value: 3 }] },
      ]}
    />);

    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getByText("KPIs")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "mock bar chart" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "mock line chart" })).toBeInTheDocument();
    expect(screen.queryByText("E-mail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agosto inteiro" }));
    expect(onChoice).toHaveBeenCalledWith("Compare com agosto inteiro");
  });
});
