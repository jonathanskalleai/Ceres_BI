import { describe, it, expect, vi } from "vitest";

// Mock o service para evitar inicializacao do Supabase client no ambiente de teste.
// aggregatePedidos e uma funcao pura — nao depende do fetch real.
vi.mock("@/services/bi/pedidosBIService", () => ({
  fetchPedidosBI: vi.fn().mockResolvedValue([]),
}));

import { aggregatePedidos } from "@/hooks/bi/usePedidosData";
import type { PedidoRow } from "@/services/bi/pedidosBIService";

function row(over: Partial<PedidoRow>): PedidoRow {
  return {
    NGO_Numero: "N",
    PDO_SituacaoPedido: "Aprovado",
    PDO_VlrPedido: 0,
    PDO_VlrFinanciado: 0,
    PDO_VlrRecursoProprio: 0,
    PDO_CidadeUFEntrega: "SP/SP",
    PDO_Vendedor: "Ana",
    PDO_DthPedido: "2026-01-10",
    ...over,
  };
}

describe("aggregatePedidos", () => {
  it("returns zeroed KPIs for empty input", () => {
    const r = aggregatePedidos([]);
    expect(r.kpis.total).toBe(0);
    expect(r.kpis.faturamento).toBe(0);
    expect(r.kpis.percentAprovado).toBe(0);
    expect(r.kpis.percentFinanciado).toBe(0);
    expect(r.porSituacao).toHaveLength(0);
  });

  it("counts revenue only from approved orders", () => {
    const rows: PedidoRow[] = [
      row({ PDO_SituacaoPedido: "Aprovado", PDO_VlrPedido: 1000, PDO_Vendedor: "Ana" }),
      row({ PDO_SituacaoPedido: "Cancelado", PDO_VlrPedido: 500, PDO_Vendedor: "Bruno" }),
      row({ PDO_SituacaoPedido: "Aprovado", PDO_VlrPedido: 3000, PDO_Vendedor: "Ana" }),
    ];
    const r = aggregatePedidos(rows);
    expect(r.kpis.total).toBe(3);
    expect(r.kpis.faturamento).toBe(4000); // ignora o cancelado
    expect(r.kpis.ticketMedio).toBe(2000); // 4000 / 2 aprovados
    expect(r.kpis.percentAprovado).toBeCloseTo((2 / 3) * 100);
    expect(r.kpis.valorCancelado).toBe(500);
    // ranking de vendedor usa apenas aprovados: Ana 4000
    expect(r.porVendedor[0]).toMatchObject({ name: "Ana", value: 4000 });
  });

  it("computes financing mix over approved orders", () => {
    const rows: PedidoRow[] = [
      row({ PDO_VlrPedido: 1000, PDO_VlrFinanciado: 600, PDO_VlrRecursoProprio: 400 }),
      row({ PDO_VlrPedido: 1000, PDO_VlrFinanciado: 0, PDO_VlrRecursoProprio: 1000 }),
    ];
    const r = aggregatePedidos(rows);
    // financiado 600 / (600 + 1400) = 30%
    expect(r.kpis.percentFinanciado).toBeCloseTo(30);
    expect(r.mixPagamento.find((m) => m.name === "Financiado")?.value).toBe(600);
    expect(r.mixPagamento.find((m) => m.name === "Recurso Proprio")?.value).toBe(1400);
  });
});
