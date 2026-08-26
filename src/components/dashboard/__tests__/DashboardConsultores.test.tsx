import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardConsultores } from "../DashboardConsultores";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Vendedor } from "@/types/comercial";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

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

const emptyDesempenho: EquipeDesempenhoData = {
  rows: [],
  team: [],
};

describe("DashboardConsultores", () => {
  it("renderiza o cockpit com resumo executivo, IA no meio, clientes atendidos, ranking horizontal e tabela de desempenho", () => {
    render(
      <QueryClientProvider client={queryClient}>
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
          anoDesempenho={2026}
          desempenho={emptyDesempenho}
          isAdmin={true}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Resumo Executivo/i)).toBeInTheDocument();
    expect(screen.getByText("Inteligência da Equipe · IA")).toBeInTheDocument();
    expect(screen.getByText("Clientes Atendidos")).toBeInTheDocument();
    expect(screen.getByText(/Performance Ranking/i)).toBeInTheDocument();
    expect(screen.getByText("Análise de Desempenho da Equipe")).toBeInTheDocument();
    expect(screen.getAllByText("CARLOS AUGUSTO AUGUSTIN")).not.toHaveLength(0);
  });
});
