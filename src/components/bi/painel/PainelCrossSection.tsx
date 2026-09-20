import { Clock, ClipboardList } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtDias, fmtNum, isEmpty } from "@/lib/formatters";
import type { CrossKPIs } from "@/hooks/bi/useCrossKPIsRpc";

interface Props {
  crossKpis: CrossKPIs;
  loading: boolean;
  comparisonReady: boolean;
}

export function PainelCrossSection({ crossKpis, loading, comparisonReady }: Props) {
  return (
    <>
      {(loading || !isEmpty(crossKpis.cicloMedioVendas.value)) && (
        <KPICard
          title="Ciclo Medio"
          value={fmtDias(crossKpis.cicloMedioVendas.value)}
          icon={Clock}
          previousValue={comparisonReady ? fmtDias(crossKpis.cicloMedioVendas.previousValue) : undefined}
          trend={crossKpis.cicloMedioVendas.trend}
          invertTrend
          loading={loading}
          formula="Tempo medio para fechar um negocio — media de dias entre abertura e fechamento dos ganhos"
        />
      )}
      {(loading || !isEmpty(crossKpis.esforcoMedio.value)) && (
        <KPICard
          title="Esforco Medio"
          value={fmtNum(crossKpis.esforcoMedio.value)}
          icon={ClipboardList}
          previousValue={comparisonReady ? fmtNum(crossKpis.esforcoMedio.previousValue) : undefined}
          trend={crossKpis.esforcoMedio.trend}
          invertTrend
          loading={loading}
          formula="Quantas acoes em media ate fechar um negocio com sucesso"
        />
      )}
    </>
  );
}
