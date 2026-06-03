import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPedidosBI, type PedidoRow } from "@/services/bi/pedidosBIService";
import { yearMonth } from "@/lib/dateUtils";

interface ChartDatum {
  name: string;
  value: number;
}

interface SituacaoDatum {
  name: string;
  valor: number;
  qtd: number;
}

interface EvolucaoDatum {
  name: string;
  faturamento: number;
  qtd: number;
}

interface PedidosKPIs {
  total: number;
  faturamento: number; // R$ em pedidos Aprovados (receita real)
  ticketMedio: number; // sobre pedidos aprovados
  percentAprovado: number;
  percentFinanciado: number; // financiado / (financiado + proprio)
  valorCancelado: number;
}

interface PedidosAgg {
  kpis: PedidosKPIs;
  evolucaoMensal: EvolucaoDatum[];
  porSituacao: SituacaoDatum[];
  mixPagamento: ChartDatum[];
  porVendedor: ChartDatum[]; // faturamento aprovado
  porCidade: ChartDatum[]; // faturamento aprovado
}

const num = (v: number | null): number => (typeof v === "number" && isFinite(v) ? v : 0);
const isAprovado = (s: string) => s.trim().toLowerCase() === "aprovado";
const isCancelado = (s: string) => s.trim().toLowerCase().includes("cancel");

export function aggregatePedidos(rows: PedidoRow[]): PedidosAgg {
  const total = rows.length;
  let faturamento = 0;
  let aprovados = 0;
  let valorCancelado = 0;
  let financiado = 0;
  let recursoProprio = 0;

  const sitMap = new Map<string, SituacaoDatum>();
  const mesMap = new Map<string, EvolucaoDatum>();
  const venMap = new Map<string, number>();
  const cidMap = new Map<string, number>();

  for (const r of rows) {
    const sit = r.PDO_SituacaoPedido || "Sem situacao";
    const valor = num(r.PDO_VlrPedido);
    const aprovado = isAprovado(sit);

    const s = sitMap.get(sit) ?? { name: sit, valor: 0, qtd: 0 };
    s.valor += valor;
    s.qtd++;
    sitMap.set(sit, s);

    if (isCancelado(sit)) valorCancelado += valor;

    if (aprovado) {
      aprovados++;
      faturamento += valor;
      financiado += num(r.PDO_VlrFinanciado);
      recursoProprio += num(r.PDO_VlrRecursoProprio);

      const ym = yearMonth(r.PDO_DthPedido ?? "");
      if (ym) {
        const ev = mesMap.get(ym) ?? { name: ym, faturamento: 0, qtd: 0 };
        ev.faturamento += valor;
        ev.qtd++;
        mesMap.set(ym, ev);
      }

      const ven = r.PDO_Vendedor || "Sem vendedor";
      venMap.set(ven, (venMap.get(ven) ?? 0) + valor);

      const cid = r.PDO_CidadeUFEntrega || "Sem cidade";
      cidMap.set(cid, (cidMap.get(cid) ?? 0) + valor);
    }
  }

  const baseFin = financiado + recursoProprio;
  const kpis: PedidosKPIs = {
    total,
    faturamento,
    ticketMedio: aprovados > 0 ? faturamento / aprovados : 0,
    percentAprovado: total > 0 ? (aprovados / total) * 100 : 0,
    percentFinanciado: baseFin > 0 ? (financiado / baseFin) * 100 : 0,
    valorCancelado,
  };

  const porSituacao = Array.from(sitMap.values()).sort((a, b) => b.valor - a.valor);

  const evolucaoMensal = Array.from(mesMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-12);

  const mixPagamento: ChartDatum[] = [
    { name: "Recurso Proprio", value: recursoProprio },
    { name: "Financiado", value: financiado },
  ];

  const toTop = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

  return {
    kpis,
    evolucaoMensal,
    porSituacao,
    mixPagamento,
    porVendedor: toTop(venMap),
    porCidade: toTop(cidMap),
  };
}

export function usePedidosData(enabled: boolean, dateRange?: import("react-day-picker").DateRange) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bi-pedidos"],
    queryFn: fetchPedidosBI,
    staleTime: 60_000,
    enabled,
  });

  const filteredRows = useMemo(() => {
    if (!dateRange?.from) return rows;
    return rows.filter((r) => {
      const d = r.PDO_DthPedido ? new Date(r.PDO_DthPedido) : null;
      if (!d) return false;
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }, [rows, dateRange]);

  const agg = useMemo(() => aggregatePedidos(filteredRows), [filteredRows]);

  return { agg, isLoading };
}
