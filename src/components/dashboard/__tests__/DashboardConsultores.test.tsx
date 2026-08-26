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

  it("ordena os cartões do Performance Ranking estritamente pelo maior volume de vendas", () => {
    const vendedoresMulti: Vendedor[] = [
      { nome: "CONSULTOR BAIXO", totalAcoes: 10, visitas: 5, clientes: 5, pipeline: 100000, negocios: 1, conversao: null, crmQuality: 100, evolucao: [], topClientes: [], regioes: [], tiposAcao: {} },
      { nome: "CONSULTOR TOPO", totalAcoes: 20, visitas: 10, clientes: 10, pipeline: 500000, negocios: 2, conversao: null, crmQuality: 100, evolucao: [], topClientes: [], regioes: [], tiposAcao: {} },
      { nome: "CONSULTOR MEDIO", totalAcoes: 15, visitas: 8, clientes: 8, pipeline: 200000, negocios: 2, conversao: null, crmQuality: 100, evolucao: [], topClientes: [], regioes: [], tiposAcao: {} },
    ];

    const desempenhoMock: EquipeDesempenhoData = {
      rows: [
        { consultor: "CONSULTOR BAIXO", competencia: "2026-08-01", total_venda: 50000, meta: 100000, total: 100000, oportunidade: 50000, cotacao: 30000, proposta: 20000 },
        { consultor: "CONSULTOR TOPO", competencia: "2026-08-01", total_venda: 450000, meta: 200000, total: 500000, oportunidade: 200000, cotacao: 150000, proposta: 150000 },
        { consultor: "CONSULTOR MEDIO", competencia: "2026-08-01", total_venda: 180000, meta: 150000, total: 200000, oportunidade: 100000, cotacao: 50000, proposta: 50000 },
      ],
      team: [],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardConsultores
          vendedores={vendedoresMulti}
          registros={[]}
          resumo={[]}
          filters={{
            cidade: "",
            tipoAcao: "",
            categoria: "",
            funil: "",
            dateRange: { from: "2026-08-01", to: "2026-08-31" },
          }}
          onSelectConsultor={vi.fn()}
          anoDesempenho={2026}
          desempenho={desempenhoMock}
          isAdmin={true}
        />
      </QueryClientProvider>
    );

    // O consultor com maior venda (CONSULTOR TOPO: 450.000) deve aparecer como #1
    expect(screen.getByText("Posição #1")).toBeInTheDocument();
    expect(screen.getByText("Posição #2")).toBeInTheDocument();
    expect(screen.getByText("Posição #3")).toBeInTheDocument();

    const cardHeadings = screen.getAllByRole("heading", { level: 4 });
    const cardNames = cardHeadings.map((h) => h.textContent);

    expect(cardNames).toEqual(["CONSULTOR TOPO", "CONSULTOR MEDIO", "CONSULTOR BAIXO"]);
  });

  it("desempata consultores sem vendas no mês pelo acumulado de vendas no ano", () => {
    const vendedoresMulti: Vendedor[] = [
      { nome: "CONSULTOR SEM VENDA NO ANO", totalAcoes: 10, visitas: 5, clientes: 5, pipeline: 100000, negocios: 1, conversao: null, crmQuality: 100, evolucao: [], topClientes: [], regioes: [], tiposAcao: {} },
      { nome: "CONSULTOR TOP ANO", totalAcoes: 20, visitas: 10, clientes: 10, pipeline: 500000, negocios: 2, conversao: null, crmQuality: 100, evolucao: [], topClientes: [], regioes: [], tiposAcao: {} },
      { nome: "CONSULTOR VENDA MES", totalAcoes: 15, visitas: 8, clientes: 8, pipeline: 200000, negocios: 2, conversao: null, crmQuality: 100, evolucao: [], topClientes: [], regioes: [], tiposAcao: {} },
    ];

    const desempenhoMock: EquipeDesempenhoData = {
      rows: [
        // CONSULTOR VENDA MES: vendeu no mês atual (Agosto)
        { consultor: "CONSULTOR VENDA MES", competencia: "2026-08-01", total_venda: 50000, meta: 100000, total: 100000, oportunidade: 50000, cotacao: 30000, proposta: 20000 },
        // CONSULTOR TOP ANO: 0 no mês atual (Agosto), mas 2.000.000 em Julho
        { consultor: "CONSULTOR TOP ANO", competencia: "2026-08-01", total_venda: 0, meta: 200000, total: 500000, oportunidade: 200000, cotacao: 150000, proposta: 150000 },
        { consultor: "CONSULTOR TOP ANO", competencia: "2026-07-01", total_venda: 2000000, meta: 200000, total: 500000, oportunidade: 200000, cotacao: 150000, proposta: 150000 },
        // CONSULTOR SEM VENDA NO ANO: 0 no mês e 0 no ano
        { consultor: "CONSULTOR SEM VENDA NO ANO", competencia: "2026-08-01", total_venda: 0, meta: 150000, total: 200000, oportunidade: 100000, cotacao: 50000, proposta: 50000 },
      ],
      team: [],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardConsultores
          vendedores={vendedoresMulti}
          registros={[]}
          resumo={[]}
          filters={{
            cidade: "",
            tipoAcao: "",
            categoria: "",
            funil: "",
            dateRange: { from: "2026-08-01", to: "2026-08-31" },
          }}
          onSelectConsultor={vi.fn()}
          anoDesempenho={2026}
          desempenho={desempenhoMock}
          isAdmin={true}
        />
      </QueryClientProvider>
    );

    // Ordem esperada:
    // 1º CONSULTOR VENDA MES (vendeu 50k em agosto)
    // 2º CONSULTOR TOP ANO (0 em agosto, mas 2M no ano)
    // 3º CONSULTOR SEM VENDA NO ANO (0 em agosto, 0 no ano)
    const cardHeadings = screen.getAllByRole("heading", { level: 4 });
    const cardNames = cardHeadings.map((h) => h.textContent);

    expect(cardNames).toEqual(["CONSULTOR VENDA MES", "CONSULTOR TOP ANO", "CONSULTOR SEM VENDA NO ANO"]);
  });
});
