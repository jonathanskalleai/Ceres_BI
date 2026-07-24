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

  it("should expand the observacao and expose the full text only when open", () => {
    render(<AcoesDetailTable rows={makeRows(3)} total={3} />);
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
    render(<AcoesDetailTable rows={makeRows(1)} total={1} />);
    const toggle = screen.getByRole("button", { name: /Expandir detalhes/ });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.hasAttribute("disabled")).toBe(false);
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

  it("should NOT claim there was no activity when the query failed", () => {
    // A regressao mais cara possivel nesta tela: RPC quebra -> rows=[] -> usuario
    // le "nenhuma acao no periodo" e conclui que a equipe nao trabalhou.
    render(<AcoesDetailTable rows={[]} total={0} error={new Error("rpc timeout")} />);

    expect(screen.queryByText(/Nenhuma acao no periodo selecionado/)).toBeNull();
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Nao foi possivel carregar estes dados/)).toBeDefined();
    expect(screen.getByText(/rpc timeout/)).toBeDefined();
  });
});
