import {
  DollarSign, TrendingDown, Briefcase, Ticket,
} from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtBRLKpi, isEmpty } from "@/lib/formatters";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

interface Props {
  kpis: PainelKPIs;
  loading: boolean;
}

export function PainelValoresSection({ kpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(kpis.valorGanho.value)) && (
        <KPICard
          title="Valor Ganho"
          value={fmtBRLKpi(kpis.valorGanho.value)}
          icon={DollarSign}
          previousValue={fmtBRLKpi(kpis.valorGanho.previousValue)}
          trend={kpis.valorGanho.trend}
          loading={loading}
          accentColor="var(--voux-success)"
          hint="Total em R$ dos negocios ganhos"
          formula="Soma o valor negociado de todos os negocios fechados com sucesso"
        />
      )}
      {(loading || !isEmpty(kpis.valorPerdido.value)) && (
        <KPICard
          title="Valor Perdido"
          value={fmtBRLKpi(kpis.valorPerdido.value)}
          icon={TrendingDown}
          previousValue={fmtBRLKpi(kpis.valorPerdido.previousValue)}
          trend={kpis.valorPerdido.trend}
          invertTrend
          loading={loading}
          accentColor="var(--voux-danger)"
          hint="Total em R$ dos negocios perdidos"
          formula="Soma o valor negociado de todos os negocios que nao fecharam"
        />
      )}
      {(loading || !isEmpty(kpis.pipelineAberto.value)) && (
        <KPICard
          title="Pipeline Aberto"
          value={fmtBRLKpi(kpis.pipelineAberto.value)}
          icon={Briefcase}
          previousValue={fmtBRLKpi(kpis.pipelineAberto.previousValue)}
          trend={kpis.pipelineAberto.trend}
          loading={loading}
          hint="Valor total dos negocios ainda abertos"
          formula="Soma o valor de todos os negocios que ainda nao tiveram resultado"
        />
      )}
      {(loading || !isEmpty(kpis.ticketMedio.value)) && (
        <KPICard
          title="Ticket Medio"
          value={fmtBRLKpi(kpis.ticketMedio.value)}
          icon={Ticket}
          previousValue={fmtBRLKpi(kpis.ticketMedio.previousValue)}
          trend={kpis.ticketMedio.trend}
          loading={loading}
          hint="Valor medio por negocio ganho"
          formula="Divide o valor total ganho pela quantidade de negocios ganhos"
        />
      )}
    </>
  );
}
