import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/bi/servicosBIService", () => ({
  fetchOrdensServico: vi.fn().mockResolvedValue([]),
  fetchAtendimentosOS: vi.fn().mockResolvedValue([]),
  fetchOcorrencias: vi.fn().mockResolvedValue([]),
}));

import { aggregateServicos } from "@/hooks/bi/useServicosData";
import type {
  OrdemServicoRow, AtendimentoOSRow, OcorrenciaRow,
} from "@/services/bi/servicosBIService";

const os = (over: Partial<OrdemServicoRow>): OrdemServicoRow => ({
  OS_nrOS: 1, OS_fStatus: "Fechada", SIT_dscSituacaoOS: "Encerrada/Faturada",
  OS_dthAbertura: "2026-01-01T00:00:00Z", OS_dthEncerramento: "2026-01-06T00:00:00Z",
  ...over,
});

describe("aggregateServicos", () => {
  it("returns zeroed KPIs for empty input", () => {
    const { kpis } = aggregateServicos([], [], []);
    expect(kpis.totalOS).toBe(0);
    expect(kpis.taxaFechamento).toBe(0);
    expect(kpis.tempoMedioResolucao).toBe(0);
  });

  it("computes closure rate and resolution time", () => {
    const ordens = [
      os({ OS_fStatus: "Fechada", OS_dthAbertura: "2026-01-01T00:00:00Z", OS_dthEncerramento: "2026-01-03T00:00:00Z" }), // 2d
      os({ OS_fStatus: "Fechada", OS_dthAbertura: "2026-01-01T00:00:00Z", OS_dthEncerramento: "2026-01-11T00:00:00Z" }), // 10d
      os({ OS_fStatus: "Aberta", OS_dthEncerramento: null }),
    ];
    const { kpis, faixasResolucao } = aggregateServicos(ordens, [], []);
    expect(kpis.totalOS).toBe(3);
    expect(kpis.abertas).toBe(1);
    expect(kpis.taxaFechamento).toBeCloseTo((2 / 3) * 100);
    expect(kpis.tempoMedioResolucao).toBeCloseTo(6); // (2 + 10) / 2
    expect(kpis.tempoMedianoResolucao).toBeCloseTo(6);
    // 1 OS na faixa 0-3 dias, 1 na faixa 8-15 dias
    expect(faixasResolucao.find((f) => f.name === "0-3 dias")?.value).toBe(1);
    expect(faixasResolucao.find((f) => f.name === "8-15 dias")?.value).toBe(1);
  });

  it("drops noise from causes and pause reasons", () => {
    const atend: AtendimentoOSRow[] = [
      { ATD_dscCausa: "Instalação", ATD_DuracaoAtendimento: 5 },
      { ATD_dscCausa: "Instalação", ATD_DuracaoAtendimento: 5 },
      { ATD_dscCausa: "None", ATD_DuracaoAtendimento: null },
      { ATD_dscCausa: "Nenhuma causa", ATD_DuracaoAtendimento: null },
    ];
    const ocorr: OcorrenciaRow[] = [
      { OSE_dscMotivoPausa: "Aguardando Peças", OSE_dscSituacaoOcorrencia: "Em pausa" },
      { OSE_dscMotivoPausa: "None", OSE_dscSituacaoOcorrencia: "Deslocamento" },
    ];
    const { causasAtendimento, motivosPausa } = aggregateServicos([], atend, ocorr);
    expect(causasAtendimento).toEqual([{ name: "Instalação", value: 2 }]);
    expect(motivosPausa).toEqual([{ name: "Aguardando Peças", value: 1 }]);
  });
});
