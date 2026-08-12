import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardConsultores } from "../DashboardConsultores";
import type { Vendedor } from "@/types/comercial";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";

vi.mock("../ConsultorReportSheet", () => ({
  ConsultorReportSheet: () => null,
}));

const vendedores: Vendedor[] = [
  {
    nome: "CARLOS AUGUSTO AUGUSTIN",
    totalAcoes: 31,
    visitas: 25,
    clientes: 27,
    pipeline: 503000,
    negocios: 6,
    conversao: null,
    crmQuality: 100,
    evolucao: [],
    topClientes: [],
    regioes: [],
    tiposAcao: {},
  },
];

const resumo: RpcConsultorResumoAcoes[] = [
  {
    consultor: "CARLOS AUGUSTO AUGUSTIN",
    acoes: 31,
    visitas: 25,
    clientes: 27,
    crm_quality: 100,
    negocios_abertos_tocados: 6,
    carteira_ativa_trabalhada: 503000,
    oportunidades_geradas: 0,
    oportunidades_abertas: 0,
    pipeline_aberto_gerado: 0,
    ganhos: 0,
    valor_ganho: 0,
    perdidos: 0,
    valor_perdido: 0,
    taxa_ganho: null,
  },
];

describe("DashboardConsultores", () => {
  it("mantém a conferência, o ranking de clientes e os cards individuais", () => {
    render(
      <DashboardConsultores
        vendedores={vendedores}
        registros={[]}
        resumo={resumo}
        filters={{
          cidade: "",
          tipoAcao: "",
          categoria: "",
          funil: "",
          dateRange: { from: "2026-08-01", to: "2026-08-31" },
        }}
        onSelectConsultor={vi.fn()}
      />,
    );

    expect(screen.getByText("Ranking e conferência por consultor")).toBeInTheDocument();
    expect(screen.getByText("Clientes atendidos por consultor")).toBeInTheDocument();
    expect(screen.getByText("Ranking comercial · vendas, visitas e ações")).toBeInTheDocument();
    expect(screen.getAllByText("CARLOS AUGUSTO AUGUSTIN")).toHaveLength(3);
    expect(screen.getByText("R$ 503.000,00")).toBeInTheDocument();
    expect(screen.getByText("25 visitas · 27 clientes")).toBeInTheDocument();
  });
});
