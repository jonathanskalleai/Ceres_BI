import { Wrench, ShieldCheck, Clock } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtNum, fmtDias, isEmpty } from "@/lib/formatters";
import type { useServicosKPIs } from "@/hooks/bi/useServicosKPIs";

interface Props {
  svcKpis: ReturnType<typeof useServicosKPIs>["kpis"];
  loading: boolean;
}

export function PainelServicosSection({ svcKpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(svcKpis.osAbertas.value)) && (
        <KPICard
          title="OS Abertas"
          value={fmtNum(svcKpis.osAbertas.value)}
          icon={Wrench}
          previousValue={fmtNum(svcKpis.osAbertas.previousValue)}
          trend={svcKpis.osAbertas.trend}
          loading={loading}
          formula="Ordens de servico abertas que ainda nao foram encerradas"
        />
      )}
      {(loading || !isEmpty(svcKpis.osFechadas.value)) && (
        <KPICard
          title="OS Fechadas"
          value={fmtNum(svcKpis.osFechadas.value)}
          icon={ShieldCheck}
          previousValue={fmtNum(svcKpis.osFechadas.previousValue)}
          trend={svcKpis.osFechadas.trend}
          loading={loading}
          accentColor="var(--voux-success)"
          formula="Ordens de servico concluidas no periodo"
        />
      )}
      {(loading || !isEmpty(svcKpis.tempoMedioResolucao.value)) && (
        <KPICard
          title="Tempo Medio Resolucao"
          value={fmtDias(svcKpis.tempoMedioResolucao.value)}
          icon={Clock}
          previousValue={fmtDias(svcKpis.tempoMedioResolucao.previousValue)}
          trend={svcKpis.tempoMedioResolucao.trend}
          invertTrend
          loading={loading}
          formula="Tempo medio para resolver uma OS — dias entre abertura e encerramento"
        />
      )}
    </>
  );
}
