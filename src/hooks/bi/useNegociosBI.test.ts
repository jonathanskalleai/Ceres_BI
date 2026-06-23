import { describe, it, expect, vi } from "vitest";

// aggregateNegociosBI e dedupeNegocios sao funcoes puras; mockamos o service
// para nao inicializar o Supabase client no ambiente de teste.
vi.mock("@/services/bi/negociosBIService", () => ({
  fetchNegociosBI: vi.fn().mockResolvedValue([]),
}));

import { aggregateNegociosBI, dedupeNegocios } from "@/hooks/bi/useNegociosBI";
import type { NegocioBIRow } from "@/services/bi/negociosBIService";

function row(over: Partial<NegocioBIRow>): NegocioBIRow {
  return {
    NGO_Numero: "N1",
    NGO_Conclusao: "Em Andamento",
    NGO_Etapa: "1-OPORTUNIDADE",
    NGO_Funil: "VENDAS",
    NGO_VlrTotalNegociado: 0,
    NGO_FormaEntrada: "Facebook",
    NGO_MotivoPerda: null,
    NGO_MotivoGanho: null,
    NGO_CicloVendas: null,
    NGO_QtdAcoes: null,
    NGO_Probabilidade: null,
    NGO_Vendedores: "81",
    NGO_DataCadastro: "2026-01-10",
    NGO_DataFechamento: null,
    vendedorNome: "Ana",
    ...over,
  };
}

describe("dedupeNegocios", () => {
  it("removes duplicate rows sharing the same NGO_Numero", () => {
    const rows = [
      row({ NGO_Numero: "A", NGO_VlrTotalNegociado: 550000 }),
      row({ NGO_Numero: "A", NGO_VlrTotalNegociado: 550000 }), // duplicata por produto
      row({ NGO_Numero: "B", NGO_VlrTotalNegociado: 10000 }),
    ];
    expect(dedupeNegocios(rows)).toHaveLength(2);
  });
});

describe("aggregateNegociosBI", () => {
  it("returns zeroed KPIs for empty input", () => {
    const { kpis } = aggregateNegociosBI([]);
    expect(kpis.totalNegocios).toBe(0);
    expect(kpis.taxaConversao).toBe(0);
    expect(kpis.pipelineAberto).toBe(0);
  });

  it("does not double-count duplicated deals in pipeline value", () => {
    const rows = [
      row({ NGO_Numero: "A", NGO_Conclusao: "Em Andamento", NGO_VlrTotalNegociado: 100000 }),
      row({ NGO_Numero: "A", NGO_Conclusao: "Em Andamento", NGO_VlrTotalNegociado: 100000 }),
    ];
    const { kpis } = aggregateNegociosBI(rows);
    expect(kpis.totalNegocios).toBe(1);
    expect(kpis.pipelineAberto).toBe(100000); // nao 200000
  });

  it("computes conversion rate over closed deals only", () => {
    const rows = [
      row({ NGO_Numero: "A", NGO_Conclusao: "Ganho", NGO_VlrTotalNegociado: 200 }),
      row({ NGO_Numero: "B", NGO_Conclusao: "Ganho", NGO_VlrTotalNegociado: 300 }),
      row({ NGO_Numero: "C", NGO_Conclusao: "Perdido", NGO_VlrTotalNegociado: 100 }),
      row({ NGO_Numero: "D", NGO_Conclusao: "Em Andamento", NGO_VlrTotalNegociado: 999 }),
    ];
    const { kpis } = aggregateNegociosBI(rows);
    expect(kpis.ganhos).toBe(2);
    expect(kpis.perdidos).toBe(1);
    expect(kpis.andamento).toBe(1);
    // 2 ganhos de 3 concluidos = 66.67%, ignora o "Em Andamento"
    expect(kpis.taxaConversao).toBeCloseTo((2 / 3) * 100);
    expect(kpis.valorGanho).toBe(500);
    expect(kpis.ticketMedioGanho).toBe(250);
  });

  it("attributes lost value to loss reasons", () => {
    const rows = [
      row({ NGO_Numero: "A", NGO_Conclusao: "Perdido", NGO_MotivoPerda: "PRECO", NGO_VlrTotalNegociado: 5000 }),
      row({ NGO_Numero: "B", NGO_Conclusao: "Perdido", NGO_MotivoPerda: "PRECO", NGO_VlrTotalNegociado: 3000 }),
      row({ NGO_Numero: "C", NGO_Conclusao: "Perdido", NGO_MotivoPerda: "DESISTENCIA", NGO_VlrTotalNegociado: 1000 }),
    ];
    const { motivosPerda } = aggregateNegociosBI(rows);
    expect(motivosPerda[0]).toMatchObject({ name: "PRECO", valor: 8000, qtd: 2 });
  });
});
