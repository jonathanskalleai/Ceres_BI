import { Clock, ClipboardList, Target } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtDias, fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { CrossKPIs } from "@/hooks/bi/useCrossKPIsRpc";

interface Props {
  crossKpis: CrossKPIs;
  loading: boolean;
}

export function PainelCrossSection({ crossKpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(crossKpis.cicloMedioVendas.value)) && (
        <KPICard
          title="Ciclo Medio"
          value={fmtDias(crossKpis.cicloMedioVendas.value)}
          icon={Clock}
          previousValue={fmtDias(crossKpis.cicloMedioVendas.previousValue)}
          trend={crossKpis.cicloMedioVendas.trend}
          invertTrend
          loading={loading}
          hint="Tempo medio para fechar um negocio"
          formula="Media de dias entre a abertura e o fechamento dos negocios ganhos"
        />
      )}
      {(loading || !isEmpty(crossKpis.esforcoMedio.value)) && (
        <KPICard
          title="Esforco Medio"
          value={fmtNum(crossKpis.esforcoMedio.value)}
          icon={ClipboardList}
          previousValue={fmtNum(crossKpis.esforcoMedio.previousValue)}
          trend={crossKpis.esforcoMedio.trend}
          invertTrend
          loading={loading}
          hint="Quantas acoes ate fechar um negocio"
          formula="Media de acoes realizadas para cada negocio que foi ganho"
        />
      )}
      {(loading || !isEmpty(crossKpis.conversaoPedidoNegocio.value)) && (
        <KPICard
          title="Conversao Pedido"
          value={fmtPct(crossKpis.conversaoPedidoNegocio.value)}
          icon={Target}
          previousValue={fmtPct(crossKpis.conversaoPedidoNegocio.previousValue)}
          trend={crossKpis.conversaoPedidoNegocio.trend}
          loading={loading}
          hint="Dos ganhos, quantos geraram pedido"
          formula="Percentual dos negocios ganhos que tiveram pedido emitido"
        />
      )}
    </>
  );
}
