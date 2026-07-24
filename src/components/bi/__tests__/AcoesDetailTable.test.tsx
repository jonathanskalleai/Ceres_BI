import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AcoesDetailTable } from "../AcoesDetailTable";
import type { AcoesDetalheItem } from "@/types/biRpc";

const LONG_OBS =
  "Conversa com cliente para negociacao de vagao forrageiro, cliente com intencao de compra modelo 4m3, com sistema de balanca e descarregamento por esteira lado esquerdo, passado valor de R$175.000,00.";

function makeRows(n: number): AcoesDetalheItem[] {
  return Array.from({ length: n }, (_, i) => ({
    data: "23/07/2026",
    dataIso: `2026-07-23T10:00:${String(i % 60).padStart(2, "0")}`,
    consultor: `CONSULTOR ${i}`,
    cliente: `CLIENTE ${i}`,
    cidade: "Xavantina",
    tipoAcao: "1 - Prospeccao Maq",
    tipoContato: "Telefonema/Whatsapp",
    observacao: `${LONG_OBS} [${i}]`,
  }));
}

/** Baseline real do mes atual medido no banco vivo: rpc_acoes_detalhe → 664 linhas, total 664. */
const MES_ATUAL = 664;

describe("AcoesDetailTable", () => {
  it("should show an honest counter of the first page against the full period", () => {
    render(<AcoesDetailTable rows={makeRows(MES_ATUAL)} total={MES_ATUAL} />);
    expect(screen.getByRole("heading", { name: /Acoes do Periodo · 100 de 664/ })).toBeDefined();
  });

  it("should render only one page of rows and grow with Carregar mais", () => {
    render(<AcoesDetailTable rows={makeRows(MES_ATUAL)} total={MES_ATUAL} />);
    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).getAllByRole("row")).toHaveLength(100);

    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/ }));
    expect(within(body).getAllByRole("row")).toHaveLength(200);
    expect(screen.getByRole("heading", { name: /200 de 664/ })).toBeDefined();
  });

  it("should expand the observacao by keyboard, not only by mouse", () => {
    render(<AcoesDetailTable rows={makeRows(3)} total={3} />);
    const toggle = screen.getAllByRole("button", { name: /Expandir detalhes/ })[0];
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/Observacao completa/)).toBeNull();

    // <button> nativo: Enter dispara click — o que title= nunca faria
    fireEvent.keyDown(toggle, { key: "Enter" });
    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Observacao completa/)).toBeDefined();
    // O texto integral aparece so na linha expandida (inline vem truncado em 90 chars)
    expect(screen.getByText((_, el) => el?.textContent === `${LONG_OBS} [0]`)).toBeDefined();
  });

  it("should warn about server truncation when total exceeds the loaded rows", () => {
    render(<AcoesDetailTable rows={makeRows(120)} total={5538} />);
    expect(screen.getByText(/Mostrando 120 de 5\.538 acoes do periodo/)).toBeDefined();
  });

  it("should not warn about truncation when everything fits", () => {
    render(<AcoesDetailTable rows={makeRows(10)} total={10} />);
    expect(screen.queryByText(/refine o filtro/)).toBeNull();
  });

  it("should search over the observacao text, not only the columns", () => {
    render(<AcoesDetailTable rows={makeRows(MES_ATUAL)} total={MES_ATUAL} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "[7]" } });

    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).getAllByRole("row")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /1 de 1 \(filtradas\)/ })).toBeDefined();
  });

  it("should render an empty state instead of a blank card", () => {
    render(<AcoesDetailTable rows={[]} total={0} />);
    expect(screen.getByText(/Nenhuma acao no periodo selecionado/)).toBeDefined();
  });
});
