import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchNegociosBI, type NegocioBIRow } from "@/services/bi/negociosBIService";
import { yearMonth } from "@/lib/dateUtils";

interface NegociosKPIs {
  totalNegocios: number;
  ganhos: number;
  perdidos: number;
  andamento: number;
  taxaConversao: number; // % ganhos sobre negocios concluidos (ganho+perdido)
  pipelineAberto: number; // R$ em negocios "Em Andamento"
  valorGanho: number; // R$ em negocios ganhos
  ticketMedioGanho: number;
  cicloMedioDias: number; // media de NGO_CicloVendas nos concluidos
  esforcoMedio: number; // media de NGO_QtdAcoes
}

interface EtapaDatum {
  name: string;
  valor: number;
  qtd: number;
}

interface OrigemDatum {
  name: string;
  ganhos: number;
  perdidos: number;
  andamento: number;
  total: number;
  taxa: number; // % conversao
  valorGanho: number;
}

interface MotivoDatum {
  name: string;
  valor: number;
  qtd: number;
}

interface EvolucaoDatum {
  name: string;
  novos: number;
  valorCriado: number;
}

interface ConsultorDatum {
  name: string;
  valorGanho: number;
  ganhos: number;
  total: number;
  taxa: number;
}

export interface NegociosAgg {
  kpis: NegociosKPIs;
  funilPorEtapa: EtapaDatum[];
  porOrigem: OrigemDatum[];
  motivosPerda: MotivoDatum[];
  evolucaoMensal: EvolucaoDatum[];
  rankingConsultor: ConsultorDatum[];
}

type Conclusao = "ganho" | "perdido" | "andamento";

function classify(conclusao: string | null): Conclusao {
  const c = (conclusao ?? "").toLowerCase();
  if (c.includes("perd")) return "perdido";
  if (c.includes("ganho")) return "ganho";
  return "andamento";
}

/** Extrai o numero inicial de uma etapa ("3-PROPOSTA" -> 3) para ordenar o funil. */
function etapaOrder(etapa: string): number {
  const m = etapa.match(/^\s*(\d+)/);
  return m ? Number(m[1]) : 99;
}

