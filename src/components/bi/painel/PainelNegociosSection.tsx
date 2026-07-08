import {
  TrendingUp, TrendingDown, Briefcase, Target, Activity,
} from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

interface Props {
  kpis: PainelKPIs;
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
          hint="Quantidade de negocios diferentes no periodo"
          formula="Conta cada negocio uma unica vez, mesmo que tenha varios produtos"
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
          accentColor="var(--voux-success)"
          hint="Negocios fechados com sucesso"
          formula="Conta negocios marcados como ganhos no periodo"
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
          accentColor="var(--voux-danger)"
          hint="Negocios que nao fecharam"
          formula="Conta negocios marcados como perdidos no periodo"
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
          hint="Negocios ainda abertos"
          formula="Conta negocios que ainda nao tiveram resultado definido"
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
          hint="Percentual de sucesso"
          formula="Dos negocios que tiveram resultado, quantos % foram ganhos"
        />
      )}
    </>
  );
}
