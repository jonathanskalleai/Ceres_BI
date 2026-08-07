import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BiGestaoErro } from "../BiGestaoErro";
import { isBiDebugEnabled } from "@/components/bi/debug/isBiDebugEnabled";

vi.mock("@/components/bi/debug/isBiDebugEnabled", () => ({
  isBiDebugEnabled: vi.fn(),
}));

const mockDebug = vi.mocked(isBiDebugEnabled);
const erro = new Error("[acoesGestaoService.fetchAcoesMapaOportunidades] PGRST202: rpc not found");

describe("BiGestaoErro", () => {
  beforeEach(() => mockDebug.mockReset());

  it("should always tell the user the query FAILED — never let it read as 'zero no periodo'", () => {
    mockDebug.mockReturnValue(false);
    render(<BiGestaoErro error={erro} contexto="os pinos do mapa" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Nao foi possivel carregar os pinos do mapa/)).toBeInTheDocument();
    expect(screen.getByText(/a consulta falhou/)).toBeInTheDocument();
  });

  it("should NOT leak service/function/db names to the end user (security #6)", () => {
    mockDebug.mockReturnValue(false);
    render(<BiGestaoErro error={erro} contexto="os pinos do mapa" />);
    expect(screen.queryByText(/acoesGestaoService/)).toBeNull();
    expect(screen.queryByText(/PGRST202/)).toBeNull();
  });

  it("should show the technical detail behind the BI DEBUG gate", () => {
    mockDebug.mockReturnValue(true);
    render(<BiGestaoErro error={erro} contexto="os pinos do mapa" />);
    expect(screen.getByText(/PGRST202/)).toBeInTheDocument();
  });
});
