import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchTecnicoTempo, fetchAgenda,
  type TecnicoTempoRow, type AgendaRow,
} from "@/services/bi/operacionalBIService";

interface ChartDatum {
  name: string;
  value: number;
}

interface UtilizacaoDatum {
  name: string;
  atendimento: number; // % do tempo disponivel
  deslocamento: number;
  ocioso: number;
}

interface OperacionalKPIs {
  tecnicosAtivos: number;
  kmTotal: number;
  utilizacaoMedia: number; // % (atendimento + deslocamento) / disponivel
  percentOcioso: number;
  eventosAgenda: number;
  taxaConclusaoAgenda: number; // %
}

export interface OperacionalAgg {
  kpis: OperacionalKPIs;
  kmPorTecnico: ChartDatum[];
  utilizacaoPorTecnico: UtilizacaoDatum[];
  agendaPorStatus: ChartDatum[];
  agendaPorTipo: ChartDatum[];
}

const num = (v: number | null): number => (typeof v === "number" && isFinite(v) ? v : 0);

interface Acc {
  disponivel: number;
  atendimento: number;
  deslocamento: number;
  ocioso: number;
  km: number;
}

export function aggregateOperacional(
  tempos: TecnicoTempoRow[],
  agenda: AgendaRow[],
): OperacionalAgg {
  const porTecnico = new Map<string, Acc>();
  let dispTot = 0, atendTot = 0, deslocTot = 0, ocioTot = 0, kmTot = 0;

  for (const t of tempos) {
    const nome = (t.USR_nomeUsuario || "Sem tecnico").trim() || "Sem tecnico";
    const acc = porTecnico.get(nome) ?? { disponivel: 0, atendimento: 0, deslocamento: 0, ocioso: 0, km: 0 };

    // Hipótese: TMP_TempoDisponivel e TMP_TempoOciosos estão em segundos,
    // enquanto TMP_DuracaoAtendimento e TMP_DuracaoDeslocamento estão em minutos.
    // Converte tudo para minutos para cálculo consistente.
    const dispMin = num(t.TMP_TempoDisponivel) / 60; // segundos → minutos
    const atendMin = num(t.TMP_DuracaoAtendimento); // já em minutos
    const deslocMin = num(t.TMP_DuracaoDeslocamento); // já em minutos
    const ocioMin = num(t.TMP_TempoOcioso) / 60; // segundos → minutos

    acc.disponivel += dispMin;
    acc.atendimento += atendMin;
    acc.deslocamento += deslocMin;
    acc.ocioso += ocioMin;
    acc.km += num(t.TMP_KmRodado);
    porTecnico.set(nome, acc);

    dispTot += dispMin;
    atendTot += atendMin;
    deslocTot += deslocMin;
    ocioTot += ocioMin;
    kmTot += num(t.TMP_KmRodado);
  }

  const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

  const utilizacaoPorTecnico: UtilizacaoDatum[] = Array.from(porTecnico.entries())
    .map(([name, a]) => ({
      name,
      atendimento: pct(a.atendimento, a.disponivel),
      deslocamento: pct(a.deslocamento, a.disponivel),
      ocioso: pct(a.ocioso, a.disponivel),
    }))
    .sort((x, y) => y.atendimento + y.deslocamento - (x.atendimento + x.deslocamento));

  const kmPorTecnico: ChartDatum[] = Array.from(porTecnico.entries())
    .map(([name, a]) => ({ name, value: Math.round(a.km) }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 12);

  // Agenda
  const statusMap = new Map<string, number>();
  const tipoMap = new Map<string, number>();
  let concluidas = 0;
  for (const a of agenda) {
    const status = (a.AGE_fStatus || "Sem status").trim() || "Sem status";
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
    if (/conclu|finaliz|realizad|fechad|encerr/i.test(status)) concluidas++;

    const tipo = (a.TPS_dscTipoServicoAtendimento || "Sem tipo").trim() || "Sem tipo";
    tipoMap.set(tipo, (tipoMap.get(tipo) ?? 0) + 1);
  }

  const toChart = (m: Map<string, number>, top = 8) =>
    Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, top);

  const kpis: OperacionalKPIs = {
    tecnicosAtivos: porTecnico.size,
    kmTotal: Math.round(kmTot),
    utilizacaoMedia: pct(atendTot + deslocTot, dispTot),
    percentOcioso: pct(ocioTot, dispTot),
    eventosAgenda: agenda.length,
    taxaConclusaoAgenda: agenda.length > 0 ? (concluidas / agenda.length) * 100 : 0,
  };

  return {
    kpis,
    kmPorTecnico,
    utilizacaoPorTecnico,
    agendaPorStatus: toChart(statusMap),
    agendaPorTipo: toChart(tipoMap),
  };
}

export function useOperacionalData(enabled: boolean) {
  const tempoQ = useQuery({ queryKey: ["bi-tecnico-tempo"], queryFn: fetchTecnicoTempo, staleTime: 60_000, enabled });
  const agendaQ = useQuery({ queryKey: ["bi-agenda"], queryFn: fetchAgenda, staleTime: 60_000, enabled });

  const agg = useMemo(
    () => aggregateOperacional(tempoQ.data ?? [], agendaQ.data ?? []),
    [tempoQ.data, agendaQ.data],
  );

  return { agg, isLoading: tempoQ.isLoading || agendaQ.isLoading };
}
