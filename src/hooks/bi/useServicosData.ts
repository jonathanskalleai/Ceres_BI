import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchOrdensServico, fetchAtendimentosOS, fetchOcorrencias,
  type OrdemServicoRow, type AtendimentoOSRow, type OcorrenciaRow,
} from "@/services/bi/servicosBIService";
import { daysBetween, yearMonth } from "@/lib/dateUtils";

interface ChartDatum {
  name: string;
  value: number;
}

interface ServicosKPIs {
  totalOS: number;
  abertas: number;
  taxaFechamento: number; // % OS fechadas
  tempoMedioResolucao: number; // dias
  tempoMedianoResolucao: number; // dias
  totalOcorrencias: number;
}

export interface ServicosAgg {
  kpis: ServicosKPIs;
  porStatus: ChartDatum[];
  faixasResolucao: ChartDatum[];
  evolucaoAberturas: ChartDatum[];
  situacaoOcorrencias: ChartDatum[];
  motivosPausa: ChartDatum[];
  causasAtendimento: ChartDatum[];
}

const NOISE = new Set(["", "none", "null", "nenhuma causa", "nenhuma peca", "nenhuma peça", "nao informado", "não foi peças"]);
const clean = (v: string | null): string => (v ?? "").replace(/\t/g, "").trim();
const isNoise = (v: string): boolean => NOISE.has(v.toLowerCase());

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function topCounts(values: string[], top = 8, dropNoise = false): ChartDatum[] {
  const map = new Map<string, number>();
  for (const v of values) {
    if (dropNoise && isNoise(v)) continue;
    const key = v || "Nao informado";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

export function aggregateServicos(
  ordens: OrdemServicoRow[],
  atendimentos: AtendimentoOSRow[],
  ocorrencias: OcorrenciaRow[],
): ServicosAgg {
  const totalOS = ordens.length;
  let fechadas = 0;
  let abertas = 0;
  const resolucoes: number[] = [];
  const statusMap = new Map<string, number>();
  const mesMap = new Map<string, number>();

  for (const o of ordens) {
    const status = clean(o.OS_fStatus) || "Sem status";
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);

    const s = status.toLowerCase();
    if (s.includes("fechad")) fechadas++;
    else if (s.includes("abert")) abertas++;

    const dias = daysBetween(o.OS_dthAbertura, o.OS_dthEncerramento);
    if (dias != null && dias >= 0) resolucoes.push(dias);

    const ym = yearMonth(o.OS_dthAbertura ?? "");
    if (ym) mesMap.set(ym, (mesMap.get(ym) ?? 0) + 1);
  }

  const faixas = [
    { name: "0-3 dias", test: (d: number) => d <= 3 },
    { name: "4-7 dias", test: (d: number) => d > 3 && d <= 7 },
    { name: "8-15 dias", test: (d: number) => d > 7 && d <= 15 },
    { name: "16-30 dias", test: (d: number) => d > 15 && d <= 30 },
    { name: "30+ dias", test: (d: number) => d > 30 },
  ];
  const faixasResolucao = faixas.map((f) => ({
    name: f.name,
    value: resolucoes.filter((d) => f.test(d)).length,
  }));

  const avg = resolucoes.length > 0 ? resolucoes.reduce((s, d) => s + d, 0) / resolucoes.length : 0;

  const kpis: ServicosKPIs = {
    totalOS,
    abertas,
    taxaFechamento: totalOS > 0 ? (fechadas / totalOS) * 100 : 0,
    tempoMedioResolucao: avg,
    tempoMedianoResolucao: median(resolucoes),
    totalOcorrencias: ocorrencias.length,
  };

  const porStatus = Array.from(statusMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const evolucaoAberturas = Array.from(mesMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-12);

  const situacaoOcorrencias = topCounts(ocorrencias.map((o) => clean(o.OSE_dscSituacaoOcorrencia)));
  const motivosPausa = topCounts(ocorrencias.map((o) => clean(o.OSE_dscMotivoPausa)), 8, true);
  const causasAtendimento = topCounts(atendimentos.map((a) => clean(a.ATD_dscCausa)), 8, true);

  return {
    kpis, porStatus, faixasResolucao, evolucaoAberturas,
    situacaoOcorrencias, motivosPausa, causasAtendimento,
  };
}

export function useServicosData(enabled: boolean) {
  const ordensQ = useQuery({ queryKey: ["bi-os"], queryFn: fetchOrdensServico, staleTime: 60_000, enabled });
  const atendQ = useQuery({ queryKey: ["bi-os-atend"], queryFn: fetchAtendimentosOS, staleTime: 60_000, enabled });
  const ocorrQ = useQuery({ queryKey: ["bi-os-ocorr"], queryFn: fetchOcorrencias, staleTime: 60_000, enabled });

  const agg = useMemo(
    () => aggregateServicos(ordensQ.data ?? [], atendQ.data ?? [], ocorrQ.data ?? []),
    [ordensQ.data, atendQ.data, ocorrQ.data],
  );

  return { agg, isLoading: ordensQ.isLoading || atendQ.isLoading || ocorrQ.isLoading };
}
