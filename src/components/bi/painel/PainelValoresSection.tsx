import {
  DollarSign, TrendingDown, Briefcase, Ticket, BarChart3,
} from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtBRLKpi, isEmpty } from "@/lib/formatters";
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
          value={fmtBRLKpi(kpis.valorGanho.value)}
          icon={DollarSign}
          previousValue={fmtBRLKpi(kpis.valorGanho.previousValue)}
          trend={kpis.valorGanho.trend}
          loading={loading}
          accentColor="var(--voux-success)"
          formula="SUM(valor) dos negocios ganhos"
          dataSource="mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) WHERE ngo_conclusao='ganho'"
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
          formula="SUM(valor) dos negocios perdidos"
          dataSource="mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) WHERE ngo_conclusao='perdido'"
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
          formula="SUM(valor) dos negocios em andamento"
          dataSource="mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) WHERE sem conclusao"
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
          formula="valor ganho / qtd ganhos"
          dataSource="mirror.crm_negocios · AVG(ngo_vlrtotalnegociado) WHERE ganho"
        />
      )}
      {(loading || !isEmpty(crossKpis.receitaPorConsultor.value)) && (
        <KPICard
          title="Receita/Consultor"
          value={fmtBRLKpi(crossKpis.receitaPorConsultor.value)}
          icon={BarChart3}
          previousValue={fmtBRLKpi(crossKpis.receitaPorConsultor.previousValue)}
          trend={crossKpis.receitaPorConsultor.trend}
          loading={loading}
          hint="Media valor ganho por vendedor"
          formula="valor ganho / qtd vendedores com ganho"
          dataSource="mirror.crm_negocios · SUM(ngo_vlrtotalnegociado)/COUNT(DISTINCT ngo_vendedores)"
        />
      )}
    </>
  );
}
