import {
  TrendingUp, TrendingDown, Briefcase, Target, Activity,
} from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { usePainelKPIs } from "@/hooks/bi/usePainelKPIs";

interface Props {
  kpis: ReturnType<typeof usePainelKPIs>["kpis"];
  loading: boolean;
}

export function PainelNegociosSection({ kpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(kpis.totalNegocios.value)) && (
        <KPICard
          title="Total Negocios"
          value={fmtNum(kpis.totalNegocios.value)}
          icon={Briefcase}
          previousValue={fmtNum(kpis.totalNegocios.previousValue)}
          trend={kpis.totalNegocios.trend}
          loading={loading}
          formula="COUNT negocios unicos (dedup por numero)"
        />
      )}
      {(loading || !isEmpty(kpis.ganhos.value)) && (
        <KPICard
          title="Ganhos"
          value={fmtNum(kpis.ganhos.value)}
          icon={TrendingUp}
          previousValue={fmtNum(kpis.ganhos.previousValue)}
          trend={kpis.ganhos.trend}
          loading={loading}
          accentColor="var(--voux-success, #4ade80)"
          formula="COUNT WHERE conclusao = ganho"
        />
      )}
      {(loading || !isEmpty(kpis.perdidos.value)) && (
        <KPICard
          title="Perdidos"
          value={fmtNum(kpis.perdidos.value)}
          icon={TrendingDown}
          previousValue={fmtNum(kpis.perdidos.previousValue)}
          trend={kpis.perdidos.trend}
          invertTrend
          loading={loading}
          accentColor="var(--voux-danger, #f87171)"
          formula="COUNT WHERE conclusao = perda"
        />
      )}
      {(loading || !isEmpty(kpis.andamento.value)) && (
        <KPICard
          title="Em Andamento"
          value={fmtNum(kpis.andamento.value)}
          icon={Activity}
          previousValue={fmtNum(kpis.andamento.previousValue)}
          trend={kpis.andamento.trend}
          loading={loading}
          formula="COUNT WHERE sem conclusao definitiva"
        />
      )}
      {(loading || !isEmpty(kpis.taxaConversao.value)) && (
        <KPICard
          title="Taxa de Conversao"
          value={fmtPct(kpis.taxaConversao.value)}
          icon={Target}
          previousValue={fmtPct(kpis.taxaConversao.previousValue)}
          trend={kpis.taxaConversao.trend}
          loading={loading}
          formula="ganhos / (ganhos + perdidos) x 100"
        />
      )}
    </>
  );
}