/** Remove linhas duplicadas por NGO_Numero (view denormalizada por produto). */
export function dedupeNegocios(rows: NegocioBIRow[]): NegocioBIRow[] {
  const seen = new Set<string>();
  const out: NegocioBIRow[] = [];
  for (const r of rows) {
    const key = r.NGO_Numero;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}

const num = (v: number | null): number => (typeof v === "number" && isFinite(v) ? v : 0);

export function aggregateNegociosBI(rawRows: NegocioBIRow[]): NegociosAgg {
  const rows = dedupeNegocios(rawRows);

  let ganhos = 0;
  let perdidos = 0;
  let andamento = 0;
  let pipelineAberto = 0;
  let valorGanho = 0;
  let cicloSoma = 0;
  let cicloN = 0;
  let esforcoSoma = 0;
  let esforcoN = 0;

  const etapaMap = new Map<string, EtapaDatum>();
  const origemMap = new Map<string, OrigemDatum>();
  const motivoMap = new Map<string, MotivoDatum>();
  const mesMap = new Map<string, EvolucaoDatum>();
  const consultorMap = new Map<string, ConsultorDatum>();

  for (const r of rows) {
    const status = classify(r.NGO_Conclusao);
    const valor = num(r.NGO_VlrTotalNegociado);
    const origem = (r.NGO_FormaEntrada || "Sem origem").trim() || "Sem origem";
    const consultor = r.vendedorNome || "Sem vendedor";

    // KPIs por status
    if (status === "ganho") {
      ganhos++;
      valorGanho += valor;
    } else if (status === "perdido") {
      perdidos++;
    } else {
      andamento++;
      pipelineAberto += valor;
    }

    // ciclo de vendas (so faz sentido em negocios concluidos)
    if (status !== "andamento" && num(r.NGO_CicloVendas) > 0) {
      cicloSoma += num(r.NGO_CicloVendas);
      cicloN++;
    }
    if (num(r.NGO_QtdAcoes) > 0) {
      esforcoSoma += num(r.NGO_QtdAcoes);
      esforcoN++;
    }

    // funil: negocios em andamento por etapa (valor em risco/oportunidade)
    if (status === "andamento" && r.NGO_Etapa) {
      const e = etapaMap.get(r.NGO_Etapa) ?? { name: r.NGO_Etapa, valor: 0, qtd: 0 };
      e.valor += valor;
      e.qtd++;
      etapaMap.set(r.NGO_Etapa, e);
    }

    // conversao por origem do lead
    const o = origemMap.get(origem) ?? {
      name: origem, ganhos: 0, perdidos: 0, andamento: 0, total: 0, taxa: 0, valorGanho: 0,
    };
    o.total++;
    if (status === "ganho") { o.ganhos++; o.valorGanho += valor; }
    else if (status === "perdido") o.perdidos++;
    else o.andamento++;
    origemMap.set(origem, o);

    // motivos de perda (onde a receita esta vazando)
    if (status === "perdido") {
      const motivo = (r.NGO_MotivoPerda || "Nao informado").trim() || "Nao informado";
      const m = motivoMap.get(motivo) ?? { name: motivo, valor: 0, qtd: 0 };
      m.valor += valor;
      m.qtd++;
      motivoMap.set(motivo, m);
    }

    // evolucao mensal por data de cadastro
    const ym = yearMonth(r.NGO_DataCadastro ?? "");
    if (ym) {
      const ev = mesMap.get(ym) ?? { name: ym, novos: 0, valorCriado: 0 };
      ev.novos++;
      ev.valorCriado += valor;
      mesMap.set(ym, ev);
    }

    // ranking de consultores por valor ganho
    const c = consultorMap.get(consultor) ?? { name: consultor, valorGanho: 0, ganhos: 0, total: 0, taxa: 0 };
    c.total++;
    if (status === "ganho") { c.ganhos++; c.valorGanho += valor; }
    consultorMap.set(consultor, c);
  }

  const concluidos = ganhos + perdidos;
  const kpis: NegociosKPIs = {
    totalNegocios: rows.length,
    ganhos,
    perdidos,
    andamento,
    taxaConversao: concluidos > 0 ? (ganhos / concluidos) * 100 : 0,
    pipelineAberto,
    valorGanho,
    ticketMedioGanho: ganhos > 0 ? valorGanho / ganhos : 0,
    cicloMedioDias: cicloN > 0 ? cicloSoma / cicloN : 0,
    esforcoMedio: esforcoN > 0 ? esforcoSoma / esforcoN : 0,
  };

  const funilPorEtapa = Array.from(etapaMap.values()).sort(
    (a, b) => etapaOrder(a.name) - etapaOrder(b.name) || b.valor - a.valor,
  );

  const porOrigem = Array.from(origemMap.values())
    .map((o) => ({
      ...o,
      taxa: o.ganhos + o.perdidos > 0 ? (o.ganhos / (o.ganhos + o.perdidos)) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const motivosPerda = Array.from(motivoMap.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  const evolucaoMensal = Array.from(mesMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-12);

  const rankingConsultor = Array.from(consultorMap.values())
    .map((c) => ({ ...c, taxa: c.total > 0 ? (c.ganhos / c.total) * 100 : 0 }))
    .sort((a, b) => b.valorGanho - a.valorGanho)
    .slice(0, 10);

  return { kpis, funilPorEtapa, porOrigem, motivosPerda, evolucaoMensal, rankingConsultor };
}

export function useNegociosBI(enabled: boolean) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bi-negocios"],
    queryFn: fetchNegociosBI,
    staleTime: 60_000,
    enabled,
  });

  const agg = useMemo(() => aggregateNegociosBI(rows), [rows]);

  return { agg, isLoading };
}
