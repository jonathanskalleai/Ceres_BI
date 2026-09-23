import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { ganhosHook, perdidosHook } = vi.hoisted(() => ({
  ganhosHook: vi.fn(),
  perdidosHook: vi.fn(),
}));

vi.mock("@/hooks/bi/usePedidosGanhosRpc", () => ({ usePedidosGanhosRpc: ganhosHook }));
vi.mock("@/hooks/bi/useNegociosPerdidosRpc", () => ({ useNegociosPerdidosRpc: perdidosHook }));
vi.mock("@/components/bi/AcoesPedidosTable", () => ({
  AcoesPedidosTable: () => <div data-testid="ganhos-table" />,
}));
vi.mock("@/components/bi/AcoesNegociosPerdidosTable", () => ({
  AcoesNegociosPerdidosTable: () => <div data-testid="perdidos-table" />,
}));

import { DesempenhoDetalheListas } from "@/components/bi/desempenho/DesempenhoDetalheListas";

beforeEach(() => {
  ganhosHook.mockReturnValue({ data: { total: 0, rows: [] }, isLoading: false, error: null });
  perdidosHook.mockReturnValue({ data: { total: 0, rows: [] }, isLoading: false, error: null });
});

describe("DesempenhoDetalheListas", () => {
  it("only enables the query for the active tab", () => {
    render(<DesempenhoDetalheListas />);
    expect(ganhosHook.mock.calls[ganhosHook.mock.calls.length - 1]?.[0].enabled).toBe(true);
    expect(perdidosHook.mock.calls[perdidosHook.mock.calls.length - 1]?.[0].enabled).toBe(false);

    fireEvent.click(screen.getByRole("tab", { name: /Negócios Perdidos/ }));
    expect(ganhosHook.mock.calls[ganhosHook.mock.calls.length - 1]?.[0].enabled).toBe(false);
    expect(perdidosHook.mock.calls[perdidosHook.mock.calls.length - 1]?.[0].enabled).toBe(true);
  });
});
