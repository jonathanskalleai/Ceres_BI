import { describe, it, expect, vi } from "vitest";
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
  it("should show the total count in the heading when rendering a page", () => {
    const onPageChange = vi.fn();
    render(
      <AcoesDetailTable
        rows={makeRows(50)}
        total={MES_ATUAL}
        page={1}
        pageSize={50}
        totalPages={Math.ceil(MES_ATUAL / 50)}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByRole("heading", { name: /Acoes do Periodo · 664 acoes/ })).toBeDefined();
  });

  it("should render pagination controls and call onPageChange when clicking page 2", () => {
    const onPageChange = vi.fn();
    const totalPages = Math.ceil(MES_ATUAL / 50);
    render(
      <AcoesDetailTable
        rows={makeRows(50)}
        total={MES_ATUAL}
        page={1}
        pageSize={50}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />,
    );

    // Pagination nav is present
    expect(screen.getByRole("navigation", { name: /Paginacao/ })).toBeDefined();

    // Page 2 button exists and triggers onPageChange
    const page2Btn = screen.getByRole("button", { name: "Pagina 2" });
    fireEvent.click(page2Btn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("should expand the observacao and expose the full text only when open", () => {
    render(
      <AcoesDetailTable
        rows={makeRows(3)}
        total={3}
        page={1}
        pageSize={50}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    const toggle = screen.getAllByRole("button", { name: /Expandir detalhes/ })[0];
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/Observacao completa/)).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Observacao completa/)).toBeDefined();
    // O texto integral aparece so na linha expandida (inline vem truncado em 90 chars)
    expect(screen.getByText((_, el) => el?.textContent === `${LONG_OBS} [0]`)).toBeDefined();
  });

  it("should use a native button so the keyboard works without extra handlers", () => {
    // jsdom NAO traduz Enter/Espaco em click (isso e comportamento do navegador),
    // entao disparar keyDown aqui nao provaria nada. O que da para provar — e o
    // que de fato importa — e que o gatilho e um <button> NATIVO e nao um <div
    // onClick>: e dele que vem foco por Tab, Enter/Espaco e o papel no leitor de
    // tela, sem nenhum handler de teclado escrito a mao.
    render(
      <AcoesDetailTable
        rows={makeRows(1)}
        total={1}
        page={1}
        pageSize={50}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", { name: /Expandir detalhes/ });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.hasAttribute("disabled")).toBe(false);
  });

  it("should show the range label when total exceeds the page size", () => {
    const onPageChange = vi.fn();
    render(
      <AcoesDetailTable
        rows={makeRows(50)}
        total={5538}
        page={1}
        pageSize={50}
        totalPages={Math.ceil(5538 / 50)}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText(/Mostrando 1–50 de 5\.538/)).toBeDefined();
  });

  it("should not warn about truncation when everything fits", () => {
    render(
      <AcoesDetailTable
        rows={makeRows(10)}
        total={10}
        page={1}
        pageSize={50}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/refine o filtro/)).toBeNull();
  });

  it("should search over the observacao text and update heading with match count", () => {
    const onPageChange = vi.fn();
    render(
      <AcoesDetailTable
        rows={makeRows(50)}
        total={MES_ATUAL}
        page={1}
        pageSize={50}
        totalPages={Math.ceil(MES_ATUAL / 50)}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "[7]" } });

    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).getAllByRole("row")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /1 encontradas na pagina/ })).toBeDefined();
  });

  it("should render an empty state instead of a blank card", () => {
    render(
      <AcoesDetailTable
        rows={[]}
        total={0}
        page={1}
        pageSize={50}
        totalPages={0}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nenhuma acao no periodo selecionado/)).toBeDefined();
  });

  it("should NOT claim there was no activity when the query failed", () => {
    // A regressao mais cara possivel nesta tela: RPC quebra -> rows=[] -> usuario
    // le "nenhuma acao no periodo" e conclui que a equipe nao trabalhou.
    render(
      <AcoesDetailTable
        rows={[]}
        total={0}
        page={1}
        pageSize={50}
        totalPages={0}
        onPageChange={vi.fn()}
        error={new Error("rpc timeout")}
      />,
    );

    expect(screen.queryByText(/Nenhuma acao no periodo selecionado/)).toBeNull();
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Nao foi possivel carregar estes dados/)).toBeDefined();
    expect(screen.getByText(/rpc timeout/)).toBeDefined();
  });
});
