import {
  DollarSign, TrendingDown, Briefcase, Ticket, BarChart3,
} from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtBRL, isEmpty } from "@/lib/formatters";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";
import type { CrossKPIs } from "@/hooks/bi/useCrossKPIsRpc";

interface Props {
  kpis: PainelKPIs;
  crossKpis: CrossKPIs;
  loading: boolean;
}

export function PainelValoresSection({ kpis, crossKpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(kpis.valorGanho.value)) && (
        <KPICard
          title="Valor Ganho"
          value={fmtBRL(kpis.valorGanho.value)}
          icon={DollarSign}
          previousValue={fmtBRL(kpis.valorGanho.previousValue)}
          trend={kpis.valorGanho.trend}
          loading={loading}
          accentColor="var(--voux-success, #4ade80)"
          formula="SUM(valor) dos negocios ganhos"
        />
      )}
      {(loading || !isEmpty(kpis.valorPerdido.value)) && (
        <KPICard
          title="Valor Perdido"
          value={fmtBRL(kpis.valorPerdido.value)}
          icon={TrendingDown}
          previousValue={fmtBRL(kpis.valorPerdido.previousValue)}
          trend={kpis.valorPerdido.trend}
          invertTrend
          loading={loading}
          accentColor="var(--voux-danger, #f87171)"
          formula="SUM(valor) dos negocios perdidos"
        />
      )}
      {(loading || !isEmpty(kpis.pipelineAberto.value)) && (
        <KPICard
          title="Pipeline Aberto"
          value={fmtBRL(kpis.pipelineAberto.value)}
          icon={Briefcase}
          previousValue={fmtBRL(kpis.pipelineAberto.previousValue)}
          trend={kpis.pipelineAberto.trend}
          loading={loading}
          formula="SUM(valor) dos negocios em andamento"
        />
      )}
      {(loading || !isEmpty(kpis.ticketMedio.value)) && (
        <KPICard
          title="Ticket Medio"
          value={fmtBRL(kpis.ticketMedio.value)}
          icon={Ticket}
          previousValue={fmtBRL(kpis.ticketMedio.previousValue)}
          trend={kpis.ticketMedio.trend}
          loading={loading}
          formula="valor ganho / qtd ganhos"
        />
      )}
      {(loading || !isEmpty(crossKpis.receitaPorConsultor.value)) && (
        <KPICard
          title="Receita/Consultor"
          value={fmtBRL(crossKpis.receitaPorConsultor.value)}
          icon={BarChart3}
          previousValue={fmtBRL(crossKpis.receitaPorConsultor.previousValue)}
          trend={crossKpis.receitaPorConsultor.trend}
          loading={loading}
          hint="Media valor ganho por vendedor"
          formula="valor ganho / qtd vendedores com ganho"
        />
      )}
    </>
  );
}
