import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AcoesFunilConversao } from "../AcoesFunilConversao";
import type { AcoesFunil, AcoesFunilMeta } from "@/types/biRpc";

/**
 * Fotografia de julho/2026 auditada no banco vivo (2026-08-02T23:00Z), usada
 * como FORMATO, nao como assercao de negocio: 546 visitas, 141 oportunidades
 * no funil VENDAS, 110 ainda abertas, 26 pedidos ganhos, 7 negocios perdidos.
 */
const funilCheio: AcoesFunil = {
  visitas: 546,
  oportunidades: 141,
  valorOportunidades: 16_065_886,
  oportunidadesAbertas: 110,
  valorOportunidadesAbertas: 12_407_661,
  entradasEtapaOportunidade: 72,
  emEtapaOportunidade: 61,
  ganhos: 26,
  perdidos: 7,
  valorPerdido: 1_060_000,
  visitasPorOportunidade: 3.87,
  oportPorFechamento: 5.42,
};

const funilVazio: AcoesFunil = {
  visitas: 120,
  oportunidades: 0,
  valorOportunidades: 0,
  oportunidadesAbertas: 0,
  valorOportunidadesAbertas: 0,
  entradasEtapaOportunidade: 0,
  emEtapaOportunidade: 0,
  ganhos: 0,
  perdidos: 0,
  valorPerdido: 0,
  visitasPorOportunidade: null,
  oportPorFechamento: null,
};

const meta = (perdidosSemAtribuicao: number): AcoesFunilMeta => ({
  acoesSemConsultor: 0,
  ganhosSemAtribuicao: 0,
  perdidosSemAtribuicao,
  somaGanhosRanking: 0,
});

describe("AcoesFunilConversao", () => {
  it("should render visitas and oportunidades as the only activity stages", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);
    expect(screen.getByText("546")).toBeInTheDocument();
    expect(screen.getByText("141")).toBeInTheDocument();
    expect(screen.getByText(/Oportunidades no funil VENDAS/)).toBeInTheDocument();
    expect(screen.getByText(/Etapa inicial “Oportunidade”/)).toBeInTheDocument();
  });

  it("should render ganhos and perdidos as PARALLEL desfechos, each with its own source and unit", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);

    expect(screen.getByText("Ganhos")).toBeInTheDocument();
    expect(screen.getByText("Perdidos")).toBeInTheDocument();
    // unidades diferentes: pedido de um lado, negocio do outro
    expect(screen.getByText("pedidos aprovados")).toBeInTheDocument();
    // "negocios" aparece em mais de um lugar (header + footer novo); verifica que existe
    expect(screen.getAllByText(/negocios/i).length).toBeGreaterThan(0);
    // cada desfecho carrega a sua data de competencia
    expect(screen.getByText(/data de aprovacao do pedido/)).toBeInTheDocument();
    expect(screen.getByText(/data de fechamento do negocio/)).toBeInTheDocument();
    expect(screen.getByText(/nao se somam/i)).toBeInTheDocument();
  });

  it("should never present ganho vs perdido as a conversion rate", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);
    // o unico indice exibido e explicitamente rotulado como artefato de janela
    expect(screen.getByText(/Indice de janela/i)).toBeInTheDocument();
    expect(screen.getByText(/nao e taxa de\s+conversao/i)).toBeInTheDocument();
    expect(screen.getByText(/Nao e funil/i)).toBeInTheDocument();
    // a frase atravessa um <em>, entao a assercao e sobre o texto renderizado
    expect(document.body.textContent).toMatch(/desfechos\s+paralelos/i);
  });

  it("should show the R$ of perdidos but NOT invent a R$ for ganhos (the RPC does not return it)", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);
    expect(screen.getByText(/1\.060\.000/)).toBeInTheDocument();
    // ganho aponta para onde o R$ vive, em vez de renderizar R$ 0
    expect(screen.getByText(/R\$ no card/)).toBeInTheDocument();
    expect(screen.queryByText(/^R\$\s?0$/)).toBeNull();
  });

  it("should carry the literal period note — one selector, five competence dates", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);
    expect(
      screen.getByText(
        "Período dos eventos: visitas por conclusão, oportunidades pela primeira entrada no funil VENDAS, etapa inicial por entrada na etapa, ganhos por aprovação de pedido e perdas por fechamento.",
      ),
    ).toBeInTheDocument();
  });

  it("should explain the funnel opportunity and that Tipo de Acao is outside this quadro", () => {
    render(<AcoesFunilConversao funil={funilCheio} />);
    expect(screen.getByText(/Oportunidade e a entrada no funil VENDAS/i)).toBeInTheDocument();
    expect(screen.getByText(/nao e aplicado a este\s+quadro/i)).toBeInTheDocument();
  });

  it("should expose perdidosSemAtribuicao only when there is one to expose", () => {
    const { unmount } = render(<AcoesFunilConversao funil={funilCheio} meta={meta(1)} />);
    expect(screen.getByText(/sem\s+consultor atribuido/i)).toBeInTheDocument();
    unmount();

    render(<AcoesFunilConversao funil={funilCheio} meta={meta(0)} />);
    expect(screen.queryByText(/sem\s+consultor atribuido/i)).toBeNull();
  });

  it("should render a dash — never 0, Infinity or NaN — when there is no denominator", () => {
    render(<AcoesFunilConversao funil={funilVazio} />);
    expect(screen.getAllByText(/—/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Infinity|NaN/)).toBeNull();
  });

  it("should show an explicit error state instead of a 0 → 0 → 0 board when the query fails", () => {
    render(<AcoesFunilConversao funil={funilVazio} error={new Error("PGRST202: function not found")} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // a mensagem amigavel e sempre visivel; o detalhe tecnico e gateado pelo
    // BI DEBUG e tem cobertura propria em BiGestaoErro.test.tsx
    expect(screen.getByText(/a consulta falhou/)).toBeInTheDocument();
    // o quadro NAO pode ser renderizado com zeros quando a consulta falhou
    expect(screen.queryByText("Visitas")).toBeNull();
    expect(screen.queryByText("Perdidos")).toBeNull();
  });
});
