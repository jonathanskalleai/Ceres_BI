import { describe, it, expect } from "vitest";
import { aggregateNegociosRows } from "../usePerformanceData";
import type { NegocioRow } from "@/types/negociosSummary";

const makeRow = (overrides: Partial<NegocioRow> = {}): NegocioRow => ({
  tipo: "Maquina",
  recebido: 5000,
  unidade: "UND01",
  cliente: "Fazenda Sol",
  consultor: "Carlos",
  valor_pedido: 10000,
  pdo_situacao_pedido: "Aberto",
  ngo_etapa: "Proposta",
  ngo_conclusao: "Ganho",
  ngo_motivo_ganho: "Preco",
  pdo_dth_abertura: "2024-03-15",
  pdo_cidade_entrega: "Uberlandia",
  pdo_obs_pedido: "",
  cod_consultor: "C01",
  pdo_vlr_recurso_proprio: 0,
  usado: 5000,
  ...overrides,
});

describe("aggregateNegociosRows", () => {
  it("should return zeroed summary for empty array", () => {
    const result = aggregateNegociosRows([]);
    expect(result.totalNegocios).toBe(0);
    expect(result.totalValor).toBe(0);
    expect(result.ticketMedio).toBe(0);
    expect(result.ganhos).toBe(0);
    expect(result.emAndamento).toBe(0);
    expect(result.perdidos).toBe(0);
    expect(result.evolucaoMensal).toEqual([]);
    expect(result.porConsultor).toEqual([]);
  });

  it("should count totals correctly", () => {
    const rows: NegocioRow[] = [
      makeRow({ valor_pedido: 10000, recebido: 3000, ngo_conclusao: "Ganho" }),
      makeRow({ valor_pedido: 20000, recebido: 5000, ngo_conclusao: "Em andamento" }),
      makeRow({ valor_pedido: 15000, recebido: 15000, ngo_conclusao: "Perdido" }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.totalNegocios).toBe(3);
    expect(result.totalValor).toBe(45000);
    expect(result.totalRecebido).toBe(23000);
    expect(result.ganhos).toBe(1);
    expect(result.emAndamento).toBe(1);
    expect(result.perdidos).toBe(1);
  });

  it("should calculate ticketMedio as totalValor / totalNegocios", () => {
    const rows: NegocioRow[] = [
      makeRow({ valor_pedido: 10000 }),
      makeRow({ valor_pedido: 20000 }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.ticketMedio).toBe(15000);
  });

  it("should calculate percentUsado correctly", () => {
    const rows: NegocioRow[] = [
      makeRow({ valor_pedido: 10000, recebido: 4000 }),
    ];
    const result = aggregateNegociosRows(rows);
    // totalUsado = max(0, 10000 - 4000) = 6000
    // percentUsado = 6000 / 10000 * 100 = 60
    expect(result.totalUsado).toBe(6000);
    expect(result.percentUsado).toBe(60);
  });

  it("should not produce negative totalUsado (when recebido > valor_pedido)", () => {
    const rows: NegocioRow[] = [
      makeRow({ valor_pedido: 5000, recebido: 8000 }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.totalUsado).toBe(0);
  });

  it("should group evolucaoMensal by YYYY-MM from pdo_dth_abertura", () => {
    const rows: NegocioRow[] = [
      makeRow({ pdo_dth_abertura: "2024-01-10", valor_pedido: 1000, ngo_conclusao: "Ganho" }),
      makeRow({ pdo_dth_abertura: "2024-01-20", valor_pedido: 2000, ngo_conclusao: "Perdido" }),
      makeRow({ pdo_dth_abertura: "2024-03-05", valor_pedido: 5000, ngo_conclusao: "Ganho" }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.evolucaoMensal).toHaveLength(2);
    const jan = result.evolucaoMensal.find((e) => e.mes === "2024-01");
    expect(jan?.total).toBe(2);
    expect(jan?.valor).toBe(3000);
    expect(jan?.ganhos).toBe(1);
    const mar = result.evolucaoMensal.find((e) => e.mes === "2024-03");
    expect(mar?.total).toBe(1);
    expect(mar?.ganhos).toBe(1);
  });

  it("should sort evolucaoMensal chronologically", () => {
    const rows: NegocioRow[] = [
      makeRow({ pdo_dth_abertura: "2024-06-01" }),
      makeRow({ pdo_dth_abertura: "2024-01-01" }),
      makeRow({ pdo_dth_abertura: "2024-03-01" }),
    ];
    const result = aggregateNegociosRows(rows);
    const meses = result.evolucaoMensal.map((e) => e.mes);
    expect(meses).toEqual(["2024-01", "2024-03", "2024-06"]);
  });

  it("should group porConsultor and sort by valor descending", () => {
    const rows: NegocioRow[] = [
      makeRow({ consultor: "Ana", valor_pedido: 5000, ngo_conclusao: "Ganho" }),
      makeRow({ consultor: "Ana", valor_pedido: 3000, ngo_conclusao: "Perdido" }),
      makeRow({ consultor: "Bia", valor_pedido: 20000, ngo_conclusao: "Ganho" }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.porConsultor).toHaveLength(2);
    expect(result.porConsultor[0].nome).toBe("Bia");
    expect(result.porConsultor[0].valor).toBe(20000);
    expect(result.porConsultor[1].nome).toBe("Ana");
    expect(result.porConsultor[1].total).toBe(2);
    expect(result.porConsultor[1].ganhos).toBe(1);
  });

  it("should calculate conversao per consultor as ganhos/total * 100 rounded", () => {
    const rows: NegocioRow[] = [
      makeRow({ consultor: "X", ngo_conclusao: "Ganho" }),
      makeRow({ consultor: "X", ngo_conclusao: "Ganho" }),
      makeRow({ consultor: "X", ngo_conclusao: "Perdido" }),
    ];
    const result = aggregateNegociosRows(rows);
    // 2/3 * 100 = 66.6... -> Math.round = 67
    expect(result.porConsultor[0].conversao).toBe(67);
  });

  it("should count clientesAtendidos as unique non-empty clients", () => {
    const rows: NegocioRow[] = [
      makeRow({ cliente: "A" }),
      makeRow({ cliente: "A" }),
      makeRow({ cliente: "B" }),
      makeRow({ cliente: "" }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.clientesAtendidos).toBe(2);
  });

  it("should skip rows without pdo_dth_abertura in evolucaoMensal", () => {
    const rows: NegocioRow[] = [
      makeRow({ pdo_dth_abertura: "" }),
      makeRow({ pdo_dth_abertura: "2024-05-01" }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.evolucaoMensal).toHaveLength(1);
  });

  it("should skip rows without consultor in porConsultor", () => {
    const rows: NegocioRow[] = [
      makeRow({ consultor: "" }),
      makeRow({ consultor: "Carlos" }),
    ];
    const result = aggregateNegociosRows(rows);
    expect(result.porConsultor).toHaveLength(1);
    expect(result.porConsultor[0].nome).toBe("Carlos");
  });
});
